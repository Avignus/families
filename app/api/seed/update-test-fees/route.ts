import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-seed-secret") !== process.env.SEED_SECRET?.trim()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await prisma.family.update({
    where: { id: "prod-test-1" },
    data: { entryFeeCents: 20, name: "Teste Taxa A (R$ 0,20)" },
  });

  await prisma.family.update({
    where: { id: "prod-test-2" },
    data: { entryFeeCents: 40, name: "Teste Taxa B (R$ 0,40)" },
  });

  return NextResponse.json({
    ok: true,
    families: [
      { name: "Teste Taxa A", entry: "R$ 0,20", serviceFee: "R$ 0,03 (15%)", total: "R$ 0,23" },
      { name: "Teste Taxa B", entry: "R$ 0,40", serviceFee: "R$ 0,06 (15%)", total: "R$ 0,46" },
    ],
  });
}
