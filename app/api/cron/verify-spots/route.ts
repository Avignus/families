import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/payment";
import { createNotification } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

/** Runs daily: finds spot memberships where verification deadline passed, auto-refunds buyer and notifies both parties. */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const expired = await prisma.familyMembership.findMany({
    where: {
      spotVerifStatus: "pending",
      spotVerifDeadline: { lt: new Date() },
    },
    include: {
      family: { select: { id: true, name: true, chiefId: true, currency: true } },
      user: { select: { id: true, personaName: true } },
    },
  });

  let processed = 0;
  let refunded = 0;

  for (const membership of expired) {
    try {
      let didRefund = false;

      if (membership.pixPaymentId && membership.feeChargedCents && !membership.feeRefundedAt) {
        try {
          await refundPayment(membership.pixPaymentId, membership.feeChargedCents);
          didRefund = true;
          refunded++;
        } catch (e) {
          console.error(`Spot refund failed for membership ${membership.id}:`, e);
        }
      }

      const amountFormatted = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: membership.family.currency,
      }).format((membership.feeChargedCents ?? 0) / 100);

      await prisma.$transaction(async (tx) => {
        await tx.familyMembership.update({
          where: { id: membership.id },
          data: {
            status: "rejected",
            spotVerifStatus: "expired",
            ...(didRefund ? { feeRefundedAt: new Date() } : {}),
          },
        });

        await createNotification(tx, {
          recipientUserId: membership.userId,
          type: "SPOT_VERIFICATION_EXPIRED",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
            refunded: didRefund,
            refundAmountFormatted: didRefund ? amountFormatted : null,
          },
        });

        await createNotification(tx, {
          recipientUserId: membership.family.chiefId,
          type: "SPOT_VERIFICATION_EXPIRED",
          payload: {
            familyId: membership.family.id,
            familyName: membership.family.name,
            memberId: membership.userId,
            personaName: membership.user.personaName,
            refunded: didRefund,
            amountFormatted,
          },
        });
      });

      processed++;
    } catch (e) {
      console.error(`Error processing expired spot membership ${membership.id}:`, e);
    }
  }

  return NextResponse.json({ ok: true, processed, refunded });
}
