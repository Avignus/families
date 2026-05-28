/**
 * Cria um FamilyMembership com spotVerifStatus="pending" para testar a verificação
 * de screenshot via Claude vision sem precisar passar pelo fluxo de pagamento.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/create-test-spot-membership.ts           — lista usuários
 *   npx tsx --env-file=.env scripts/create-test-spot-membership.ts <userId>  — cria a membership de teste
 *
 * Para testar contra Railway (produção):
 *   DATABASE_URL="postgresql://..." npx tsx --env-file=.env scripts/create-test-spot-membership.ts <userId>
 *
 * Depois de rodar: acesse https://families.im/verify-spot/<membershipId> logado como o usuário.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, personaName: true, email: true, steamId: true },
  });

  if (users.length === 0) {
    console.log("Nenhum usuário encontrado no banco.");
    return;
  }

  console.log(`\n${users.length} usuário(s) recentes:\n`);
  for (const u of users) {
    console.log(`  ${u.id}`);
    console.log(`    Nome   : ${u.personaName}`);
    console.log(`    Email  : ${u.email ?? "—"}`);
    console.log(`    Steam  : ${u.steamId}`);
    console.log();
  }
  console.log("Rode novamente passando um userId para criar a membership de teste.");
}

async function createTestMembership(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, personaName: true, steamId: true },
  });

  if (!user) {
    console.error(`Usuário "${userId}" não encontrado.`);
    process.exit(1);
  }

  console.log(`\n→ Criando membership de teste para ${user.personaName} (${user.steamId})`);

  // Pega ou cria uma família de teste
  let family = await prisma.family.findFirst({
    where: { name: "Família de Teste — Vision" },
    select: { id: true, name: true, chiefId: true },
  });

  if (!family) {
    // Precisa de um chief — usa o próprio usuário
    family = await prisma.family.create({
      data: {
        name: "Família de Teste — Vision",
        chiefId: userId,
        entryFeeCents: 0,
        spotPricingEnabled: true,
        currency: "BRL",
        description: "Família temporária para teste de verificação de screenshot",
      },
      select: { id: true, name: true, chiefId: true },
    });
    console.log(`  ✓ Família criada: ${family.id}`);
  } else {
    console.log(`  ✓ Família existente: ${family.id} — ${family.name}`);
  }

  // Remove membership anterior de teste se existir
  await prisma.familyMembership.deleteMany({
    where: {
      userId,
      familyId: family.id,
      spotVerifStatus: "pending",
    },
  });

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

  const membership = await prisma.familyMembership.create({
    data: {
      userId,
      familyId: family.id,
      status: "active",
      feePaidAt: new Date(),
      feeChargedCents: 1,
      spotVerifStatus: "pending",
      spotVerifDeadline: deadline,
      spotEscrowCents: 0,
      joinedAt: new Date(),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3000";

  console.log(`\n━━━ Membership criada ━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ID          : ${membership.id}`);
  console.log(`  Usuário     : ${user.personaName}`);
  console.log(`  personaName : "${user.personaName}" (Claude vai procurar este nome no print)`);
  console.log(`  Prazo       : ${deadline.toLocaleDateString("pt-BR")}`);
  console.log();
  console.log(`━━━ URL para testar ━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${baseUrl}/verify-spot/${membership.id}`);
  console.log();
  console.log(`  1. Abra a URL acima logado como "${user.personaName}" no browser`);
  console.log(`  2. Tire um print do Steam → Família Steam mostrando "${user.personaName}" na lista`);
  console.log(`  3. Faça upload do print na página`);
  console.log(`  4. Claude vai verificar se "${user.personaName}" aparece como membro`);
}

const userId = process.argv.find(
  (a) => !a.startsWith("--") && a !== process.argv[0] && a !== process.argv[1]
);

(userId ? createTestMembership(userId) : listUsers())
  .catch((e) => { console.error("Erro:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
