import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("s") !== process.env.SEED_SECRET?.trim()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await prisma.notification.deleteMany({});
  return NextResponse.json({ ok: true, deleted: result.count });
}
