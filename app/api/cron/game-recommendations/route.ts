import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recommendGamesForUser, recommendGamesForFamily } from "@/lib/gemini";
import { isCronAuthorized } from "@/lib/api";
import { getTier, TIER_CRON_REC_COUNT } from "@/lib/reputation";
import { getFamilyTier, FAMILY_TIER_CRON_REC_COUNT } from "@/lib/family-reputation";

// Validates AI-generated steamAppId by checking name against catalog + Steam search API.
// Gemini frequently returns wrong appIds — we resolve the real one from the game name.
async function resolveAppId(aiName: string, aiAppId: number): Promise<number> {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[®™©]/g, "").replace(/\s+/g, " ").trim();
  const normTarget = normalize(aiName);
  // Strip subtitle (after ":") and special chars for search
  const searchTerm = aiName.replace(/[®™©]/g, "").split(":")[0].trim();

  // 1. Try local catalog: exact name match across progressively shorter terms
  for (const term of [searchTerm, searchTerm.split(" ").slice(0, 3).join(" ")]) {
    const rows = await prisma.steamAppCatalog.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      take: 10,
    });
    const exact = rows.find((r) => normalize(r.name) === normTarget);
    if (exact) return exact.appId;
    // All significant words present → good enough
    const words = normTarget.split(" ").filter((w) => w.length > 3);
    const close = rows.find((r) => words.every((w) => normalize(r.name).includes(w)));
    if (close) return close.appId;
  }

  // 2. Steam storefront search API — authoritative source for appIds
  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(searchTerm)}&l=english&cc=BR`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      const items: Array<{ id: number; name: string }> = data?.items ?? [];
      const exact = items.find((i) => normalize(i.name) === normTarget);
      if (exact) return exact.id;
      // First result is Steam's best match — use it if name is related
      if (items[0] && normalize(items[0].name).includes(searchTerm.split(" ")[0].toLowerCase())) {
        return items[0].id;
      }
    }
  } catch { /* non-fatal */ }

  return aiAppId;
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true;
  if (isCronAuthorized(req, process.env.CRON_SECRET, true)) return true;
  if (isCronAuthorized(req, process.env.BOT_API_SECRET)) return true;
  return false;
}

type OwnedGame = { appId: number; name: string; playtimeMinutes: number };

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json({ ok: false, error: "GOOGLE_API_KEY not configured" }, { status: 503 });
  }

  let usersProcessed = 0;
  let familiesProcessed = 0;
  let userErrors = 0;
  let familyErrors = 0;

  // --- Individual recommendations ---
  const activeUsers = await prisma.user.findMany({
    where: { memberships: { some: { status: "active" } } },
    select: { id: true, steamId: true, reputationScore: true },
  });

  for (const user of activeUsers) {
    try {
      const cache = await prisma.steamUserCache.findUnique({
        where: { userId_type: { userId: user.steamId, type: "library" } },
        select: { payload: true },
      });
      if (!cache) continue;

      const library = cache.payload as unknown as OwnedGame[];
      if (!Array.isArray(library) || library.length === 0) continue;

      const tier = getTier(user.reputationScore ?? 0);
      const count = TIER_CRON_REC_COUNT[tier];
      const recommendations = await recommendGamesForUser(library, [], count);
      if (recommendations.length === 0) continue;

      const data = await Promise.all(recommendations.map(async (rec, i) => ({
        userId: user.id,
        type: "individual",
        steamAppId: await resolveAppId(rec.name, rec.steamAppId),
        gameName: rec.name,
        reason: rec.reason,
        rank: i + 1,
      })));

      await prisma.$transaction([
        prisma.gameRecommendation.deleteMany({ where: { userId: user.id, type: "individual" } }),
        prisma.gameRecommendation.createMany({ data }),
      ]);

      usersProcessed++;
    } catch (err) {
      console.error(`[game-recs] user ${user.id}:`, err);
      userErrors++;
    }
  }

  // --- Family recommendations ---
  const families = await prisma.family.findMany({
    where: { wishlistItems: { some: { status: { not: "cancelled" } } } },
    select: {
      id: true,
      familyScore: true,
      wishlistItems: {
        where: { status: { not: "cancelled" } },
        select: { steamAppId: true },
      },
    },
  });

  for (const family of families) {
    try {
      const appIds = family.wishlistItems.map((i) => i.steamAppId);
      const cacheEntries = await prisma.steamAppCache.findMany({
        where: { steamAppId: { in: appIds } },
        select: { steamAppId: true, payload: true },
      });
      const nameMap = new Map(
        cacheEntries.map((e) => [e.steamAppId, (e.payload as { name?: string })?.name ?? ""])
      );
      const wishlistNames = appIds.map((id) => nameMap.get(id) ?? "").filter(Boolean);
      if (wishlistNames.length === 0) continue;

      const familyTier = getFamilyTier(family.familyScore ?? 0);
      const familyCount = FAMILY_TIER_CRON_REC_COUNT[familyTier];
      const recommendations = await recommendGamesForFamily(wishlistNames, [], familyCount);
      if (recommendations.length === 0) continue;

      const data = await Promise.all(recommendations.map(async (rec, i) => ({
        familyId: family.id,
        type: "family",
        steamAppId: await resolveAppId(rec.name, rec.steamAppId),
        gameName: rec.name,
        reason: rec.reason,
        rank: i + 1,
      })));

      await prisma.$transaction([
        prisma.gameRecommendation.deleteMany({ where: { familyId: family.id, type: "family" } }),
        prisma.gameRecommendation.createMany({ data }),
      ]);

      familiesProcessed++;
    } catch (err) {
      console.error(`[game-recs] family ${family.id}:`, err);
      familyErrors++;
    }
  }

  return NextResponse.json({ ok: true, usersProcessed, familiesProcessed, userErrors, familyErrors });
}
