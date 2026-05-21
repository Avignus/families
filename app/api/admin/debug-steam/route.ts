import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.RESET_TEMP_SECRET)) return NextResponse.json({ ok: false }, { status: 401 });

  const steamId = req.nextUrl.searchParams.get("steamId") ?? "76561198045962425";

  const cache = await prisma.steamUserCache.findUnique({
    where: { userId_type: { userId: steamId, type: "library" } },
  });

  const STEAM_API_KEY = process.env.STEAM_API_KEY ?? "";
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=false`;
  const res = await fetch(url, { cache: "no-store" });
  const apiStatus = res.status;
  const data = res.ok ? await res.json() : null;
  const apiGames = data?.response?.games?.length ?? null;
  const apiKeys = data ? Object.keys(data.response ?? {}) : [];

  const cacheAgeMinutes = cache
    ? Math.round((Date.now() - cache.fetchedAt.getTime()) / 60_000)
    : null;
  const cacheCount = cache
    ? (Array.isArray(cache.payload) ? (cache.payload as unknown[]).length : "not array")
    : null;

  const members = await prisma.familyMembership.findMany({
    where: { status: "active" },
    include: { user: { select: { steamId: true, personaName: true } } },
    take: 10,
  });

  // Simulate getOwnedGames logic
  const TTL_MS = 60 * 60 * 1000;
  const cacheAge = cache ? Date.now() - cache.fetchedAt.getTime() : null;
  const cacheIsFresh = cacheAge !== null && cacheAge < TTL_MS;

  let simulatedResult: string;
  if (cacheIsFresh) {
    simulatedResult = `returns CACHE (${cacheCount} games, ${cacheAgeMinutes}min old)`;
  } else if (apiGames !== null) {
    simulatedResult = `calls API → returns ${apiGames} games (would upsert cache)`;
  } else {
    simulatedResult = `calls API → private/empty → ${cache ? `returns STALE CACHE (${cacheCount} games)` : "returns null"}`;
  }

  const allMembers = await prisma.familyMembership.findMany({
    where: { status: "active" },
    include: { user: { select: { steamId: true, personaName: true } } },
  });
  const uniqueMembers = [...new Map(allMembers.map(m => [m.user.steamId, m.user])).values()];

  const memberDiag = await Promise.all(uniqueMembers.map(async (u) => {
    const c = await prisma.steamUserCache.findUnique({
      where: { userId_type: { userId: u.steamId, type: "library" } },
    });
    const age = c ? Math.round((Date.now() - c.fetchedAt.getTime()) / 60_000) : null;
    const fresh = age !== null && age < 60;
    return { name: u.personaName, steamId: u.steamId, cacheAgeMin: age, cacheFresh: fresh, cacheGames: c ? (Array.isArray(c.payload) ? (c.payload as unknown[]).length : "?") : null };
  }));

  return NextResponse.json({
    target: { steamId, cache: { exists: !!cache, ageMinutes: cacheAgeMinutes, fresh: cacheIsFresh, gameCount: cacheCount }, api: { status: apiStatus, gameCount: apiGames }, simulatedResult },
    allMembers: memberDiag,
  });
}
