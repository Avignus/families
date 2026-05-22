import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getOwnedGames, STEAM_KEY_ERROR } from "@/lib/steam";

export async function POST() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { steamId: true },
  });
  if (!dbUser?.steamId) return err("NO_STEAM", "No Steam account linked", 400);

  // Invalidate cached library so getOwnedGames fetches fresh data
  await prisma.steamUserCache.deleteMany({
    where: { userId: dbUser.steamId, type: "library" },
  });

  const result = await getOwnedGames(dbUser.steamId);

  if (result === STEAM_KEY_ERROR) {
    return err("STEAM_KEY_ERROR", "Steam API key invalid or revoked", 500);
  }

  if (result === null) {
    return err("STEAM_PRIVATE", "Steam profile is private — library unavailable", 400);
  }

  return ok({ count: result.length });
}
