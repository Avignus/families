import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus, verifyWebhookSignature, sendPixDisbursement } from "@/lib/mercadopago";
import { createNotification } from "@/lib/notifications/service";
import { computeAndSaveReputation } from "@/lib/reputation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";
  const dataId = String(body?.data?.id ?? "");

  const hasSecret = !!process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (hasSecret && (!xSignature || !verifyWebhookSignature({ xSignature, xRequestId, dataId }))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (body.type !== "payment" || !dataId) {
    return NextResponse.json({ ok: true });
  }

  const mpStatus = await getPaymentStatus(dataId);
  if (!mpStatus) return NextResponse.json({ ok: true });

  // Check if this is a membership entry fee payment
  const membership = await prisma.familyMembership.findUnique({
    where: { mpPaymentId: dataId },
    include: { family: true, user: true },
  });

  if (membership) {
    await handleMembershipPayment(membership, mpStatus);
    return NextResponse.json({ ok: true });
  }

  const pledge = await prisma.pledge.findUnique({
    where: { mpPaymentId: dataId },
    include: {
      wishlistItem: { include: { family: true, owner: true } },
      pledger: true,
    },
  });

  if (!pledge) return NextResponse.json({ ok: true });

  await prisma.$transaction(async (tx) => {
    const updates: Record<string, unknown> = { mpStatus };

    if (mpStatus === "approved" && !pledge.paidAt) {
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

    if (mpStatus === "rejected" || mpStatus === "cancelled") {
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

  // After marking as approved, recompute reputation and check for disbursement
  if (mpStatus === "approved") {
    await computeAndSaveReputation(pledge.pledgerUserId).catch(() => {});
    await maybeDisburseFunds(pledge.wishlistItemId);
  }

  return NextResponse.json({ ok: true });
}

type MembershipWithFamily = {
  id: string;
  userId: string;
  familyId: string;
  mpStatus: string | null;
  feePaidAt: Date | null;
  family: { id: string; name: string; chiefId: string };
  user: { id: string; personaName: string };
};

async function handleMembershipPayment(membership: MembershipWithFamily, mpStatus: string) {
  await prisma.familyMembership.update({
    where: { id: membership.id },
    data: { mpStatus },
  });

  if (mpStatus === "approved" && !membership.feePaidAt) {
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
  }

  if (mpStatus === "rejected" || mpStatus === "cancelled") {
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { status: "rejected" },
    });
  }
}

async function maybeDisburseFunds(wishlistItemId: string) {
  const item = await prisma.wishlistItem.findUnique({
    where: { id: wishlistItemId },
    include: { owner: true },
  });

  if (!item || item.disbursedAt || item.status !== "funded") return;
  if (!item.ownerUserId || !item.owner) return;

  // Check that every active pledge is paid
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
    // Notify owner to register a PIX key
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
