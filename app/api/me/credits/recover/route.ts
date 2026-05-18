import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { getPaymentStatus } from "@/lib/asaas";
import { prisma } from "@/lib/prisma";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications/service";
import { autoDistributeCredits } from "@/lib/auto-distribute";

const BodySchema = z.object({
  paymentId: z.string().min(1),
  amountCents: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const body = await parseBody(req, BodySchema);
  if (isApiError(body)) return body;

  // Verify payment is actually confirmed in Asaas
  const status = await getPaymentStatus(body.paymentId);
  if (status !== "approved") {
    return err("NOT_PAID", `Pagamento ainda não confirmado (status: ${status})`, 400);
  }

  // Idempotency: check if this paymentId was already processed via wallet transactions
  const alreadyProcessed = await prisma.walletTransaction.findFirst({
    where: { userId: user.id, reason: "topup", pledgeId: body.paymentId },
  });
  if (alreadyProcessed) {
    return err("ALREADY_PROCESSED", "Este pagamento já foi processado", 409);
  }

  await prisma.$transaction(async (tx) => {
    await creditWallet(tx, user.id, body.amountCents, "topup", body.paymentId);
    await createNotification(tx, {
      recipientUserId: user.id,
      type: "CREDITS_ADDED",
      payload: { amountCents: body.amountCents, currency: "BRL" },
    });
  });

  const membership = await prisma.familyMembership.findFirst({
    where: { userId: user.id, status: "active", monthlyBudgetCents: { gt: 0 } },
    select: { monthlyBudgetCents: true },
  });
  if (membership) {
    const budget = Math.min(membership.monthlyBudgetCents, body.amountCents);
    await autoDistributeCredits(user.id, budget).catch(() => {});
  }

  return ok({ credited: body.amountCents });
}
