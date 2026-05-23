/**
 * Envia o payload exato que o Asaas mandaria ao endpoint de webhook.
 * Útil para testar o fluxo completo via HTTP sem precisar de um pagamento real.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/send-webhook.ts <pledgeId> [approved|rejected]
 *   npx tsx --env-file=.env scripts/send-webhook.ts <pledgeId> approved --url=https://families-flax.vercel.app
 *
 * Variáveis de ambiente (carregadas do .env automaticamente):
 *   ASAAS_WEBHOOK_SECRET   — token enviado no header (obrigatório)
 *   WEBHOOK_URL            — URL base do servidor (padrão: http://localhost:3000)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_URL =
  process.argv.find((a) => a.startsWith("--url="))?.replace("--url=", "") ??
  process.env.WEBHOOK_URL ??
  "http://localhost:3000";

async function main() {
  const pledgeId = process.argv[2];
  const eventStatus = (process.argv[3] ?? "approved").toUpperCase();

  if (!pledgeId) {
    console.error("Usage: npx tsx scripts/send-webhook.ts <pledgeId> [approved|rejected] [--url=...]");
    process.exit(1);
  }

  const secret = process.env.ASAAS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("❌ Defina ASAAS_WEBHOOK_SECRET antes de rodar.");
    process.exit(1);
  }

  const pledge = await prisma.pledge.findUnique({
    where: { id: pledgeId },
    include: { pledger: { select: { personaName: true } } },
  });

  if (!pledge) {
    console.error(`Pledge "${pledgeId}" não encontrado.`);
    process.exit(1);
  }

  const fakePaymentId = pledge.pixPaymentId ?? `fake_pay_${Date.now()}`;

  const payload = {
    event: eventStatus === "CONFIRMED" || eventStatus === "APPROVED" ? "PAYMENT_CONFIRMED" : "PAYMENT_REPROVED",
    payment: {
      id: fakePaymentId,
      status: eventStatus === "CONFIRMED" || eventStatus === "APPROVED" ? "CONFIRMED" : "REPROVED",
      value: pledge.amountCents / 100,
      externalReference: `pledge:${pledgeId}`,
      billingType: "PIX",
    },
  };

  const url = `${BASE_URL}/api/webhooks/asaas`;
  console.log(`\nEnviando webhook para ${url}`);
  console.log(`  Pledge  : ${pledgeId} (${pledge.pledger.personaName})`);
  console.log(`  Valor   : R$ ${(pledge.amountCents / 100).toFixed(2)}`);
  console.log(`  Status  : ${payload.payment.status}`);
  console.log(`  PayID   : ${fakePaymentId}\n`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "asaas-access-token": secret,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => null);

  if (res.ok) {
    console.log(`✅ Webhook aceito (${res.status}):`, body);
  } else {
    console.error(`❌ Webhook rejeitado (${res.status}):`, body);
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error("Erro:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
