import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeAsaasStatus, sendPixDisbursement, refundPayment } from "@/lib/asaas";
import { createNotification } from "@/lib/notifications/service";
import { computeAndSaveReputation } from "@/lib/reputation";
import { maybeDisburseFunds } from "@/lib/disbursement";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // Verify webhook origin via authToken configured in Asaas webhook settings
  const token = req.headers.get("asaas-access-token") ?? "";
  const expectedToken = process.env.ASAAS_WEBHOOK_SECRET ?? "";
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const paymentData = body.payment;
  if (!paymentData?.id) return NextResponse.json({ ok: true });

  const status = normalizeAsaasStatus(paymentData.status ?? "");
  const paymentId: string = paymentData.id;
  const externalRef: string = paymentData.externalReference ?? "";

  // Route to membership or pledge handler based on externalReference prefix
  if (externalRef.startsWith("membership:")) {
    const membershipId = externalRef.replace("membership:", "");
    const membership = await prisma.familyMembership.findUnique({
      where: { id: membershipId },
      include: {
        family: { select: { id: true, name: true, chiefId: true, entryFeeCents: true, currency: true } },
        user: { select: { id: true, personaName: true } },
      },
    });
    if (membership) await handleMembershipPayment(membership, status);
    return NextResponse.json({ ok: true });
  }

  if (externalRef.startsWith("spot:")) {
    const membershipId = externalRef.replace("spot:", "");
    const membership = await prisma.familyMembership.findUnique({
      where: { id: membershipId },
      include: {
        family: { select: { id: true, name: true, chiefId: true, entryFeeCents: true, currency: true } },
        user: { select: { id: true, personaName: true } },
      },
    });
    if (membership) await handleSpotPayment(membership, status);
    return NextResponse.json({ ok: true });
  }

  if (externalRef.startsWith("pledge:")) {
    const pledgeId = externalRef.replace("pledge:", "");
    await handlePledgePayment(pledgeId, paymentId, status);
  }

  return NextResponse.json({ ok: true });
}

type MembershipWithFamily = {
  id: string;
  userId: string;
  familyId: string;
  mpPaymentId: string | null;
  mpStatus: string | null;
  feePaidAt: Date | null;
  feeChargedCents: number | null;
  feeRefundedAt: Date | null;
  family: { id: string; name: string; chiefId: string; entryFeeCents: number; currency: string };
  user: { id: string; personaName: string };
};

async function handleMembershipPayment(membership: MembershipWithFamily, status: string) {
  await prisma.familyMembership.update({
    where: { id: membership.id },
    data: { mpStatus: status },
  });

  if (status === "approved" && !membership.feePaidAt) {
    // Single-family rule: if user joined another family while payment was pending, reject
    const otherActive = await prisma.familyMembership.findFirst({
      where: { userId: membership.userId, status: "active", familyId: { not: membership.familyId } },
      select: { familyId: true },
    });
    if (otherActive) {
      let refunded = false;
      if (membership.mpPaymentId && membership.feeChargedCents && !membership.feeRefundedAt) {
        try {
          await refundPayment(membership.mpPaymentId, membership.feeChargedCents);
          refunded = true;
        } catch (refundErr) {
          console.error("Auto-refund error (single-family rule):", refundErr);
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.familyMembership.update({
          where: { id: membership.id },
          data: {
            status: "rejected",
            mpStatus: "rejected",
            ...(refunded ? { feeRefundedAt: new Date() } : {}),
          },
        });
        const refundAmountFormatted = membership.feeChargedCents
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: membership.family.currency })
              .format(membership.feeChargedCents / 100)
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

    await prisma.$transaction(async (tx) => {
      await tx.familyMembership.update({
        where: { id: membership.id },
        data: { status: "active", feePaidAt: new Date(), joinedAt: new Date() },
      });
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
        payload: { familyId: membership.family.id, familyName: membership.family.name },
      });
    });

    // Disburse entry fee to chief
    const chief = await prisma.user.findUnique({
      where: { id: membership.family.chiefId },
      select: { pixKey: true },
    });
    if (chief?.pixKey && membership.family.entryFeeCents > 0) {
      await sendPixDisbursement({
        amountCents: membership.family.entryFeeCents,
        pixKey: chief.pixKey,
        description: `Families — Taxa de entrada em ${membership.family.name}`,
      }).catch((err) => console.error("Entry fee disbursement error:", err));
    }
  }

  if (status === "rejected" || status === "cancelled") {
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { status: "rejected" },
    });
  }
}

const SPOT_COMMISSION_RATE = 0.12; // platform keeps 12%, chief receives 88%

async function handleSpotPayment(membership: MembershipWithFamily, status: string) {
  await prisma.familyMembership.update({
    where: { id: membership.id },
    data: { mpStatus: status },
  });

  if (status === "approved" && !membership.feePaidAt) {
    const otherActive = await prisma.familyMembership.findFirst({
      where: { userId: membership.userId, status: "active", familyId: { not: membership.familyId } },
      select: { familyId: true },
    });
    if (otherActive) {
      let refunded = false;
      if (membership.mpPaymentId && membership.feeChargedCents && !membership.feeRefundedAt) {
        try {
          await refundPayment(membership.mpPaymentId, membership.feeChargedCents);
          refunded = true;
        } catch (refundErr) {
          console.error("Auto-refund error (single-family rule, spot):", refundErr);
        }
      }
      await prisma.$transaction(async (tx) => {
        await tx.familyMembership.update({
          where: { id: membership.id },
          data: {
            status: "rejected",
            mpStatus: "rejected",
            ...(refunded ? { feeRefundedAt: new Date() } : {}),
          },
        });
        const refundAmountFormatted = membership.feeChargedCents
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: membership.family.currency })
              .format(membership.feeChargedCents / 100)
          : null;
        await createNotification(tx, {
          recipientUserId: membership.userId,
          type: "JOIN_REJECTED",
          payload: { familyId: membership.family.id, familyName: membership.family.name, refunded, refundAmountFormatted },
        });
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.familyMembership.update({
        where: { id: membership.id },
        data: { status: "active", feePaidAt: new Date(), joinedAt: new Date() },
      });
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
        payload: { familyId: membership.family.id, familyName: membership.family.name },
      });
    });

    // Disburse 88% to chief (platform retains 12% commission)
    if (membership.feeChargedCents && membership.feeChargedCents > 0) {
      const chief = await prisma.user.findUnique({
        where: { id: membership.family.chiefId },
        select: { pixKey: true },
      });
      const chiefAmountCents = Math.floor(membership.feeChargedCents * (1 - SPOT_COMMISSION_RATE));
      if (chief?.pixKey && chiefAmountCents > 0) {
        await sendPixDisbursement({
          amountCents: chiefAmountCents,
          pixKey: chief.pixKey,
          description: `Families — Spot em ${membership.family.name}`,
        }).catch((err) => console.error("Spot disbursement error:", err));
      }
    }
  }

  if (status === "rejected" || status === "cancelled") {
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { status: "rejected" },
    });
  }
}

async function handlePledgePayment(pledgeId: string, paymentId: string, status: string) {
  const pledge = await prisma.pledge.findUnique({
    where: { id: pledgeId },
    include: {
      wishlistItem: { include: { family: true, owner: true } },
      pledger: true,
    },
  });
  if (!pledge) return;

  await prisma.$transaction(async (tx) => {
    const updates: Record<string, unknown> = { mpStatus: status };

    if (status === "approved" && !pledge.paidAt) {
      updates.paidAt = new Date();

      if (pledge.wishlistItem.ownerUserId && pledge.wishlistItem.ownerUserId !== pledge.pledgerUserId) {
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
            percent: Math.round((pledge.amountCents / pledge.wishlistItem.targetPriceCents) * 100),
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
    await maybeDisburseFunds(pledge.wishlistItemId);
  }
}
