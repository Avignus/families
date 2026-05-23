import { prisma } from "@/lib/prisma";
import { sendPixDisbursement, ASAAS_MIN_CHARGE_CENTS } from "@/lib/asaas";
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
  // Don't disburse if below the minimum — Asaas charges R$1.99/transfer regardless
  if (totalCents < ASAAS_MIN_CHARGE_CENTS) return;

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

  // Pre-authorize: mark item as pending disbursement BEFORE calling Asaas.
  // The transfer-auth webhook fires synchronously during transfer creation,
  // so disbursementId must exist in DB before sendPixDisbursement is called.
  const pendingId = `pending:${wishlistItemId}`;
  await prisma.wishlistItem.update({
    where: { id: wishlistItemId },
    data: { disbursementId: pendingId },
  });

  try {
    const transferId = await sendPixDisbursement({
      amountCents: totalCents,
      pixKey: owner.pixKey,
      description: `Families — ${gameName}`,
    });

    await prisma.$transaction(async (tx) => {
      await tx.wishlistItem.update({
        where: { id: wishlistItemId },
        data: { disbursedAt: new Date(), disbursementId: transferId },
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
    // Roll back the pending marker so it can be retried
    await prisma.wishlistItem.update({
      where: { id: wishlistItemId },
      data: { disbursementId: null },
    }).catch(() => {});
    console.error("Disbursement error:", err);
  }
}
