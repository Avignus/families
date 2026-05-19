import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSteamWishlist, STEAM_KEY_ERROR, STEAM_RATE_LIMITED } from "@/lib/steam";

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1500;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { steamId: true },
  });
  if (!dbUser?.steamId) return err("NO_STEAM", "No Steam account linked", 400);

  // Invalidate cached wishlist so getSteamWishlist fetches fresh data
  await prisma.steamUserCache.deleteMany({
    where: { userId: dbUser.steamId, type: "wishlist" },
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    const result = await getSteamWishlist(dbUser.steamId);

    if (result === STEAM_KEY_ERROR) {
      return err("STEAM_KEY_ERROR", "Steam API key invalid or revoked", 500);
    }

    if (result === STEAM_RATE_LIMITED) {
      // Will retry on next iteration (with backoff)
      continue;
    }

    if (result === null) {
      return err("STEAM_PRIVATE", "Steam profile is private — wishlist unavailable", 400);
    }

    return ok({ count: result.length });
  }

  return err("RATE_LIMITED", "Steam rate limit exceeded — try again in a few seconds", 429);
}
