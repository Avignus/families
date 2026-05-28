import { prisma } from "@/lib/prisma";
import { sendPixDisbursement, MIN_CHARGE_CENTS } from "@/lib/payment";
import { createNotification } from "@/lib/notifications/service";

const PIX_KEY_GRACE_DAYS = 7;
export const LATE_REGISTRATION_FEE_CENTS = 500;

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
  if (totalCents < MIN_CHARGE_CENTS) return;

  const owner = item.owner;
  const steamData = await import("@/lib/steam").then((m) => m.getAppDetails(item.steamAppId));
  const gameName = steamData?.name ?? `App #${item.steamAppId}`;

  if (!owner.pixKey) {
    // Only send the notification once — check if deadline is already set
    if (!item.pixKeyDeadlineAt) {
      const deadline = new Date(Date.now() + PIX_KEY_GRACE_DAYS * 24 * 60 * 60 * 1000);
      await prisma.$transaction(async (tx) => {
        await tx.wishlistItem.update({
          where: { id: wishlistItemId },
          data: { pixKeyDeadlineAt: deadline, pixKeyReminderLevel: 1 },
        });
        await createNotification(tx, {
          recipientUserId: owner.id,
          type: "PIX_KEY_REQUIRED",
          payload: {
            itemId: wishlistItemId,
            familyId: item.familyId,
            gameName,
            amountCents: totalCents,
            currency: item.currency,
            deadlineAt: deadline.toISOString(),
            graceDays: PIX_KEY_GRACE_DAYS,
          },
        });
      });
    }
    return;
  }

  // Determine if the late-registration fee applies
  const isLate = item.pixKeyDeadlineAt && new Date() > item.pixKeyDeadlineAt;
  const disburseCents = isLate
    ? Math.max(0, totalCents - LATE_REGISTRATION_FEE_CENTS)
    : totalCents;

  if (disburseCents < MIN_CHARGE_CENTS) {
    console.error(`[disbursement] Amount too low after late fee for item ${wishlistItemId}`);
    return;
  }

  const pendingId = `pending:${wishlistItemId}`;
  await prisma.wishlistItem.update({
    where: { id: wishlistItemId },
    data: { disbursementId: pendingId },
  });

  try {
    const description = isLate
      ? `Families — ${gameName} (repasse com atraso)`
      : `Families — ${gameName}`;

    const transferId = await sendPixDisbursement({
      amountCents: disburseCents,
      pixKey: owner.pixKey,
      description,
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
          amountCents: disburseCents,
          currency: item.currency,
          transferId,
          ...(isLate ? { lateFeeCents: LATE_REGISTRATION_FEE_CENTS } : {}),
        },
      });
    });
  } catch (err) {
    await prisma.wishlistItem.update({
      where: { id: wishlistItemId },
      data: { disbursementId: null },
    }).catch(() => {});
    console.error("Disbursement error:", err);
  }
}
