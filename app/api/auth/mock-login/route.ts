// ONLY available in development/test mode — never exposed in production.
// Allows E2E tests to log in without a real Steam account.
import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = req.nextUrl.searchParams;
  const steamId = params.get("steamId");
  const personaName = params.get("personaName");

  if (!steamId || !personaName) {
    return new NextResponse("Missing params", { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { steamId },
    update: { personaName },
    create: {
      steamId,
      personaName,
      avatarUrl: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
      avatarMedium: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg",
      avatarFull: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
    },
  });

  const token = await encode({
    token: {
      userId: user.id,
      steamId: user.steamId,
      personaName: user.personaName,
      avatarUrl: user.avatarUrl,
      avatarMedium: user.avatarMedium,
      name: user.personaName,
      picture: user.avatarFull,
    },
    secret: process.env.NEXTAUTH_SECRET ?? "test-secret",
    maxAge: 60 * 60,
  });

  const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const secure = BASE_URL.startsWith("https");
  const cookieName = secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";

  const response = NextResponse.redirect(`${BASE_URL}/dashboard`);
  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  return response;
}
