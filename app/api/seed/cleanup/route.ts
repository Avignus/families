import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const KEEP_FAMILY = "cmp2x7mcl00033bh880snlifh"; // Grupo do Zap

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("s") !== process.env.SEED_SECRET?.trim()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const toDelete = await prisma.family.findMany({
    where: { id: { not: KEEP_FAMILY } },
    select: { id: true, name: true },
  });

  const ids = toDelete.map((f) => f.id);

  // Delete in dependency order
  await prisma.voteBallot.deleteMany({ where: { vote: { familyId: { in: ids } } } });
  await prisma.vote.deleteMany({ where: { familyId: { in: ids } } });
  await prisma.pledge.deleteMany({ where: { wishlistItem: { familyId: { in: ids } } } });
  await prisma.wishlistItem.deleteMany({ where: { familyId: { in: ids } } });
  await prisma.familyMembership.deleteMany({ where: { familyId: { in: ids } } });
  await prisma.family.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({ ok: true, deleted: toDelete.map((f) => f.name) });
}
