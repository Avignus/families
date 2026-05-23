import { prisma } from "@/lib/prisma";
import { sendPixDisbursement, ASAAS_MIN_CHARGE_CENTS } from "@/lib/asaas";
import { createNotification } from "@/lib/notifications/service";

// After this grace period, a late-registration fee is charged before disbursement
const PIX_KEY_GRACE_DAYS = 7;
// Fee charged when owner registers PIX key after the grace period:
// covers Asaas messaging (R$2.98) + platform margin = R$5.00
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
  if (totalCents < ASAAS_MIN_CHARGE_CENTS) return;

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

  if (disburseCents < ASAAS_MIN_CHARGE_CENTS) {
    console.error(`[disbursement] Amount too low after late fee for item ${wishlistItemId}`);
    return;
  }

  // Pre-authorize before Asaas transfer creation (webhook fires synchronously)
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
