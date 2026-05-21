import { prisma } from "./prisma";

const STEAM_API_KEY = process.env.STEAM_API_KEY ?? "";
const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY ?? "BR";
const DEFAULT_LANG = "portuguese";

const PRICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STATIC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const LIBRARY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const WISHLIST_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type SteamAppDetails = {
  appId: number;
  name: string;
  headerImage: string;
  capsuleImage: string;
  priceCents: number;
  currency: string;
  shortDescription: string;
  isFree: boolean;
  comingSoon: boolean;
  releaseDate: string;
  genres?: string[];
};

export async function getPlayerSummaries(steamIds: string[]): Promise<SteamPlayerSummary[]> {
  if (steamIds.length === 0) return [];
  const ids = steamIds.join(",");
  const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${ids}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Steam API error: ${res.status}`);
  const data = await res.json();
  return data.response?.players ?? [];
}

export type SteamPlayerSummary = {
  steamid: string;
  personaname: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  profileurl: string;
};

export async function getAppDetails(appId: number, country = DEFAULT_COUNTRY): Promise<SteamAppDetails | null> {
  // Check cache first
  const cached = await prisma.steamAppCache.findUnique({ where: { steamAppId: appId } });
  if (cached) {
    const age = Date.now() - cached.fetchedAt.getTime();
    const hasGenres = (cached.payload as { genres?: unknown }).genres !== undefined;
    // Re-fetch if TTL expired OR if entry predates the genres field
    if (age < PRICE_CACHE_TTL_MS && hasGenres) {
      return cached.payload as unknown as SteamAppDetails;
    }
  }

  // Fetch from Steam
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${country}&l=${DEFAULT_LANG}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;
    const data = await res.json();
    const appData = data[String(appId)];
    if (!appData?.success) {
      // App unavailable/delisted — fall back to stale cache rather than losing the name
      return cached ? (cached.payload as unknown as SteamAppDetails) : null;
    }

    const d = appData.data;

    // --- Genre computation ---
    // 1. Normalize official Steam genres (may arrive in English or Portuguese depending on game)
    const GENRE_NORM: Record<string, string> = {
      "Action": "Ação", "Adventure": "Aventura", "Strategy": "Estratégia",
      "Simulation": "Simulação", "Sports": "Esportes", "Racing": "Corrida",
      "Free to Play": "Gratuito", "Grátis para Jogar": "Gratuito",
      "Massively Multiplayer": "MMO", "Multijogador Massivo Online (MMO)": "MMO",
      // filter noise
      "Early Access": "", "Acesso Antecipado": "",
    };
    const steamGenres = (d.genres as Array<{ description: string }> | undefined) ?? [];
    const genres: string[] = steamGenres
      .map((g) => GENRE_NORM[g.description] ?? g.description)
      .filter(Boolean);

    // 2. Extract Co-op from Steam categories (IDs: 9=Co-op, 38=Online Co-op, 24=Local Co-op)
    const categoryIds = new Set<number>(
      (d.categories as Array<{ id: number }> | undefined)?.map((c) => c.id) ?? []
    );
    if ([9, 38, 24].some((id) => categoryIds.has(id))) genres.push("Co-op");

    // 3. Synthesize Terror from short_description keywords (horror is a tag, not a Steam genre)
    const desc = (d.short_description ?? "").toLowerCase();
    const horrorKw = ["horror", "terror", "ghost", "haunted", "paranormal",
                      "zombie", "zombi", "undead", "assombr", "supernatural", "psychological horror"];
    if (horrorKw.some((kw) => desc.includes(kw))) genres.push("Terror");

    // 4. Synthesize Sobrevivência (survival is also a tag, not a Steam genre)
    const survivalKw = ["survival", "sobrevivência", "sobreviver", "survive", "scavenge"];
    if (survivalKw.some((kw) => desc.includes(kw))) genres.push("Sobrevivência");

    const payload: SteamAppDetails = {
      appId,
      name: d.name,
      headerImage: d.header_image,
      capsuleImage: d.capsule_imagev5 ?? d.capsule_image ?? d.header_image,
      priceCents: d.is_free ? 0 : (d.price_overview?.final ?? 0),
      currency: d.price_overview?.currency ?? country,
      shortDescription: d.short_description ?? "",
      isFree: d.is_free ?? false,
      comingSoon: d.release_date?.coming_soon ?? false,
      releaseDate: d.release_date?.date ?? "",
      genres: [...new Set(genres)],
    };

    await prisma.steamAppCache.upsert({
      where: { steamAppId: appId },
      update: { payload: payload as object, fetchedAt: new Date() },
      create: { steamAppId: appId, payload: payload as object },
    });

    return payload;
  } catch {
    // Return cached even if stale when network fails
    if (cached) return cached.payload as unknown as SteamAppDetails;
    return null;
  }
}

export async function searchAppCatalog(query: string, limit = 20): Promise<{ appId: number; name: string }[]> {
  const results = await prisma.steamAppCatalog.findMany({
    where: {
      name: { contains: query, mode: "insensitive" },
    },
    take: limit,
    orderBy: { name: "asc" },
  });
  return results.map((r) => ({ appId: r.appId, name: r.name }));
}

export type OwnedGame = {
  appId: number;
  name: string;
  playtimeMinutes: number;
};

export type SteamWishlistGame = {
  appId: number;
  name: string;
};

function steamHeaderImage(appId: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

// Sentinel distinguishing "Steam key invalid/revoked" from "profile is private"
export const STEAM_KEY_ERROR = "STEAM_KEY_ERROR" as const;
type SteamKeyError = typeof STEAM_KEY_ERROR;

// Sentinel for when Steam is rate-limiting requests
export const STEAM_RATE_LIMITED = "STEAM_RATE_LIMITED" as const;
type SteamRateLimited = typeof STEAM_RATE_LIMITED;

export async function getOwnedGames(steamId: string): Promise<OwnedGame[] | null | SteamKeyError> {
  const cached = await prisma.steamUserCache.findUnique({
    where: { userId_type: { userId: steamId, type: "library" } },
  });
  if (cached) {
    const age = Date.now() - cached.fetchedAt.getTime();
    if (age < LIBRARY_CACHE_TTL_MS) return cached.payload as unknown as OwnedGame[];
  }

  try {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`;
    const res = await fetch(url, { next: { revalidate: 0 } });

    // Fall back to stale cache rather than returning an error when key is invalid
    if (res.status === 401 || res.status === 403) {
      return cached ? (cached.payload as unknown as OwnedGame[]) : STEAM_KEY_ERROR;
    }
    if (!res.ok) return cached ? (cached.payload as unknown as OwnedGame[]) : null;

    const data = await res.json();
    // response.games absent → game list is private (profile set to Friends-only or Private)
    if (!data.response?.games) return cached ? (cached.payload as unknown as OwnedGame[]) : null;

    const games: OwnedGame[] = data.response.games.map(
      (g: { appid: number; name: string; playtime_forever?: number }) => ({
        appId: g.appid,
        name: g.name,
        playtimeMinutes: g.playtime_forever ?? 0,
      })
    );

    await prisma.steamUserCache.upsert({
      where: { userId_type: { userId: steamId, type: "library" } },
      update: { payload: games as unknown as object, fetchedAt: new Date() },
      create: { userId: steamId, type: "library", payload: games as unknown as object },
    });

    return games;
  } catch {
    return cached ? (cached.payload as unknown as OwnedGame[]) : null;
  }
}

export async function getSteamWishlist(steamId: string): Promise<SteamWishlistGame[] | null | SteamKeyError | SteamRateLimited> {
  const cached = await prisma.steamUserCache.findUnique({
    where: { userId_type: { userId: steamId, type: "wishlist" } },
  });
  if (cached) {
    const age = Date.now() - cached.fetchedAt.getTime();
    const payload = cached.payload as unknown as SteamWishlistGame[];
    // Treat cache as stale if any game still has an unresolved App # name
    const hasUnresolved = Array.isArray(payload) && payload.some((g) => g.name.startsWith("App #"));
    if (age < WISHLIST_CACHE_TTL_MS && !hasUnresolved) return payload;
  }

  try {
    // Official API endpoint — requires a valid key and respects profile privacy settings
    const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?key=${STEAM_API_KEY}&steamid=${steamId}`;
    const res = await fetch(url, { next: { revalidate: 0 } });

    if (res.status === 401 || res.status === 403) {
      return cached ? (cached.payload as unknown as SteamWishlistGame[]) : STEAM_KEY_ERROR;
    }
    if (res.status === 429) return STEAM_RATE_LIMITED;
    if (!res.ok) return cached ? (cached.payload as unknown as SteamWishlistGame[]) : null;

    const data = await res.json();
    const items: { appid: number }[] = data.response?.items ?? [];

    // Empty array means wishlist is empty or private
    if (items.length === 0) return [];

    // IWishlistService doesn't return names — resolve from catalog, then app detail cache
    const appIds = items.map((i) => i.appid);
    const catalogEntries = await prisma.steamAppCatalog.findMany({
      where: { appId: { in: appIds } },
      select: { appId: true, name: true },
    });
    const nameMap = new Map(catalogEntries.map((e) => [e.appId, e.name]));

    // For apps not in catalog, try steamAppCache (populated by getAppDetails)
    const missingIds = appIds.filter((id) => !nameMap.has(id));
    if (missingIds.length > 0) {
      const detailCacheEntries = await prisma.steamAppCache.findMany({
        where: { steamAppId: { in: missingIds } },
        select: { steamAppId: true, payload: true },
      });
      for (const entry of detailCacheEntries) {
        const name = (entry.payload as { name?: string })?.name;
        if (name) nameMap.set(entry.steamAppId, name);
      }
    }

    // For apps still unknown, fetch from Steam API in parallel
    const stillMissing = appIds.filter((id) => !nameMap.has(id));
    if (stillMissing.length > 0) {
      const results = await Promise.allSettled(stillMissing.map((id) => getAppDetails(id)));
      results.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value?.name) {
          nameMap.set(stillMissing[i], result.value.name);
        }
      });
    }

    const games: SteamWishlistGame[] = appIds.map((appId) => ({
      appId,
      name: nameMap.get(appId) ?? `App #${appId}`,
    }));

    await prisma.steamUserCache.upsert({
      where: { userId_type: { userId: steamId, type: "wishlist" } },
      update: { payload: games as unknown as object, fetchedAt: new Date() },
      create: { userId: steamId, type: "wishlist", payload: games as unknown as object },
    });

    return games;
  } catch {
    return cached ? (cached.payload as unknown as SteamWishlistGame[]) : null;
  }
}

// Exposed so UI can build consistent image URLs without duplicating the CDN pattern
export { steamHeaderImage };

export async function refreshAppCatalog(): Promise<void> {
  try {
    const url = "https://api.steampowered.com/ISteamApps/GetAppList/v2/";
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const apps: { appid: number; name: string }[] = data.applist?.apps ?? [];

    // Batch upsert in chunks to avoid overwhelming DB
    const CHUNK = 500;
    for (let i = 0; i < apps.length; i += CHUNK) {
      const chunk = apps.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map((app) =>
          prisma.steamAppCatalog.upsert({
            where: { appId: app.appid },
            update: { name: app.name, updatedAt: new Date() },
            create: { appId: app.appid, name: app.name },
          })
        )
      );
    }
  } catch (err) {
    console.error("Failed to refresh Steam app catalog:", err);
  }
}
