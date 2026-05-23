import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/asaas";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });

  if (!membership) return err("NOT_FOUND", "No join request found", 404);
  if (membership.status === "active") return err("ALREADY_MEMBER", "Cannot cancel an active membership", 409);
  if (membership.feePaidAt) return err("ALREADY_PAID", "Cannot cancel after fee is confirmed", 409);

  // Attempt refund if a PIX was generated but not yet confirmed
  if (membership.pixPaymentId && membership.feeChargedCents && !membership.feeRefundedAt) {
    await refundPayment(membership.pixPaymentId, membership.feeChargedCents).catch(() => {});
  }

  await prisma.familyMembership.delete({ where: { id: membership.id } });

  return ok({ message: "Join request cancelled" });
}
