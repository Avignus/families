import { requireSession, isApiError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
    select: { id: true, status: true, feePaidAt: true, pixStatus: true, pixPaymentId: true },
  });

  // When using Efí, poll the API directly so confirmation is real-time (no webhook needed)
  if (
    process.env.PAYMENT_PROVIDER === "efi" &&
    membership?.pixPaymentId &&
    membership.pixStatus === "pending" &&
    !membership.feePaidAt
  ) {
    try {
      const { getChargeByTxId, normalizeEfiStatus } = await import("@/lib/efi");
      const { handleMembershipPayment, handleSpotPayment } = await import("@/lib/payment-handlers");
      const charge = await getChargeByTxId(membership.pixPaymentId);
      const status = normalizeEfiStatus(charge.status);
      if (status !== "pending") {
        const ref = charge.infoAdicionais?.find((a: { nome: string }) => a.nome === "ref")?.valor ?? "";
        if (ref.startsWith("membership:")) {
          await handleMembershipPayment(ref.replace("membership:", ""), status, membership.pixPaymentId);
        } else if (ref.startsWith("spot:")) {
          await handleSpotPayment(ref.replace("spot:", ""), status, membership.pixPaymentId);
        }
      }
    } catch {}
    const updated = await prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId: user.id, familyId: params.id } },
      select: { status: true, feePaidAt: true, pixStatus: true },
    });
    return ok({
      membershipStatus: updated?.status ?? null,
      paid: updated?.feePaidAt !== null && updated?.feePaidAt !== undefined,
      pixStatus: updated?.pixStatus ?? null,
    });
  }

  return ok({
    membershipStatus: membership?.status ?? null,
    paid: membership?.feePaidAt !== null && membership?.feePaidAt !== undefined,
    pixStatus: membership?.pixStatus ?? null,
  });
}
