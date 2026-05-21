import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recommendGamesForUser, recommendGamesForFamily } from "@/lib/gemini";
import { isCronAuthorized } from "@/lib/api";

// Validates AI-generated steamAppId against our local catalog.
// Gemini occasionally hallucinates wrong appIds — this cross-checks the name.
async function resolveAppId(aiName: string, aiAppId: number): Promise<number> {
  const normalize = (s: string) => s.toLowerCase().replace(/[®™©:]/g, "").trim();
  const normAi = normalize(aiName);

  // 1. If the catalog has an entry for the suggested appId, check name match
  const byId = await prisma.steamAppCatalog.findFirst({ where: { appId: aiAppId } });
  if (byId && normalize(byId.name).includes(normAi.split(" ")[0])) return aiAppId;

  // 2. Search by name — if exactly one result, it's unambiguous
  const firstWord = normAi.split(" ")[0];
  const byName = await prisma.steamAppCatalog.findMany({
    where: { name: { contains: firstWord, mode: "insensitive" } },
    take: 5,
    orderBy: { appId: "asc" },
  });
  const exact = byName.find((r) => normalize(r.name) === normAi);
  if (exact) return exact.appId;
  if (byName.length === 1) return byName[0].appId;

  return aiAppId; // fall back to AI suggestion
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
    select: { id: true, steamId: true },
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

      const recommendations = await recommendGamesForUser(library);
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

      const recommendations = await recommendGamesForFamily(wishlistNames);
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
