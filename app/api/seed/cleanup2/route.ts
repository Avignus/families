import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const KEEP_FAMILY = "cmp2x7mcl00033bh880snlifh";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("s") !== process.env.SEED_SECRET?.trim()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const toDelete = await prisma.family.findMany({
    where: {
      id: { not: KEEP_FAMILY },
      OR: [
        { name: { contains: "Teste", mode: "insensitive" } },
        { name: { contains: "test", mode: "insensitive" } },
        { id: { startsWith: "cat-seed" } },
        { id: { startsWith: "family-seed" } },
        { id: { startsWith: "prod-test" } },
      ],
    },
    select: { id: true, name: true },
  });

  const ids = toDelete.map((f) => f.id);

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, deleted: [], message: "nothing to delete" });
  }

  await prisma.voteBallot.deleteMany({ where: { vote: { familyId: { in: ids } } } });
  await prisma.vote.deleteMany({ where: { familyId: { in: ids } } });
  await prisma.pledge.deleteMany({ where: { wishlistItem: { familyId: { in: ids } } } });
  await prisma.wishlistItem.deleteMany({ where: { familyId: { in: ids } } });
  await prisma.familyMembership.deleteMany({ where: { familyId: { in: ids } } });
  await prisma.family.deleteMany({ where: { id: { in: ids } } });

  return NextResponse.json({ ok: true, deleted: toDelete.map((f) => `${f.name} (${f.id})`) });
}
