import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { getAppDetails } from "@/lib/steam";

export async function GET(_req: NextRequest, { params }: { params: { pledgeId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const pledge = await prisma.pledge.findUnique({
    where: { id: params.pledgeId },
    select: { pledgerUserId: true, paidAt: true },
  });

  if (!pledge) return err("NOT_FOUND", "Pledge not found", 404);
  if (pledge.pledgerUserId !== user.id) return err("FORBIDDEN", "Access denied", 403);

  return ok({ paid: pledge.paidAt !== null });
}
import { refundPayment } from "@/lib/asaas";
import { creditWallet } from "@/lib/wallet";

export async function DELETE(_req: NextRequest, { params }: { params: { pledgeId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const pledge = await prisma.pledge.findUnique({
    where: { id: params.pledgeId },
    include: {
      wishlistItem: {
        include: { family: true },
      },
      pledger: { select: { id: true, personaName: true } },
    },
  });

  if (!pledge) return err("NOT_FOUND", "Pledge not found", 404);

  const isPledger = pledge.pledgerUserId === user.id;
  const isItemOwner = pledge.wishlistItem.ownerUserId === user.id;

  if (!isPledger && !isItemOwner) return err("FORBIDDEN", "Only the pledger or item owner can remove this pledge", 403);
  if (pledge.status !== "active") return err("INVALID_STATE", "Pledge is not active");
  if (pledge.wishlistItem.status === "purchased") return err("INVALID_STATE", "Cannot remove pledge for a purchased item", 400);
  if (pledge.wishlistItem.disbursedAt) return err("INVALID_STATE", "Cannot remove pledge after funds have been disbursed to the owner", 400);

  const steamData = await getAppDetails(pledge.wishlistItem.steamAppId);
  const gameName = steamData?.name ?? `App #${pledge.wishlistItem.steamAppId}`;

  await prisma.$transaction(async (tx) => {
    await tx.pledge.update({
      where: { id: params.pledgeId },
      data: { status: "withdrawn" },
    });

    if (pledge.wishlistItem.status === "funded") {
      await tx.wishlistItem.update({
        where: { id: pledge.wishlistItemId },
        data: { status: "open" },
      });
    }

    if (isPledger) {
      // Voluntary withdrawal: return credits, keep service fee
      if (pledge.creditsCentsUsed > 0) {
        await creditWallet(tx, pledge.pledgerUserId, pledge.creditsCentsUsed, "pledge_withdrawn", pledge.id);
      }
      // Notify item owner
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
    } else {
      // Owner-initiated removal: full refund to pledger wallet (money stays on platform)
      const creditAmount = (pledge.paidAt ? (pledge.pixAmountCents ?? 0) : 0) + pledge.creditsCentsUsed;
      if (creditAmount > 0) {
        await creditWallet(tx, pledge.pledgerUserId, creditAmount, "pledge_removed_by_owner", pledge.id);
      }
      // Notify the pledger
      await createNotification(tx, {
        recipientUserId: pledge.pledgerUserId,
        type: "PLEDGE_WITHDRAWN",
        payload: {
          pledgeId: pledge.id,
          itemId: pledge.wishlistItemId,
          familyId: pledge.wishlistItem.familyId,
          familyName: pledge.wishlistItem.family.name,
          ownerUserId: pledge.wishlistItem.ownerUserId ?? "",
          gameName,
          pledgerId: pledge.pledgerUserId,
          personaName: pledge.pledger.personaName,
          amountCents: pledge.amountCents,
          currency: pledge.wishlistItem.currency,
          removedByOwner: true,
        },
      });
    }
  });

  // PIX bank refund only for voluntary pledger withdrawal (keep service fee)
  if (isPledger) {
    const pixPortion = pledge.amountCents - pledge.creditsCentsUsed;
    if (pledge.paidAt && pledge.pixPaymentId && pixPortion > 0) {
      try {
        await refundPayment(pledge.pixPaymentId, pixPortion);
      } catch (e) {
        console.error("Refund error on pledge withdrawal:", e);
      }
    }
  }

  return ok({ message: "Pledge withdrawn" });
}
