import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";

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

  if (item.pledges.length > 0) {
    // Cascade: cancel pledges and notify pledgers
    const pledgerIds = [...new Set(item.pledges.map((p) => p.pledgerUserId))];
    await prisma.$transaction(async (tx) => {
      await tx.pledge.updateMany({
        where: { wishlistItemId: params.itemId, status: "active" },
        data: { status: "withdrawn" },
      });
      await tx.wishlistItem.update({
        where: { id: params.itemId },
        data: { status: "cancelled" },
      });
    });
  } else {
    await prisma.wishlistItem.update({
      where: { id: params.itemId },
      data: { status: "cancelled" },
    });
  }

  return ok({ message: "Wishlist item removed" });
}
