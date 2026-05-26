import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { refundPayment } from "@/lib/payment";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the chief can reject requests", 403);

  const membership = await prisma.familyMembership.findUnique({
    where: { id: params.requestId },
    include: { user: true },
  });
  if (!membership || membership.familyId !== params.id) {
    return err("NOT_FOUND", "Join request not found", 404);
  }
  if (membership.status !== "pending") {
    return err("INVALID_STATE", "Request is not pending");
  }

  // Refund whatever was charged if payment was already confirmed
  let refunded = false;
  const refundAmountCents = membership.feeChargedCents ?? family.entryFeeCents;
  if (membership.feePaidAt && membership.pixPaymentId && !membership.feeRefundedAt && refundAmountCents > 0) {
    try {
      await refundPayment(membership.pixPaymentId, refundAmountCents);
      refunded = true;
    } catch (refundErr) {
      console.error("Refund error:", refundErr);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyMembership.update({
      where: { id: params.requestId },
      data: {
        status: "rejected",
        ...(refunded ? { feeRefundedAt: new Date() } : {}),
      },
    });
    await createNotification(tx, {
      recipientUserId: membership.userId,
      type: "JOIN_REJECTED",
      payload: {
        familyId: family.id,
        familyName: family.name,
        refunded,
        refundAmountFormatted: refunded
          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: family.currency })
              .format(refundAmountCents / 100)
          : null,
      },
    });
  });

  return ok({ message: "Request rejected", refunded });
}
