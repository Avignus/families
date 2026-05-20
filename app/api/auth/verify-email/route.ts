import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(`${BASE_URL}/settings?emailVerified=invalid`);

  const user = await prisma.user.findUnique({
    where: { emailVerifyToken: token },
    select: { id: true, emailPending: true, emailVerifyExpiry: true },
  });

  if (!user || !user.emailPending) {
    return NextResponse.redirect(`${BASE_URL}/settings?emailVerified=invalid`);
  }

  if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
    return NextResponse.redirect(`${BASE_URL}/settings?emailVerified=expired`);
  }

  // Check the pending email isn't already taken by someone else
  const conflict = await prisma.user.findFirst({
    where: { email: user.emailPending, id: { not: user.id } },
    select: { id: true },
  });
  if (conflict) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailPending: null, emailVerifyToken: null, emailVerifyExpiry: null },
    });
    return NextResponse.redirect(`${BASE_URL}/settings?emailVerified=conflict`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: user.emailPending,
      emailPending: null,
      emailVerifyToken: null,
      emailVerifyExpiry: null,
    },
  });

  return NextResponse.redirect(`${BASE_URL}/settings?emailVerified=ok`);
}
