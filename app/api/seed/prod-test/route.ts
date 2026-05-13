import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-seed-secret") !== process.env.SEED_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Find any existing user to be chief
  const chief = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!chief) return NextResponse.json({ ok: false, error: "No users found" }, { status: 404 });

  const families = [
    {
      id: "prod-test-1",
      name: "Teste Pagamento A",
      description: "Família de teste com taxa mínima para validar o fluxo de pagamento.",
      isPublic: true,
      maxMembers: 10,
      entryFeeCents: 1,
      currency: "BRL",
      chiefId: chief.id,
    },
    {
      id: "prod-test-2",
      name: "Teste Pagamento B",
      description: "Segunda família de teste com taxa mínima.",
      isPublic: true,
      maxMembers: 10,
      entryFeeCents: 1,
      currency: "BRL",
      chiefId: chief.id,
    },
  ];

  for (const f of families) {
    await prisma.family.upsert({
      where: { id: f.id },
      update: f,
      create: f,
    });
    await prisma.familyMembership.upsert({
      where: { userId_familyId: { userId: f.chiefId, familyId: f.id } },
      update: {},
      create: { userId: f.chiefId, familyId: f.id, status: "active" },
    });
  }

  return NextResponse.json({ ok: true, families: families.map(f => f.name) });
}
