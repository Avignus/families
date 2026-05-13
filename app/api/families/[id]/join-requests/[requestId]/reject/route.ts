import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { refundEntryFee } from "@/lib/mercadopago";

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

  // Issue partial refund if entry fee was paid (refund only the entry fee, not service fee)
  let refunded = false;
  if (membership.feePaidAt && membership.mpPaymentId && !membership.feeRefundedAt) {
    try {
      await refundEntryFee(membership.mpPaymentId, family.entryFeeCents);
      refunded = true;
    } catch (refundErr) {
      console.error("Refund error:", refundErr);
      // Don't block rejection on refund failure — mark for manual review
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
              .format(family.entryFeeCents / 100)
          : null,
      },
    });
  });

  return ok({ message: "Request rejected", refunded });
}
