import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, isApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.headers.get("x-seed-secret") !== process.env.SEED_SECRET?.trim()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const user = await requireSession();
  if (isApiError(user)) return NextResponse.json({ ok: false, error: "not logged in" });

  const result = await prisma.familyMembership.deleteMany({
    where: {
      userId: user.id,
      familyId: { in: ["prod-test-1", "prod-test-2"] },
    },
  });

  return NextResponse.json({ ok: true, removed: result.count, userId: user.id });
}
