import { NextAuthOptions, getServerSession } from "next-auth";

// Steam OpenID 2.0 provider wired into NextAuth as a custom credentials-style provider.
// We use node-steam-openid to handle the OpenID handshake and then call
// ISteamUser/GetPlayerSummaries to populate the user profile.
const SteamProvider = {
  id: "steam",
  name: "Steam",
  type: "oauth" as const,
  authorization: {
    url: "https://steamcommunity.com/openid/login",
    params: {
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": `${process.env.NEXTAUTH_URL}/api/auth/callback/steam`,
      "openid.realm": process.env.NEXTAUTH_URL,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    },
  },
  token: {
    url: `${process.env.NEXTAUTH_URL}/api/auth/steam-token`,
  },
  userinfo: {
    url: `${process.env.NEXTAUTH_URL}/api/auth/steam-userinfo`,
  },
  profile(profile: { steamId: string; personaName: string; avatarUrl: string; avatarMedium: string; avatarFull: string; profileUrl: string }) {
    return {
      id: profile.steamId,
      name: profile.personaName,
      email: null,
      image: profile.avatarFull,
      steamId: profile.steamId,
      personaName: profile.personaName,
      avatarUrl: profile.avatarUrl,
      avatarMedium: profile.avatarMedium,
      avatarFull: profile.avatarFull,
      profileUrl: profile.profileUrl,
    };
  },
  clientId: "steam",
  clientSecret: process.env.STEAM_API_KEY ?? "",
};

export const authOptions: NextAuthOptions = {
  providers: [SteamProvider],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.steamId = (user as { steamId?: string }).steamId;
        token.userId = user.id;
        token.personaName = (user as { personaName?: string }).personaName;
        token.avatarUrl = (user as { avatarUrl?: string }).avatarUrl;
        token.avatarMedium = (user as { avatarMedium?: string }).avatarMedium;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id?: string }).id = token.userId as string;
        (session.user as { steamId?: string }).steamId = token.steamId as string;
        (session.user as { personaName?: string }).personaName = token.personaName as string;
        (session.user as { avatarUrl?: string }).avatarUrl = token.avatarUrl as string;
        (session.user as { avatarMedium?: string }).avatarMedium = token.avatarMedium as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return `${baseUrl}/dashboard`;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getSession() {
  return getServerSession(authOptions);
}

export type SessionUser = {
  id: string;
  steamId: string;
  personaName: string;
  avatarUrl: string;
  avatarMedium: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};
