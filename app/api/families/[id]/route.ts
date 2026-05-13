import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAppDetails, getPlayerSummaries } from "@/lib/steam";

const UpdateFamilySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isPublic: z.boolean().optional(),
  description: z.string().max(300).nullable().optional(),
  maxMembers: z.number().int().min(2).max(100).nullable().optional(),
  entryFeeCents: z.number().int().min(0).optional(),
});

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

  // Synchronously refresh any stale "Steam user" names before returning
  const allMembers = [family.chief, ...family.memberships.map((m) => m.user)];
  const stale = allMembers.filter((m) => m.personaName.startsWith("Steam user"));
  if (stale.length > 0) {
    const players = await getPlayerSummaries(stale.map((m) => m.steamId)).catch(() => []);
    await Promise.all(players.map((player) => {
      const member = stale.find((m) => m.steamId === player.steamid);
      if (!member) return;
      member.personaName = player.personaname;
      member.avatarUrl = player.avatar;
      member.avatarMedium = player.avatarmedium;
      return prisma.user.updateMany({
        where: { steamId: player.steamid },
        data: {
          personaName: player.personaname,
          avatarUrl: player.avatar,
          avatarMedium: player.avatarmedium,
          avatarFull: player.avatarfull,
        },
      });
    }));
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the chief can update family settings", 403);

  const body = await parseBody(req, UpdateFamilySchema);
  if (isApiError(body)) return body;

  const updated = await prisma.family.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.maxMembers !== undefined && { maxMembers: body.maxMembers }),
      ...(body.entryFeeCents !== undefined && { entryFeeCents: body.entryFeeCents }),
    },
  });

  return ok(updated);
}
