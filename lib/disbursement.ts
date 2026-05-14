import { prisma } from "@/lib/prisma";
import { sendPixDisbursement } from "@/lib/asaas";
import { createNotification } from "@/lib/notifications/service";

export async function maybeDisburseFunds(wishlistItemId: string): Promise<void> {
  const item = await prisma.wishlistItem.findUnique({
    where: { id: wishlistItemId },
    include: { owner: true },
  });

  if (!item || item.disbursedAt || item.status !== "funded") return;
  if (!item.ownerUserId || !item.owner) return;

  const unpaid = await prisma.pledge.count({
    where: { wishlistItemId, status: "active", paidAt: null },
  });
  if (unpaid > 0) return;

  const aggregate = await prisma.pledge.aggregate({
    where: { wishlistItemId, status: "active" },
    _sum: { amountCents: true },
  });
  const totalCents = aggregate._sum.amountCents ?? 0;
  if (totalCents <= 0) return;

  const owner = item.owner;
  const steamData = await import("@/lib/steam").then((m) => m.getAppDetails(item.steamAppId));
  const gameName = steamData?.name ?? `App #${item.steamAppId}`;

  if (!owner.pixKey) {
    await prisma.$transaction(async (tx) => {
      await createNotification(tx, {
        recipientUserId: owner.id,
        type: "PIX_KEY_REQUIRED",
        payload: {
          itemId: wishlistItemId,
          familyId: item.familyId,
          gameName,
          amountCents: totalCents,
          currency: item.currency,
        },
      });
    });
    return;
  }

  try {
    const transferId = await sendPixDisbursement({
      amountCents: totalCents,
      pixKey: owner.pixKey,
      description: `Families — ${gameName}`,
    });

    await prisma.$transaction(async (tx) => {
      await tx.wishlistItem.update({
        where: { id: wishlistItemId },
        data: { disbursedAt: new Date(), disbursementMpId: transferId },
      });
      await createNotification(tx, {
        recipientUserId: owner.id,
        type: "DISBURSEMENT_SENT",
        payload: {
          itemId: wishlistItemId,
          familyId: item.familyId,
          gameName,
          amountCents: totalCents,
          currency: item.currency,
          transferId,
        },
      });
    });
  } catch (err) {
    console.error("Disbursement error:", err);
  }
}
