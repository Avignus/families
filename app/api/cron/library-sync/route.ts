import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

const STEAM_API_KEY = process.env.STEAM_API_KEY ?? "";
const SNAPSHOT_TYPE = "library-notified";

type OwnedGame = { appId: number; name: string; playtimeMinutes: number };

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return false;
  if (process.env.NODE_ENV === "production" && !req.headers.get("x-vercel-cron")) return false;
  return true;
}

async function fetchLibraryFromSteam(steamId: string): Promise<OwnedGame[] | null> {
  try {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.response?.games) return null;
    return data.response.games.map((g: { appid: number; name: string; playtime_forever?: number }) => ({
      appId: g.appid,
      name: g.name,
      playtimeMinutes: g.playtime_forever ?? 0,
    }));
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  // Load all users who are active members of at least one family
  const members = await prisma.familyMembership.findMany({
    where: { status: "active" },
    select: {
      userId: true,
      familyId: true,
      family: { select: { id: true, name: true } },
      user: { select: { id: true, steamId: true, personaName: true } },
    },
  });

  // Group: userId → { user, families[] }
  const userMap = new Map<string, {
    user: { id: string; steamId: string; personaName: string };
    families: { id: string; name: string }[];
  }>();
  for (const m of members) {
    const existing = userMap.get(m.userId);
    if (existing) {
      existing.families.push(m.family);
    } else {
      userMap.set(m.userId, { user: m.user, families: [m.family] });
    }
  }

  // For each family, build a set of member userIds for quick lookup
  const familyMembersMap = new Map<string, string[]>();
  for (const m of members) {
    const list = familyMembersMap.get(m.familyId) ?? [];
    list.push(m.userId);
    familyMembersMap.set(m.familyId, list);
  }

  let notified = 0;
  let skipped = 0;
  let initialised = 0;
  let errors = 0;

  for (const [userId, { user, families }] of userMap) {
    if (!user.steamId) continue;

    const currentLibrary = await fetchLibraryFromSteam(user.steamId);
    if (!currentLibrary) { errors++; continue; }

    // Update the regular library cache while we're at it
    await prisma.steamUserCache.upsert({
      where: { userId_type: { userId: user.steamId, type: "library" } },
      update: { payload: currentLibrary as unknown as object, fetchedAt: new Date() },
      create: { userId: user.steamId, type: "library", payload: currentLibrary as unknown as object },
    });

    // Read the notification snapshot (what we last notified about)
    const snapshot = await prisma.steamUserCache.findUnique({
      where: { userId_type: { userId: user.steamId, type: SNAPSHOT_TYPE } },
    });

    if (!snapshot) {
      // First run for this user — initialise snapshot without notifying
      await prisma.steamUserCache.create({
        data: { userId: user.steamId, type: SNAPSHOT_TYPE, payload: currentLibrary as unknown as object },
      });
      initialised++;
      continue;
    }

    const previousAppIds = new Set((snapshot.payload as unknown as OwnedGame[]).map((g) => g.appId));
    const newGames = currentLibrary.filter((g) => !previousAppIds.has(g.appId));

    if (newGames.length === 0) { skipped++; continue; }

    // Update snapshot with current library
    await prisma.steamUserCache.update({
      where: { userId_type: { userId: user.steamId, type: SNAPSHOT_TYPE } },
      data: { payload: currentLibrary as unknown as object, fetchedAt: new Date() },
    });

    // Notify all family members (excluding the buyer) for each new game
    for (const game of newGames) {
      for (const family of families) {
        const memberIds = familyMembersMap.get(family.id) ?? [];
        const recipients = memberIds.filter((id) => id !== userId);
        for (const recipientId of recipients) {
          await createNotification(prisma, {
            recipientUserId: recipientId,
            type: "MEMBER_BOUGHT_GAME",
            payload: {
              buyerUserId: userId,
              personaName: user.personaName,
              gameName: game.name,
              familyId: family.id,
              familyName: family.name,
            },
          });
          notified++;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, notified, skipped, initialised, errors });
}
