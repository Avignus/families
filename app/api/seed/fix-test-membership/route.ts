import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-seed-secret") !== process.env.SEED_SECRET?.trim()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Find another user to be chief (not the first one)
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, take: 2 });
  const chief = users[0];
  const newChief = users[1] ?? users[0];

  // Remove current chief's membership from test families so they can test payment
  const deleted = await prisma.familyMembership.deleteMany({
    where: {
      userId: chief.id,
      familyId: { in: ["prod-test-1", "prod-test-2"] },
    },
  });

  // Transfer chiefship to second user if available
  if (users[1]) {
    await prisma.family.updateMany({
      where: { id: { in: ["prod-test-1", "prod-test-2"] } },
      data: { chiefId: newChief.id },
    });
    await prisma.familyMembership.createMany({
      data: [
        { userId: newChief.id, familyId: "prod-test-1", status: "active" },
        { userId: newChief.id, familyId: "prod-test-2", status: "active" },
      ],
      skipDuplicates: true,
    });
  }

  return NextResponse.json({ ok: true, removedMemberships: deleted.count, newChief: newChief.personaName });
}
