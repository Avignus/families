import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAppDetails, getPlayerSummaries } from "@/lib/steam";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      chief: { select: { id: true, steamId: true, personaName: true, avatarUrl: true, avatarMedium: true } },
      memberships: {
        where: { status: "active" },
        include: {
          user: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true, steamId: true } },
        },
      },
      wishlistItems: {
        where: { status: { not: "cancelled" } },
        include: {
          owner: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } },
          pledges: {
            where: { status: "active" },
            include: {
              pledger: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      votes: {
        where: { status: "open" },
        include: {
          openedBy: { select: { id: true, personaName: true } },
          ballots: { include: { user: { select: { id: true, personaName: true } } } },
        },
        orderBy: { closesAt: "asc" },
      },
    },
  });

  if (!family) return err("NOT_FOUND", "Family not found", 404);

  // Refresh stale Steam names in the background (fire-and-forget)
  const allMembers = [
    family.chief,
    ...family.memberships.map((m) => m.user),
  ];
  const stale = allMembers.filter((m) => m.personaName.startsWith("Steam user"));
  if (stale.length > 0) {
    getPlayerSummaries(stale.map((m) => m.steamId)).then(async (players) => {
      await Promise.all(players.map((player) =>
        prisma.user.updateMany({
          where: { steamId: player.steamid, personaName: { startsWith: "Steam user" } },
          data: {
            personaName: player.personaname,
            avatarUrl: player.avatar,
            avatarMedium: player.avatarmedium,
            avatarFull: player.avatarfull,
          },
        })
      ));
    }).catch(() => {});
  }

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not a member of this family", 403);
  }

  // Enrich wishlist items with cached Steam data
  const enrichedItems = await Promise.all(
    family.wishlistItems.map(async (item) => {
      const steamData = await getAppDetails(item.steamAppId);
      const totalPledged = item.pledges.reduce((s, p) => s + p.amountCents, 0);
      return {
        ...item,
        steamData,
        totalPledgedCents: totalPledged,
        percentFunded: item.targetPriceCents > 0
          ? Math.round((totalPledged / item.targetPriceCents) * 100)
          : 0,
        pledges: item.pledges.map((p) => ({
          ...p,
          percent: item.targetPriceCents > 0
            ? Math.round((p.amountCents / item.targetPriceCents) * 100)
            : 0,
        })),
      };
    })
  );

  return ok({
    ...family,
    wishlistItems: enrichedItems,
    isChief: family.chiefId === user.id,
    currentUserId: user.id,
  });
}
