/**
 * Adiciona um usuário (por steamId) a uma família (por nome) com status active.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/add-member-to-family.ts <steamId> <familyName>
 *
 * Exemplo:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/add-member-to-family.ts 1674637417 "ordem dos temidos"
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [steamId, familyName] = process.argv.slice(2);

  if (!steamId || !familyName) {
    console.error("Uso: npx tsx scripts/add-member-to-family.ts <steamId> <familyName>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { steamId },
    select: { id: true, personaName: true, steamId: true },
  });

  if (!user) {
    console.error(`Usuário com steamId "${steamId}" não encontrado.`);
    process.exit(1);
  }

  console.log(`\n→ Usuário encontrado: ${user.personaName} (${user.steamId})`);

  const family = await prisma.family.findFirst({
    where: { name: { equals: familyName, mode: "insensitive" } },
    select: { id: true, name: true, chiefId: true },
  });

  if (!family) {
    console.error(`Família "${familyName}" não encontrada.`);
    process.exit(1);
  }

  console.log(`→ Família encontrada: ${family.name} (${family.id})`);

  const existing = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: family.id } },
  });

  if (existing) {
    if (existing.status === "active") {
      console.log(`\nUsuário já é membro ativo da família "${family.name}". Nada a fazer.`);
      return;
    }
    const updated = await prisma.familyMembership.update({
      where: { userId_familyId: { userId: user.id, familyId: family.id } },
      data: { status: "active", joinedAt: new Date() },
    });
    console.log(`\n✓ Membership atualizada para active. ID: ${updated.id}`);
  } else {
    const membership = await prisma.familyMembership.create({
      data: {
        userId: user.id,
        familyId: family.id,
        status: "active",
        joinedAt: new Date(),
      },
    });
    console.log(`\n✓ Membership criada com sucesso. ID: ${membership.id}`);
  }

  console.log(`  Usuário  : ${user.personaName}`);
  console.log(`  Família  : ${family.name}`);
  console.log(`  Status   : active`);
}

main()
  .catch((e) => { console.error("Erro:", e?.message ?? e); process.exit(1); })
  .finally(() => prisma.$disconnect());
