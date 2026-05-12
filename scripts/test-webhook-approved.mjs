// Simulates the webhook handler logic for an "approved" payment
// Bypasses HTTP + MP API — exercises DB updates directly
// Usage: node scripts/test-webhook-approved.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PLEDGE_ID = "test-pledge-webhook-001";
const MP_PAYMENT_ID = "1346536967";
const SIMULATED_STATUS = "approved";

async function run() {
  const pledge = await prisma.pledge.findUnique({
    where: { mpPaymentId: MP_PAYMENT_ID },
    include: { wishlistItem: { include: { family: true } }, pledger: true },
  });

  if (!pledge) {
    console.error(`✗ Pledge com mpPaymentId=${MP_PAYMENT_ID} não encontrado`);
    process.exit(1);
  }

  console.log(`\nPledge encontrado: ${pledge.id}`);
  console.log(`  mpStatus antes: ${pledge.mpStatus}`);
  console.log(`  status antes:   ${pledge.status}`);
  console.log(`  paidAt antes:   ${pledge.paidAt ?? "null"}`);
  console.log(`\nSimulando webhook com status="${SIMULATED_STATUS}"...`);

  await prisma.$transaction(async (tx) => {
    const updates = { mpStatus: SIMULATED_STATUS };

    if (SIMULATED_STATUS === "approved" && !pledge.paidAt) {
      updates.paidAt = new Date();
    }

    if (SIMULATED_STATUS === "rejected" || SIMULATED_STATUS === "cancelled") {
      updates.status = "withdrawn";
      if (pledge.wishlistItem.status === "funded") {
        await tx.wishlistItem.update({
          where: { id: pledge.wishlistItemId },
          data: { status: "open" },
        });
      }
    }

    await tx.pledge.update({ where: { id: pledge.id }, data: updates });
  });

  const updated = await prisma.pledge.findUnique({ where: { id: pledge.id } });
  console.log(`\n✓ Pledge atualizado:`);
  console.log(`  mpStatus depois: ${updated.mpStatus}`);
  console.log(`  status depois:   ${updated.status}`);
  console.log(`  paidAt depois:   ${updated.paidAt ?? "null"}`);
}

run().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
