/**
 * Provider-agnostic webhook business logic.
 * Called by both /api/webhooks/asaas and /api/webhooks/efi after their provider-specific
 * parsing and authentication. Uses lib/payment so disbursements/refunds always go through
 * the active PAYMENT_PROVIDER.
 */
import { prisma } from "@/lib/prisma";
import { refundPayment, sendPixDisbursement } from "@/lib/payment";
import { createNotification } from "@/lib/notifications/service";
import { computeAndSaveReputation } from "@/lib/reputation";
import { maybeDisburseFunds } from "@/lib/disbursement";
import { creditWallet } from "@/lib/wallet";
import { autoDistributeCredits } from "@/lib/auto-distribute";
import { computeAndSaveFamilyReputation } from "@/lib/family-reputation";
import { getOwnedGames } from "@/lib/steam";
import { checkAchievements } from "@/lib/achievements";

const SPOT_COMMISSION_RATE = 0.12;

export async function handleMembershipPayment(
  membershipId: string,
  status: string,
  paymentId: string
): Promise<void> {
  const membership = await prisma.familyMembership.findUnique({
    where: { id: membershipId },
    include: {
      family: {
        select: {
          id: true,
          name: true,
          chiefId: true,
          entryFeeCents: true,
          currency: true,
          autoApprove: true,
        },
      },
      user: { select: { id: true, personaName: true, steamId: true } },
    },
  });
  if (!membership) return;

  await prisma.familyMembership.update({
    where: { id: membership.id },
    data: { pixStatus: status },
  });

  if (status === "approved" && !membership.feePaidAt) {
    // Single-family rule: if user joined another family while payment was pending, reject
    const otherActive = await prisma.familyMembership.findFirst({
      where: {
        userId: membership.userId,
        status: "active",
        familyId: { not: membership.familyId },
      },
      select: { familyId: true },
    });

    if (otherActive) {
      let refunded = false;
      if (membership.pixPaymentId && membership.feeChargedCents && !membership.feeRefundedAt) {
        try {
          await refundPayment(membership.pixPaymentId, membership.feeChargedCents);
          refunded = true;
        } catch (err) {
          console.error("Auto-refund error (single-family rule):", err);
        }
      }
      await prisma.$transaction(async (tx) => {
        await tx.familyMembership.update({
          where: { id: membership.id },
          data: {
            status: "rejected",
            pixStatus: "rejected",
            ...(refunded ? { feeRefundedAt: new Date() } : {}),
          },
        });
        const refundAmountFormatted = membership.feeChargedCents
          ? new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: membership.family.currency,
            }).format(membership.feeChargedCents / 100)
          : null;
        await createNotification(tx, {
          recipientUserId: membership.userId,
          type: "JOIN_REJECTED",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
            refunded,
            refundAmountFormatted,
          },
        });
      });
      return;
    }

    if (membership.family.autoApprove) {
      await prisma.$transaction(async (tx) => {
        const activated = await tx.familyMembership.updateMany({
          where: { id: membership.id, feePaidAt: null },
          data: { status: "active", feePaidAt: new Date(), joinedAt: new Date() },
        });
        if (activated.count === 0) return;

        await createNotification(tx, {
          recipientUserId: membership.family.chiefId,
          type: "JOIN_FEE_PAID",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
            memberId: membership.userId,
            personaName: membership.user.personaName,
          },
        });
        await createNotification(tx, {
          recipientUserId: membership.userId,
          type: "JOIN_APPROVED",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
          },
        });
      });

      const activated = await prisma.familyMembership.findUnique({
        where: { id: membership.id },
        select: { feePaidAt: true },
      });
      if (!activated?.feePaidAt) return;

      getOwnedGames(membership.user.steamId).catch(() => {});

      const chief = await prisma.user.findUnique({
        where: { id: membership.family.chiefId },
        select: { pixKey: true },
      });
      if (membership.family.entryFeeCents > 0) {
        if (chief?.pixKey) {
          await sendPixDisbursement({
            amountCents: membership.family.entryFeeCents,
            pixKey: chief.pixKey,
            description: `Families — Taxa de entrada em ${membership.family.name}`,
          }).catch((err) => console.error("Entry fee disbursement error:", err));
        } else {
          await prisma.$transaction(async (tx) => {
            await tx.user.update({
              where: { id: membership.family.chiefId },
              data: { chiefSpotEarningsCents: { increment: membership.family.entryFeeCents } },
            });
            await createNotification(tx, {
              recipientUserId: membership.family.chiefId,
              type: "ENTRY_FEE_HELD",
              payload: {
                familyId: membership.family.id,
                familyName: membership.family.name,
                amountCents: membership.family.entryFeeCents,
                currency: membership.family.currency,
                memberName: membership.user.personaName,
              },
            });
          });
        }
      }
    } else {
      await prisma.$transaction(async (tx) => {
        const marked = await tx.familyMembership.updateMany({
          where: { id: membership.id, feePaidAt: null },
          data: { feePaidAt: new Date() },
        });
        if (marked.count === 0) return;

        const amountFormatted = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: membership.family.currency,
        }).format((membership.feeChargedCents ?? membership.family.entryFeeCents) / 100);

        await createNotification(tx, {
          recipientUserId: membership.family.chiefId,
          type: "JOIN_PAYMENT_AWAITING_APPROVAL",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
            memberId: membership.userId,
            personaName: membership.user.personaName,
            amountFormatted,
          },
        });
      });
    }
  }

  if (status === "rejected" || status === "cancelled") {
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { status: "rejected" },
    });
  }

  void paymentId; // used for idempotency in callers if needed
}

export async function handleSpotPayment(
  membershipId: string,
  status: string,
  paymentId: string
): Promise<void> {
  const membership = await prisma.familyMembership.findUnique({
    where: { id: membershipId },
    include: {
      family: {
        select: {
          id: true,
          name: true,
          chiefId: true,
          entryFeeCents: true,
          currency: true,
          autoApprove: true,
        },
      },
      user: { select: { id: true, personaName: true, steamId: true } },
    },
  });
  if (!membership) return;

  await prisma.familyMembership.update({
    where: { id: membership.id },
    data: { pixStatus: status },
  });

  if (status === "approved" && !membership.feePaidAt) {
    const otherActive = await prisma.familyMembership.findFirst({
      where: {
        userId: membership.userId,
        status: "active",
        familyId: { not: membership.familyId },
      },
      select: { familyId: true },
    });

    if (otherActive) {
      let refunded = false;
      if (membership.pixPaymentId && membership.feeChargedCents && !membership.feeRefundedAt) {
        try {
          await refundPayment(membership.pixPaymentId, membership.feeChargedCents);
          refunded = true;
        } catch (err) {
          console.error("Auto-refund error (single-family rule, spot):", err);
        }
      }
      await prisma.$transaction(async (tx) => {
        await tx.familyMembership.update({
          where: { id: membership.id },
          data: {
            status: "rejected",
            pixStatus: "rejected",
            ...(refunded ? { feeRefundedAt: new Date() } : {}),
          },
        });
        const refundAmountFormatted = membership.feeChargedCents
          ? new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: membership.family.currency,
            }).format(membership.feeChargedCents / 100)
          : null;
        await createNotification(tx, {
          recipientUserId: membership.userId,
          type: "JOIN_REJECTED",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
            refunded,
            refundAmountFormatted,
          },
        });
      });
      return;
    }

    if (membership.family.autoApprove) {
      const spotExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      await prisma.$transaction(async (tx) => {
        const activated = await tx.familyMembership.updateMany({
          where: { id: membership.id, feePaidAt: null },
          data: { status: "active", feePaidAt: new Date(), joinedAt: new Date(), spotExpiresAt },
        });
        if (activated.count === 0) return;

        await createNotification(tx, {
          recipientUserId: membership.family.chiefId,
          type: "JOIN_FEE_PAID",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
            memberId: membership.userId,
            personaName: membership.user.personaName,
          },
        });
        await createNotification(tx, {
          recipientUserId: membership.userId,
          type: "JOIN_APPROVED",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
          },
        });
      });

      const activated = await prisma.familyMembership.findUnique({
        where: { id: membership.id },
        select: { feePaidAt: true },
      });
      if (!activated?.feePaidAt) return;

      getOwnedGames(membership.user.steamId).catch(() => {});

      if (membership.feeChargedCents && membership.feeChargedCents > 0) {
        const chiefAmountCents = Math.floor(
          membership.feeChargedCents * (1 - SPOT_COMMISSION_RATE)
        );
        if (chiefAmountCents > 0) {
          await prisma.user.update({
            where: { id: membership.family.chiefId },
            data: { chiefSpotEarningsCents: { increment: chiefAmountCents } },
          });
        }
      }
    } else {
      await prisma.$transaction(async (tx) => {
        const marked = await tx.familyMembership.updateMany({
          where: { id: membership.id, feePaidAt: null },
          data: { feePaidAt: new Date() },
        });
        if (marked.count === 0) return;

        const amountFormatted = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: membership.family.currency,
        }).format((membership.feeChargedCents ?? 0) / 100);

        await createNotification(tx, {
          recipientUserId: membership.family.chiefId,
          type: "JOIN_PAYMENT_AWAITING_APPROVAL",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
            memberId: membership.userId,
            personaName: membership.user.personaName,
            amountFormatted,
          },
        });
      });
    }
  }

  if (status === "rejected" || status === "cancelled") {
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { status: "rejected" },
    });
  }

  void paymentId;
}

export async function handleCreditsPayment(
  userId: string,
  status: string,
  paymentId: string,
  amountCents: number
): Promise<void> {
  if (status !== "approved") return;
  if (amountCents <= 0) return;

  const alreadyProcessed = await prisma.walletTransaction.findFirst({
    where: { userId, reason: "topup", pledgeId: paymentId },
  });
  if (!alreadyProcessed) {
    await prisma.$transaction(async (tx) => {
      await creditWallet(tx, userId, amountCents, "topup", paymentId);
      await createNotification(tx, {
        recipientUserId: userId,
        type: "CREDITS_ADDED",
        payload: { amountCents, currency: "BRL" },
      });
    });
  }

  const membership = await prisma.familyMembership.findFirst({
    where: {
      userId,
      status: "active",
      autoDistributeEnabled: true,
      monthlyBudgetCents: { gt: 0 },
    },
    select: { monthlyBudgetCents: true },
  });
  if (membership) {
    const budget = Math.min(membership.monthlyBudgetCents, amountCents);
    await autoDistributeCredits(userId, budget).catch((err) =>
      console.error("Auto-distribute error after top-up:", err)
    );
  }
}

export async function handlePledgePayment(
  pledgeId: string,
  paymentId: string,
  status: string
): Promise<void> {
  const pledge = await prisma.pledge.findUnique({
    where: { id: pledgeId },
    include: {
      wishlistItem: { include: { family: true, owner: true } },
      pledger: true,
    },
  });
  if (!pledge) return;

  await prisma.$transaction(async (tx) => {
    const updates: Record<string, unknown> = { pixStatus: status };

    if (status === "approved" && !pledge.paidAt) {
      updates.paidAt = new Date();

      const paidAggregate = await tx.pledge.aggregate({
        where: {
          wishlistItemId: pledge.wishlistItemId,
          status: "active",
          paidAt: { not: null },
        },
        _sum: { amountCents: true },
      });
      const totalPaid = (paidAggregate._sum.amountCents ?? 0) + pledge.amountCents;
      if (
        totalPaid >= pledge.wishlistItem.targetPriceCents &&
        pledge.wishlistItem.status === "open"
      ) {
        await tx.wishlistItem.update({
          where: { id: pledge.wishlistItemId },
          data: { status: "funded" },
        });
      }

      if (
        pledge.wishlistItem.ownerUserId &&
        pledge.wishlistItem.ownerUserId !== pledge.pledgerUserId
      ) {
        const steamData = await import("@/lib/steam").then((m) =>
          m.getAppDetails(pledge.wishlistItem.steamAppId)
        );
        const gameName = steamData?.name ?? `App #${pledge.wishlistItem.steamAppId}`;

        await createNotification(tx, {
          recipientUserId: pledge.wishlistItem.ownerUserId,
          type: "PLEDGE_RECEIVED",
          payload: {
            pledgeId: pledge.id,
            itemId: pledge.wishlistItemId,
            familyId: pledge.wishlistItem.familyId,
            familyName: pledge.wishlistItem.family.name,
            ownerUserId: pledge.wishlistItem.ownerUserId,
            gameName,
            pledgerId: pledge.pledgerUserId,
            personaName: pledge.pledger.personaName,
            amountCents: pledge.amountCents,
            currency: pledge.wishlistItem.currency,
            percent: Math.round(
              (pledge.amountCents / pledge.wishlistItem.targetPriceCents) * 100
            ),
            paymentConfirmed: true,
          },
        });
      }
    }

    if (status === "rejected" || status === "cancelled") {
      updates.status = "withdrawn";
      if (pledge.wishlistItem.status === "funded") {
        await tx.wishlistItem.update({
          where: { id: pledge.wishlistItemId },
          data: { status: "open" },
        });
      }
    }

    await tx.pledge.update({ where: { id: pledge.id }, data: updates });
  });

  if (status === "approved") {
    await computeAndSaveReputation(pledge.pledgerUserId).catch(() => {});
    await computeAndSaveFamilyReputation(pledge.wishlistItem.familyId).catch(() => {});
    await maybeDisburseFunds(pledge.wishlistItemId);
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 3) {
      checkAchievements(pledge.pledgerUserId, { type: "pix_paid_at_night" }).catch(() => {});
    }
    checkAchievements(pledge.pledgerUserId, { type: "pledge_paid", pledgeId: pledge.id }).catch(
      () => {}
    );
  }

  void paymentId;
}
