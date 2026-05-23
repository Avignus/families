import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { getAppDetails } from "@/lib/steam";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Fetch top games from Steam featured categories (top sellers, new releases, specials, etc.)
// Returns a deduplicated list of app IDs.
async function fetchFeaturedAppIds(): Promise<number[]> {
  const url = "https://store.steampowered.com/api/featuredcategories?cc=BR&l=portuguese";
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Steam featuredcategories error: ${res.status}`);
  const data = await res.json();

  const ids = new Set<number>();

  // Categories that contain lists of items with appids
  const listCategories = ["top_sellers", "new_releases", "specials", "coming_soon", "top_rated"];
  for (const key of listCategories) {
    const cat = data[key];
    if (cat?.items) {
      for (const item of cat.items) {
        if (item.id && item.type === 0) ids.add(item.id); // type 0 = game
      }
    }
  }

  // Also include games from spotlight/featured banners
  const featured = data["featured_win"];
  if (featured?.items) {
    for (const item of featured.items) {
      if (item.id) ids.add(item.id);
    }
  }

  return [...ids];
}

// Fetch top 100 global top sellers via Steam store search API
async function fetchTopSellersAppIds(): Promise<number[]> {
  const url =
    "https://store.steampowered.com/api/storequery/?filter=topsellers&cc=BR&l=portuguese&start=0&count=100";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const data = await res.json();
    const items: Array<{ appid?: number }> = data?.ids ?? data?.items ?? [];
    return items.map((i) => i.appid).filter(Boolean) as number[];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let appIds: number[] = [];
  const errors: string[] = [];

  try {
    const [featured, topSellers] = await Promise.allSettled([
      fetchFeaturedAppIds(),
      fetchTopSellersAppIds(),
    ]);
    if (featured.status === "fulfilled") appIds.push(...featured.value);
    else errors.push(`featured: ${featured.reason}`);
    if (topSellers.status === "fulfilled") appIds.push(...topSellers.value);
    else errors.push(`topSellers: ${topSellers.reason}`);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  // Deduplicate and cap at 500
  appIds = [...new Set(appIds)].slice(0, 500);

  if (appIds.length === 0) {
    return NextResponse.json({ error: "No app IDs fetched", details: errors }, { status: 500 });
  }

  // Skip IDs already in catalog (avoid redundant fetches)
  const existing = await prisma.steamAppCatalog.findMany({
    where: { appId: { in: appIds } },
    select: { appId: true },
  });
  const existingIds = new Set(existing.map((r) => r.appId));
  const toFetch = appIds.filter((id) => !existingIds.has(id));

  // Fetch details in parallel batches of 10
  let seeded = 0;
  let skipped = existingIds.size;
  let failed = 0;
  const BATCH = 10;

  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((id) => getAppDetails(id)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        // getAppDetails already upserts into steamAppCache; also upsert into steamAppCatalog
        await prisma.steamAppCatalog.upsert({
          where: { appId: result.value.appId },
          update: { name: result.value.name },
          create: { appId: result.value.appId, name: result.value.name },
        });
        seeded++;
      } else {
        failed++;
      }
    }
  }

  return NextResponse.json({
    data: {
      totalIds: appIds.length,
      skipped,
      seeded,
      failed,
      errors: errors.length ? errors : undefined,
    },
  });
}
