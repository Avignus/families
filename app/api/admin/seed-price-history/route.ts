import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itadLookup, itadPriceHistory } from "@/lib/itad";

export const dynamic = "force-dynamic";
// Seeding many games can take a while
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  if (!process.env.ITAD_API_KEY) {
    return NextResponse.json({ ok: false, error: "ITAD_API_KEY not configured" }, { status: 503 });
  }

  const country = req.nextUrl.searchParams.get("country") ?? "BR";

  // All unique game IDs being tracked in active wishlists
  const rows = await prisma.wishlistItem.findMany({
    where: { status: { in: ["open", "funded"] } },
    distinct: ["steamAppId"],
    select: { steamAppId: true },
  });
  const appIds = rows.map(r => r.steamAppId);

  const log: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const appId of appIds) {
    // Skip if we already have 30+ records for this game (already seeded)
    const existing = await prisma.steamPriceHistory.count({ where: { steamAppId: appId } });
    if (existing >= 30) {
      skipped++;
      continue;
    }

    // Resolve ITAD game ID
    const itadId = await itadLookup(appId);
    if (!itadId) {
      log.push(`[SKIP] appId ${appId}: not found on ITAD`);
      skipped++;
      continue;
    }

    // Fetch historical prices
    const history = await itadPriceHistory(itadId, country);
    if (history.length === 0) {
      log.push(`[SKIP] appId ${appId} (${itadId}): no history returned`);
      skipped++;
      continue;
    }

    // Import into SteamPriceHistory — one record per day, deduplicated by date
    const seenDates = new Set<string>();
    const records: Array<{ steamAppId: number; priceCents: number; currency: string; recordedAt: Date }> = [];

    for (const entry of history) {
      if (!entry.price?.amount || !entry.timestamp) continue;
      const date = entry.timestamp.slice(0, 10); // YYYY-MM-DD
      if (seenDates.has(date)) continue;
      seenDates.add(date);

      records.push({
        steamAppId: appId,
        priceCents: Math.round(entry.price.amount * 100),
        currency: entry.price.currency ?? country,
        recordedAt: new Date(entry.timestamp),
      });
    }

    if (records.length > 0) {
      await prisma.steamPriceHistory.createMany({ data: records, skipDuplicates: true });
      imported += records.length;
      log.push(`[OK] appId ${appId} (${itadId}): imported ${records.length} records`);
    } else {
      log.push(`[SKIP] appId ${appId}: no valid records to import`);
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, total: appIds.length, imported, skipped, log });
}
