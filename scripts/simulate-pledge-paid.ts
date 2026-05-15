/**
 * Simula o pagamento de um pledge e dispara o repasse se o item estiver totalmente financiado.
 * Carrega .env automaticamente — não precisa exportar variáveis manualmente.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/simulate-pledge-paid.ts                       — lista pledges pendentes
 *   npx tsx --env-file=.env scripts/simulate-pledge-paid.ts <pledgeId>            — marca como pago e tenta repasse
 *   npx tsx --env-file=.env scripts/simulate-pledge-paid.ts <pledgeId> --force    — força repasse mesmo sem meta atingida
 *
 * Para rodar contra produção:
 *   DATABASE_URL="postgresql://..." npx tsx --env-file=.env scripts/simulate-pledge-paid.ts <pledgeId>
 */

import { PrismaClient } from "@prisma/client";
import { maybeDisburseFunds } from "../lib/disbursement";
import { getTransferStatus } from "../lib/asaas";

// Re-export only what we need (inferAsaasKeyType não é exportada — replicamos só para exibição)
function pixKeyLabel(key: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return `EVP  ${key}`;
  if (key.includes("@")) return `EMAIL  ${key}`;
  if (key.startsWith("+55")) return `FONE  ${key}`;
  const d = key.replace(/\D/g, "");
  if (d.length === 14) return `CNPJ  ${d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`;
  if (d.length === 11) return `CPF   ${d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`;
  return key;
}

const prisma = new PrismaClient();

async function listPending() {
  const pledges = await prisma.pledge.findMany({
    where: { status: "active", paidAt: null },
    include: {
      pledger: { select: { personaName: true } },
      wishlistItem: {
        include: {
          family: { select: { name: true } },
          owner: { select: { personaName: true, pixKey: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (pledges.length === 0) {
    console.log("Nenhum pledge pendente de pagamento.");
    return;
  }

  console.log(`\n${pledges.length} pledge(s) pendente(s):\n`);
  for (const p of pledges) {
    const item = p.wishlistItem;
    const ownerPix = item.owner?.pixKey ? `✓ ${pixKeyLabel(item.owner.pixKey)}` : "✗ sem PIX cadastrada";
    console.log(`  ${p.id}`);
    console.log(`    Pledger  : ${p.pledger.personaName}`);
    console.log(`    Jogo     : App #${item.steamAppId}  (${item.family.name})`);
    console.log(`    Valor    : R$ ${(p.amountCents / 100).toFixed(2)}`);
    console.log(`    Dono     : ${item.owner?.personaName ?? "?"} — ${ownerPix}`);
    console.log(`    Status   : ${item.status}`);
    console.log();
  }
  console.log("Rode novamente passando um pledgeId para simular o pagamento.");
}

const force = process.argv.includes("--force");

async function simulatePaid(pledgeId: string) {
  const pledge = await prisma.pledge.findUnique({
    where: { id: pledgeId },
    include: {
      pledger: { select: { personaName: true } },
      wishlistItem: {
        include: {
          owner: { select: { personaName: true, pixKey: true } },
          family: { select: { name: true } },
        },
      },
    },
  });

  if (!pledge) { console.error(`Pledge "${pledgeId}" não encontrado.`); process.exit(1); }

  const item = pledge.wishlistItem;
  const apiKey = process.env.ASAAS_API_KEY ?? "";
  const env = apiKey.includes("_hmlg_") || apiKey.startsWith("$aas_test") ? "sandbox" : "produção";

  console.log(`\n━━━ Pledge ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ID       : ${pledge.id}`);
  console.log(`  Pledger  : ${pledge.pledger.personaName}`);
  console.log(`  Jogo     : App #${item.steamAppId}  (${item.family.name})`);
  console.log(`  Valor    : R$ ${(pledge.amountCents / 100).toFixed(2)}`);
  console.log(`  paidAt   : ${pledge.paidAt ?? "null (não pago)"}`);
  console.log(`  Asaas    : ${env} (${apiKey ? "chave configurada" : "⚠ ASAAS_API_KEY ausente"})`);

  if (!pledge.paidAt) {
    console.log(`\n→ Marcando pledge como pago...`);
    await prisma.pledge.update({
      where: { id: pledgeId },
      data: { paidAt: new Date(), mpStatus: "approved" },
    });
    console.log(`  ✓ paidAt definido`);
  } else {
    console.log(`\n→ Pledge já marcado como pago. Tentando repasse...`);
  }

  // Verificar estado do item
  const unpaid = await prisma.pledge.count({
    where: { wishlistItemId: item.id, status: "active", paidAt: null },
  });
  const agg = await prisma.pledge.aggregate({
    where: { wishlistItemId: item.id, status: "active" },
    _sum: { amountCents: true },
  });
  const total = agg._sum.amountCents ?? 0;

  console.log(`\n━━━ Item ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Status   : ${item.status}`);
  console.log(`  Total    : R$ ${(total / 100).toFixed(2)} / R$ ${(item.targetPriceCents / 100).toFixed(2)}`);
  console.log(`  Não pagos: ${unpaid}`);

  let currentStatus = item.status;
  if (currentStatus !== "funded" && (total >= item.targetPriceCents || force)) {
    await prisma.wishlistItem.update({ where: { id: item.id }, data: { status: "funded" } });
    currentStatus = "funded";
    console.log(`  ✓ Atualizado para "funded"${force && total < item.targetPriceCents ? " (forçado)" : ""}`);
  }

  if (currentStatus !== "funded") {
    const falta = item.targetPriceCents - total;
    console.log(`\n  ⚠ Item não está funded (faltam R$ ${(falta / 100).toFixed(2)}) — repasse não disparado.`);
    console.log(`     Use --force para ignorar a meta e testar o repasse mesmo assim.`);
    return;
  }
  if (unpaid > 0 && !force) {
    console.log(`\n  ⚠ Há ${unpaid} pledge(s) ainda não pago(s) — repasse aguarda todos.`);
    console.log(`     Use --force para disparar mesmo assim.`);
    return;
  }

  const ownerPix = item.owner?.pixKey;
  console.log(`\n━━━ Destino do repasse ━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Dono     : ${item.owner?.personaName ?? "?"}`);
  console.log(`  PIX      : ${ownerPix ? pixKeyLabel(ownerPix) : "✗ não cadastrada"}`);
  console.log(`  Valor    : R$ ${(total / 100).toFixed(2)}`);

  if (!ownerPix) {
    console.log(`\n  ✗ Sem PIX — repasse bloqueado. Cadastre a chave em /settings.`);
    return;
  }

  if (!apiKey) {
    console.log(`\n  ✗ ASAAS_API_KEY não definida — rode com --env-file=.env`);
    return;
  }

  console.log(`\n→ Disparando repasse via Asaas (${env})...`);
  await maybeDisburseFunds(item.id);

  const updated = await prisma.wishlistItem.findUnique({
    where: { id: item.id },
    select: { disbursedAt: true, disbursementMpId: true },
  });

  if (!updated?.disbursementMpId) {
    console.log(`  ✗ Repasse não registrado — verifique o erro acima.`);
    return;
  }

  console.log(`  ✓ Repasse enviado! ID Asaas: ${updated.disbursementMpId}`);
  console.log(`  ✓ disbursedAt: ${updated.disbursedAt}`);

  // Consulta o status do transfer no Asaas
  console.log(`\n→ Consultando status no Asaas...`);
  try {
    const transfer = await getTransferStatus(updated.disbursementMpId);
    console.log(`\n━━━ Resultado Asaas ━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Transfer ID : ${transfer.id}`);
    console.log(`  Status      : ${transfer.status}`);
    console.log(`  Valor       : R$ ${transfer.value?.toFixed(2)}`);
    console.log(`  Chave PIX   : ${transfer.pixAddressKey} (${transfer.pixAddressKeyType})`);
    console.log(`  Data        : ${transfer.transferDate ?? "—"}`);
    console.log(`  Descrição   : ${transfer.description}`);
  } catch (e: unknown) {
    console.log(`  ⚠ Não foi possível consultar o status: ${(e as Error)?.message ?? e}`);
  }
}

const pledgeId = process.argv.find((a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]);
(pledgeId ? simulatePaid(pledgeId) : listPending())
  .catch((e) => { console.error("Erro:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
