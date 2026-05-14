import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { itadWaitlistAdd } from "@/lib/itad";

const AddWishlistSchema = z.object({
  steamAppId: z.number().int().positive(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not an active member of this family", 403);
  }

  const body = await parseBody(req, AddWishlistSchema);
  if (isApiError(body)) return body;

  // Check if game already exists in family
  const existing = await prisma.wishlistItem.findUnique({
    where: { familyId_steamAppId: { familyId: params.id, steamAppId: body.steamAppId } },
    include: { owner: { select: { id: true, personaName: true } } },
  });

  if (existing && existing.status !== "cancelled") {
    return err(
      "GAME_ALREADY_IN_FAMILY",
      existing.owner
        ? `${existing.owner.personaName} já tem este jogo na lista de desejos — você pode contribuir para a cópia dele.`
        : "Este jogo já está na lista de desejos da família.",
      409
    );
  }

  const steamData = await getAppDetails(body.steamAppId);
  if (!steamData) {
    return err("STEAM_APP_NOT_FOUND", "Game not found on Steam", 404);
  }

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);

  const item = await prisma.wishlistItem.create({
    data: {
      familyId: params.id,
      ownerUserId: user.id,
      steamAppId: body.steamAppId,
      targetPriceCents: steamData.priceCents,
      currency: family.currency,
      status: "open",
    },
    include: {
      owner: { select: { id: true, personaName: true, avatarUrl: true } },
    },
  });

  // Best-effort: add to ITAD waitlist so webhook fires on price changes
  itadWaitlistAdd([body.steamAppId]).catch(() => {});

  return ok({ ...item, steamData }, 201);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not an active member of this family", 403);
  }

  const ownerId = req.nextUrl.searchParams.get("ownerId");

  const items = await prisma.wishlistItem.findMany({
    where: {
      familyId: params.id,
      status: { not: "cancelled" },
      ...(ownerId ? { ownerUserId: ownerId } : {}),
    },
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
  });

  const enriched = await Promise.all(
    items.map(async (item) => {
      const steamData = await getAppDetails(item.steamAppId);
      const totalPledged = item.pledges.reduce((s, p) => s + p.amountCents, 0);
      return {
        ...item,
        steamData,
        totalPledgedCents: totalPledged,
        percentFunded: item.targetPriceCents > 0
          ? Math.round((totalPledged / item.targetPriceCents) * 100)
          : 0,
      };
    })
  );

  return ok(enriched);
}
