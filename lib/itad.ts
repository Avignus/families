import { prisma } from "./prisma";

const BASE = "https://api.isthereanydeal.com";
const KEY = process.env.ITAD_API_KEY ?? "";

const DEALS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export type ItadPriceRecord = {
  price: { amount: number; currency: string };
  regular: { amount: number; currency: string };
  cut: number;
  timestamp: string; // ISO 8601
};

export type ItadDeal = {
  shopId: number;
  shopName: string;
  priceCents: number;
  cut: number;
  url: string;
};

/** Resolve a Steam appId to an ITAD game ID. Returns null if not found or key missing. */
export async function itadLookup(steamAppId: number): Promise<string | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}/games/lookup/v1?key=${KEY}&appid=${steamAppId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.game?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Fetch price history for an ITAD game ID. Returns empty array on error. */
export async function itadPriceHistory(itadId: string, country = "BR"): Promise<ItadPriceRecord[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(`${BASE}/games/history/v2?key=${KEY}&id=${encodeURIComponent(itadId)}&country=${encodeURIComponent(country)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Fetch current deals across all stores for an ITAD game ID. */
async function itadCurrentPrices(itadId: string, country = "BR"): Promise<ItadDeal[]> {
  if (!KEY) return [];
  try {
    const res = await fetch(
      `${BASE}/games/prices/v3?key=${KEY}&country=${encodeURIComponent(country)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([itadId]),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const gameEntry = Array.isArray(data) ? data[0] : null;
    if (!gameEntry?.deals) return [];
    return (gameEntry.deals as Array<{
      shop: { id: number; name: string };
      price: { amount: number; amountInt: number; currency: string };
      cut: number;
      url: string;
    }>).map((d) => ({
      shopId: d.shop.id,
      shopName: d.shop.name,
      priceCents: d.price.amountInt,
      cut: d.cut,
      url: d.url,
    }));
  } catch {
    return [];
  }
}

/**
 * Returns current deals for a Steam app, caching the result in SteamAppCache.
 * Non-Steam deals cheaper than the Steam price are returned sorted by price.
 */
export async function itadGetDealsForApp(steamAppId: number, steamPriceCents: number): Promise<ItadDeal[]> {
  if (!KEY) return [];

  const cached = await prisma.steamAppCache.findUnique({ where: { steamAppId } });
  const payload = (cached?.payload ?? {}) as Record<string, unknown>;

  const cachedDeals = payload._itadDeals as ItadDeal[] | undefined;
  const cachedAt = payload._itadDealsAt as number | undefined;
  const cachedItadId = payload._itadId as string | undefined;

  const fresh = cachedAt && Date.now() - cachedAt < DEALS_CACHE_TTL_MS;
  if (fresh && cachedDeals) {
    return cachedDeals.filter((d) => d.shopId !== 61 && d.priceCents < steamPriceCents);
  }

  const itadId = cachedItadId ?? await itadLookup(steamAppId);
  if (!itadId) return [];

  const deals = await itadCurrentPrices(itadId);

  if (cached) {
    await prisma.steamAppCache.update({
      where: { steamAppId },
      data: {
        payload: { ...payload, _itadId: itadId, _itadDeals: deals, _itadDealsAt: Date.now() },
      },
    });
  }

  // Exclude Steam itself (ITAD shop id 61) and keep only deals cheaper than Steam
  return deals.filter((d) => d.shopId !== 61 && d.priceCents < steamPriceCents);
}
