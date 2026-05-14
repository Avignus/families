import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { creditWallet } from "@/lib/wallet";

export async function PATCH(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const item = await prisma.wishlistItem.findUnique({ where: { id: params.itemId } });
  if (!item) return err("NOT_FOUND", "Wishlist item not found", 404);
  if (item.ownerUserId !== user.id) return err("FORBIDDEN", "Only the owner can update this item", 403);
  if (item.targetPriceCents !== 0) return err("PRICE_ALREADY_SET", "Preço já definido", 400);

  const steamData = await getAppDetails(item.steamAppId);
  if (!steamData || steamData.priceCents === 0) {
    return err("PRICE_UNAVAILABLE", "Preço ainda não disponível na Steam. Tente novamente mais tarde.", 422);
  }

  const updated = await prisma.wishlistItem.update({
    where: { id: params.itemId },
    data: { targetPriceCents: steamData.priceCents },
  });

  return ok({ targetPriceCents: updated.targetPriceCents });
}

export async function DELETE(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const item = await prisma.wishlistItem.findUnique({
    where: { id: params.itemId },
    include: {
      pledges: { where: { status: "active" } },
    },
  });

  if (!item) return err("NOT_FOUND", "Wishlist item not found", 404);
  if (item.ownerUserId !== user.id) return err("FORBIDDEN", "Only the owner can remove this item", 403);
  if (item.disbursedAt) return err("INVALID_STATE", "Cannot remove item after funds have been disbursed", 400);

  await prisma.$transaction(async (tx) => {
    await tx.pledge.updateMany({
      where: { wishlistItemId: params.itemId, status: "active" },
      data: { status: "withdrawn" },
    });
    await tx.wishlistItem.update({
      where: { id: params.itemId },
      data: { status: "cancelled" },
    });

    // Credit each pledger's wallet — full refund (PIX portion + credits used + service fee)
    // since this is a platform-initiated cancellation, not the pledger's choice
    for (const pledge of item.pledges) {
      const paidViaPix = pledge.paidAt && pledge.mpAmountCents;
      const creditAmount = (paidViaPix ? (pledge.mpAmountCents ?? 0) : 0) + pledge.creditsCentsUsed;
      if (creditAmount > 0) {
        await creditWallet(tx, pledge.pledgerUserId, creditAmount, "item_cancelled", pledge.id);
      }
    }
  });

  return ok({ message: "Wishlist item removed" });
}
