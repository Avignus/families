import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isAuthorized(req: NextRequest) {
  const secret = process.env.RESET_TEMP_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const personaName = req.nextUrl.searchParams.get("personaName");
  if (!personaName) return NextResponse.json({ error: "personaName required" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { personaName: { contains: personaName, mode: "insensitive" } },
    select: { id: true, personaName: true },
  });
  return NextResponse.json({ user });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const result = await prisma.familyMembership.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true, deleted: result.count });
}
