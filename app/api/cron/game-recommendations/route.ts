import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recommendGamesForUser, recommendGamesForFamily } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return true;
  const auth = req.headers.get("authorization") ?? "";
  // Vercel cron: requires x-vercel-cron header
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}` && req.headers.get("x-vercel-cron")) return true;
  // Manual trigger: BOT_API_SECRET (doesn't require x-vercel-cron)
  const botSecret = process.env.BOT_API_SECRET;
  if (botSecret && auth === `Bearer ${botSecret}`) return true;
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

      const data = recommendations.map((rec, i) => ({
        userId: user.id,
        type: "individual",
        steamAppId: rec.steamAppId,
        gameName: rec.name,
        reason: rec.reason,
        rank: i + 1,
      }));

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

      const data = recommendations.map((rec, i) => ({
        familyId: family.id,
        type: "family",
        steamAppId: rec.steamAppId,
        gameName: rec.name,
        reason: rec.reason,
        rank: i + 1,
      }));

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
