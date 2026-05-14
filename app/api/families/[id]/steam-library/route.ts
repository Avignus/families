import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOwnedGames, getSteamWishlist, getAppDetails, STEAM_KEY_ERROR } from "@/lib/steam";
import type { SteamAppDetails } from "@/lib/steam";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    select: { isPublic: true },
  });
  if (!family) return err("NOT_FOUND", "Family not found", 404);

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });

  // Allow access if user is an active member, OR if family is public (catalog view)
  if (!family.isPublic && (!membership || membership.status !== "active")) {
    return err("FORBIDDEN", "Not a member of this family", 403);
  }

  const memberships = await prisma.familyMembership.findMany({
    where: { familyId: params.id, status: "active" },
    include: {
      user: { select: { id: true, steamId: true, personaName: true, avatarMedium: true } },
    },
  });

  let steamKeyInvalid = false;

  const members = await Promise.all(
    memberships.map(async ({ user: member }) => {
      const [ownedGamesResult, steamWishlistResult] = await Promise.all([
        getOwnedGames(member.steamId),
        getSteamWishlist(member.steamId),
      ]);

      if (ownedGamesResult === STEAM_KEY_ERROR || steamWishlistResult === STEAM_KEY_ERROR) {
        steamKeyInvalid = true;
      }

      return {
        userId: member.id,
        steamId: member.steamId,
        personaName: member.personaName,
        avatarMedium: member.avatarMedium,
        // null = private profile, array = data (possibly empty)
        ownedGames: ownedGamesResult === STEAM_KEY_ERROR ? null : ownedGamesResult,
        steamWishlist: steamWishlistResult === STEAM_KEY_ERROR ? null : steamWishlistResult,
      };
    })
  );

  // Enrich wishlist games with comingSoon / releaseDate from cache (single batch query)
  const allWishlistAppIds = [
    ...new Set(members.flatMap((m) => m.steamWishlist?.map((g) => g.appId) ?? [])),
  ];
  const appCacheEntries = allWishlistAppIds.length > 0
    ? await prisma.steamAppCache.findMany({
        where: { steamAppId: { in: allWishlistAppIds } },
        select: { steamAppId: true, payload: true },
      })
    : [];
  const appMetaMap = new Map(
    appCacheEntries.map((e) => {
      const p = e.payload as Partial<SteamAppDetails>;
      return [e.steamAppId, { comingSoon: p.comingSoon ?? false, releaseDate: p.releaseDate ?? "", isFree: p.isFree ?? false, priceCents: p.priceCents ?? 0, currency: p.currency ?? "BRL" }];
    })
  );

  // Re-fetch games whose cache entry is missing the comingSoon field (pre-migration entries)
  const cachedPayloads = new Map(appCacheEntries.map((e) => [e.steamAppId, e.payload as Partial<SteamAppDetails>]));
  const staleIds = allWishlistAppIds.filter(
    (id) => cachedPayloads.get(id)?.comingSoon === undefined
  );
  if (staleIds.length > 0) {
    await Promise.allSettled(
      staleIds.map(async (id) => {
        const details = await getAppDetails(id);
        if (details) {
          appMetaMap.set(id, { comingSoon: details.comingSoon, releaseDate: details.releaseDate, isFree: details.isFree, priceCents: details.priceCents, currency: details.currency });
        }
      })
    );
  }

  const enrichedMembers = members.map((m) => ({
    ...m,
    steamWishlist: m.steamWishlist?.map((g) => ({
      ...g,
      ...(appMetaMap.get(g.appId) ?? { comingSoon: false, releaseDate: "", isFree: false, priceCents: 0, currency: "BRL" }),
    })) ?? null,
  }));

  return ok({ members: enrichedMembers, steamKeyInvalid });
}
