// Steam OpenID 2.0 callback — validates the OpenID return, fetches Steam profile,
// upserts the user in DB, and creates a NextAuth session.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlayerSummaries } from "@/lib/steam";
import { encode } from "next-auth/jwt";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function extractSteamId(claimedId: string): string | null {
  const match = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);
  return match ? match[1] : null;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("openid.mode");

  if (mode !== "id_res") {
    return NextResponse.redirect(`${BASE_URL}/?error=steam_cancelled`);
  }

  // Verify the OpenID response by sending it back to Steam with mode=check_authentication
  const verifyParams = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    verifyParams.set(key, value);
  }
  verifyParams.set("openid.mode", "check_authentication");

  const verifyRes = await fetch(STEAM_OPENID_URL, {
    method: "POST",
    body: verifyParams,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const verifyText = await verifyRes.text();
  if (!verifyText.includes("is_valid:true")) {
    return NextResponse.redirect(`${BASE_URL}/?error=steam_invalid`);
  }

  const claimedId = params.get("openid.claimed_id") ?? "";
  const steamId = extractSteamId(claimedId);
  if (!steamId) {
    return NextResponse.redirect(`${BASE_URL}/?error=steam_id_missing`);
  }

  // Fetch profile from Steam (best-effort — fall back to steamId as name if API fails)
  let player;
  try {
    const players = await getPlayerSummaries([steamId]);
    player = players[0];
  } catch (e) {
    console.error("Steam profile fetch failed:", e);
  }

  const personaName = player?.personaname ?? `Steam user ${steamId.slice(-6)}`;
  const avatarUrl = player?.avatar ?? "";
  const avatarMedium = player?.avatarmedium ?? "";
  const avatarFull = player?.avatarfull ?? "";
  const profileUrl = player?.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`;

  // Only update profile fields if Steam API returned real data
  const hasRealProfile = !!player;
  const user = await prisma.user.upsert({
    where: { steamId },
    update: hasRealProfile
      ? { personaName, avatarUrl, avatarMedium, avatarFull, profileUrl }
      : {},
    create: { steamId, personaName, avatarUrl, avatarMedium, avatarFull, profileUrl },
  });

  // Create a NextAuth JWT manually
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
    secret: process.env.NEXTAUTH_SECRET ?? "",
    maxAge: 30 * 24 * 60 * 60,
  });

  const response = NextResponse.redirect(`${BASE_URL}/dashboard`);
  const secure = BASE_URL.startsWith("https");
  const cookieName = secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
