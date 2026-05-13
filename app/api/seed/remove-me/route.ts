import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("s");
  if (secret !== process.env.SEED_SECRET?.trim()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const user = await prisma.user.findFirst({ where: { personaName: "Avignus" } });
  if (!user) return NextResponse.json({ ok: false, error: "user not found" });

  const result = await prisma.familyMembership.deleteMany({
    where: {
      userId: user.id,
      familyId: { in: ["prod-test-1", "prod-test-2"] },
    },
  });

  return NextResponse.json({ ok: true, removed: result.count });
}
