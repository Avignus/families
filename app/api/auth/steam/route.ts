// Steam OpenID 2.0 login entry point
// Redirects user to Steam's OpenID endpoint with the correct parameters.
// Accepts ?callbackUrl= to redirect after successful login (must be a relative path).
import { NextRequest, NextResponse } from "next/server";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${BASE_URL}/api/auth/steam/callback`,
    "openid.realm": BASE_URL,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  const response = NextResponse.redirect(`${STEAM_OPENID_URL}?${params.toString()}`);

  // Store callbackUrl in a short-lived cookie so the callback can use it
  const callbackUrl = req.nextUrl.searchParams.get("callbackUrl");
  if (callbackUrl?.startsWith("/")) {
    response.cookies.set("steam_callback_url", callbackUrl, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 300, // 5 min — enough for the Steam login round-trip
    });
  }

  return response;
}
