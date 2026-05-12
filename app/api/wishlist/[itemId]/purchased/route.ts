import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { getAppDetails } from "@/lib/steam";

export async function POST(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const item = await prisma.wishlistItem.findUnique({
    where: { id: params.itemId },
    include: {
      family: true,
      pledges: { where: { status: "active" }, select: { pledgerUserId: true } },
    },
  });

  if (!item) return err("NOT_FOUND", "Wishlist item not found", 404);

  const isOwner = item.ownerUserId === user.id;
  const isChief = item.family.chiefId === user.id;
  if (!isOwner && !isChief) {
    return err("FORBIDDEN", "Only the item owner or family chief can mark as purchased", 403);
  }

  if (item.status === "purchased") return err("ALREADY_PURCHASED", "Item is already marked as purchased");

  const steamData = await getAppDetails(item.steamAppId);
  const gameName = steamData?.name ?? `App #${item.steamAppId}`;

  const pledgerIds = [...new Set(item.pledges.map((p) => p.pledgerUserId))];

  await prisma.$transaction(async (tx) => {
    await tx.wishlistItem.update({
      where: { id: params.itemId },
      data: { status: "purchased" },
    });

    await tx.pledge.updateMany({
      where: { wishlistItemId: params.itemId, status: "active" },
      data: { status: "settled" },
    });

    // Notify all pledgers + owner
    const notifyIds = new Set([...pledgerIds]);
    if (item.ownerUserId && item.ownerUserId !== user.id) notifyIds.add(item.ownerUserId);

    for (const recipientId of notifyIds) {
      await createNotification(tx, {
        recipientUserId: recipientId,
        type: "ITEM_PURCHASED",
        payload: {
          itemId: params.itemId,
          familyId: item.familyId,
          familyName: item.family.name,
          ownerUserId: item.ownerUserId,
          gameName,
          currency: item.currency,
        },
      });
    }
  });

  return ok({ message: "Item marked as purchased" });
}
