import { NextRequest } from "next/server";
import { requireSession, isApiError, ok } from "@/lib/api";
import { getPaymentStatus } from "@/lib/payment";

export async function GET(_req: NextRequest, { params }: { params: { paymentId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  // When using Efí, check API directly and process inline for real-time confirmation
  if (process.env.PAYMENT_PROVIDER === "efi") {
    try {
      const { getChargeByTxId, normalizeEfiStatus } = await import("@/lib/efi");
      const { handleCreditsPayment } = await import("@/lib/payment-handlers");
      const charge = await getChargeByTxId(params.paymentId);
      const status = normalizeEfiStatus(charge.status);
      if (status === "approved") {
        const amountCents = Math.round(parseFloat(charge.valor?.original ?? "0") * 100);
        await handleCreditsPayment(user.id, status, params.paymentId, amountCents);
      }
      return ok({ paid: status === "approved" });
    } catch {
      return ok({ paid: false });
    }
  }

  const status = await getPaymentStatus(params.paymentId);
  return ok({ paid: status === "approved" });
}
