import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sendPixDisbursement, MIN_CHARGE_CENTS as ASAAS_MIN_CHARGE_CENTS } from "@/lib/payment";
import { z } from "zod";

// Platform keeps 2% of the withdrawal amount to cover operational costs.
// Asaas transfer fee (R$1.99) is absorbed by the platform — not charged to the chief.
const WITHDRAWAL_FEE_BPS = parseInt(process.env.WITHDRAWAL_FEE_BPS ?? "200", 10);

const WithdrawSchema = z.object({
  amountCents: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const body = await parseBody(req, WithdrawSchema);
  if (isApiError(body)) return body;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { chiefSpotEarningsCents: true, pixKey: true, chiefOf: { select: { id: true } } },
  });

  if (!dbUser) return err("NOT_FOUND", "Usuário não encontrado", 404);
  if (dbUser.chiefOf.length === 0) return err("FORBIDDEN", "Apenas chefes de família podem sacar", 403);
  if (!dbUser.pixKey) return err("NO_PIX_KEY", "Cadastre uma chave PIX em Configurações antes de sacar", 400);

  const available = dbUser.chiefSpotEarningsCents;
  if (available <= 0) return err("NO_BALANCE", "Saldo de spot insuficiente", 400);
  if (body.amountCents > available) {
    return err("EXCEEDS_BALANCE", `Valor excede o saldo disponível de R$ ${(available / 100).toFixed(2)}`, 400);
  }
  if (body.amountCents < ASAAS_MIN_CHARGE_CENTS) {
    return err(
      "BELOW_MINIMUM",
      `Saque mínimo de R$ ${(ASAAS_MIN_CHARGE_CENTS / 100).toFixed(2).replace(".", ",")}`,
      400
    );
  }

  const feeCents = Math.round(body.amountCents * WITHDRAWAL_FEE_BPS / 10000);
  const netCents = body.amountCents - feeCents;

  // Debit balance atomically before sending PIX (prevents double-withdrawal)
  await prisma.user.update({
    where: { id: user.id },
    data: { chiefSpotEarningsCents: { decrement: body.amountCents } },
  });

  try {
    const transferId = await sendPixDisbursement({
      amountCents: netCents,
      pixKey: dbUser.pixKey,
      description: `Families — Saque de ganhos de spot`,
    });

    // Record platform revenue from withdrawal fee
    if (feeCents > 0) {
      await prisma.platformRevenue.create({
        data: {
          amountCents: feeCents,
          reason: "withdrawal_fee",
          metadata: {
            userId: user.id,
            grossCents: body.amountCents,
            netCents,
            feeBps: WITHDRAWAL_FEE_BPS,
            transferId,
          },
        },
      });
    }

    return ok({ transferId, grossCents: body.amountCents, feeCents, netCents });

  } catch (e) {
    // Revert balance debit if PIX transfer fails
    await prisma.user.update({
      where: { id: user.id },
      data: { chiefSpotEarningsCents: { increment: body.amountCents } },
    });
    console.error("Withdrawal PIX error:", e);
    return err("TRANSFER_FAILED", "Falha ao processar o PIX. Tente novamente.", 502);
  }
}

export async function GET() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { chiefSpotEarningsCents: true },
  });

  const available = dbUser?.chiefSpotEarningsCents ?? 0;
  const feeCents = Math.round(available * WITHDRAWAL_FEE_BPS / 10000);

  return ok({
    availableCents: available,
    feeBps: WITHDRAWAL_FEE_BPS,
    feeCents,
    netCents: available - feeCents,
    minWithdrawalCents: ASAAS_MIN_CHARGE_CENTS,
  });
}
