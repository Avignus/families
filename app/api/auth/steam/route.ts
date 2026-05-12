// Steam OpenID 2.0 login entry point
// Redirects user to Steam's OpenID endpoint with the correct parameters.
import { NextRequest, NextResponse } from "next/server";

const STEAM_OPENID_URL = "https://steamcommunity.com/openid/login";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function GET(_req: NextRequest) {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${BASE_URL}/api/auth/steam/callback`,
    "openid.realm": BASE_URL,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  return NextResponse.redirect(`${STEAM_OPENID_URL}?${params.toString()}`);
}
