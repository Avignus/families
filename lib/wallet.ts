import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function creditWallet(
  tx: Tx,
  userId: string,
  amountCents: number,
  reason: string,
  pledgeId?: string
): Promise<void> {
  await tx.walletTransaction.create({
    data: { userId, amountCents, type: "credit", reason, pledgeId: pledgeId ?? null },
  });
  await tx.user.update({
    where: { id: userId },
    data: { creditsCents: { increment: amountCents } },
  });
}

export async function debitWallet(
  tx: Tx,
  userId: string,
  amountCents: number,
  reason: string,
  pledgeId?: string
): Promise<void> {
  const result = await tx.user.updateMany({
    where: { id: userId, creditsCents: { gte: amountCents } },
    data: { creditsCents: { decrement: amountCents } },
  });
  if (result.count === 0) {
    throw Object.assign(new Error("Saldo insuficiente"), { code: "INSUFFICIENT_CREDITS", status: 400 });
  }
  await tx.walletTransaction.create({
    data: { userId, amountCents, type: "debit", reason, pledgeId: pledgeId ?? null },
  });
}
