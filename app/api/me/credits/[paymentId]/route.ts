import { NextRequest } from "next/server";
import { requireSession, isApiError, ok } from "@/lib/api";
import { getPaymentStatus } from "@/lib/payment";

export async function GET(_req: NextRequest, { params }: { params: { paymentId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const status = await getPaymentStatus(params.paymentId);
  return ok({ paid: status === "approved" });
}
