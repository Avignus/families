import { prisma } from "./prisma";

const STEAM_API_KEY = process.env.STEAM_API_KEY ?? "";
const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY ?? "BR";
const DEFAULT_LANG = "portuguese";

const PRICE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STATIC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type SteamAppDetails = {
  appId: number;
  name: string;
  headerImage: string;
  capsuleImage: string;
  priceCents: number;
  currency: string;
  shortDescription: string;
  isFree: boolean;
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
    if (age < PRICE_CACHE_TTL_MS) {
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
    if (!appData?.success) return null;

    const d = appData.data;
    const payload: SteamAppDetails = {
      appId,
      name: d.name,
      headerImage: d.header_image,
      capsuleImage: d.capsule_imagev5 ?? d.capsule_image ?? d.header_image,
      priceCents: d.is_free ? 0 : (d.price_overview?.final ?? 0),
      currency: d.price_overview?.currency ?? country,
      shortDescription: d.short_description ?? "",
      isFree: d.is_free ?? false,
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
