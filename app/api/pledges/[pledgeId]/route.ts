import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { getAppDetails } from "@/lib/steam";

export async function DELETE(_req: NextRequest, { params }: { params: { pledgeId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const pledge = await prisma.pledge.findUnique({
    where: { id: params.pledgeId },
    include: {
      wishlistItem: {
        include: { family: true },
      },
    },
  });

  if (!pledge) return err("NOT_FOUND", "Pledge not found", 404);
  if (pledge.pledgerUserId !== user.id) return err("FORBIDDEN", "Only the pledger can withdraw their pledge", 403);
  if (pledge.status !== "active") return err("INVALID_STATE", "Pledge is not active");

  const steamData = await getAppDetails(pledge.wishlistItem.steamAppId);
  const gameName = steamData?.name ?? `App #${pledge.wishlistItem.steamAppId}`;

  await prisma.$transaction(async (tx) => {
    await tx.pledge.update({
      where: { id: params.pledgeId },
      data: { status: "withdrawn" },
    });

    // If item was funded, downgrade back to open
    if (pledge.wishlistItem.status === "funded") {
      await tx.wishlistItem.update({
        where: { id: pledge.wishlistItemId },
        data: { status: "open" },
      });
    }

    if (pledge.wishlistItem.ownerUserId) {
      await createNotification(tx, {
        recipientUserId: pledge.wishlistItem.ownerUserId,
        type: "PLEDGE_WITHDRAWN",
        payload: {
          pledgeId: pledge.id,
          itemId: pledge.wishlistItemId,
          familyId: pledge.wishlistItem.familyId,
          familyName: pledge.wishlistItem.family.name,
          ownerUserId: pledge.wishlistItem.ownerUserId,
          gameName,
          pledgerId: user.id,
          personaName: user.personaName,
          amountCents: pledge.amountCents,
          currency: pledge.wishlistItem.currency,
        },
      });
    }
  });

  return ok({ message: "Pledge withdrawn" });
}
