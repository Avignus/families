import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { getPaymentsByExternalReference, normalizePaymentStatus as normalizeAsaasStatus } from "@/lib/payment";
import { prisma } from "@/lib/prisma";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications/service";
import { autoDistributeCredits } from "@/lib/auto-distribute";

export async function POST(_req: NextRequest) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const externalRef = `credits:${user.id}`;
  const payments = await getPaymentsByExternalReference(externalRef);

  const approved = payments.filter((p) => normalizeAsaasStatus(p.status) === "approved");
  if (approved.length === 0) {
    return err("NO_APPROVED_PAYMENTS", "Nenhum pagamento aprovado encontrado para recuperar", 404);
  }

  // Already processed paymentIds
  const processed = await prisma.walletTransaction.findMany({
    where: { userId: user.id, reason: "topup" },
    select: { pledgeId: true },
  });
  const processedIds = new Set(processed.map((t) => t.pledgeId).filter(Boolean));

  const toProcess = approved.filter((p) => !processedIds.has(p.id));
  if (toProcess.length === 0) {
    return err("ALREADY_PROCESSED", "Todos os pagamentos aprovados já foram processados", 409);
  }

  let totalCredited = 0;
  for (const payment of toProcess) {
    const amountCents = Math.round(payment.value * 100);
    await prisma.$transaction(async (tx) => {
      await creditWallet(tx, user.id, amountCents, "topup", payment.id);
      await createNotification(tx, {
        recipientUserId: user.id,
        type: "CREDITS_ADDED",
        payload: { amountCents, currency: "BRL" },
      });
    });
    totalCredited += amountCents;
  }

  const membership = await prisma.familyMembership.findFirst({
    where: { userId: user.id, status: "active", autoDistributeEnabled: true, monthlyBudgetCents: { gt: 0 } },
    select: { monthlyBudgetCents: true },
  });
  if (membership && totalCredited > 0) {
    const budget = Math.min(membership.monthlyBudgetCents, totalCredited);
    await autoDistributeCredits(user.id, budget).catch(() => {});
  }

  return ok({ recovered: toProcess.length, totalCredited });
}
