const BASE = "https://api.isthereanydeal.com";
const KEY = process.env.ITAD_API_KEY ?? "";

export type ItadPriceRecord = {
  price: { amount: number; currency: string };
  regular: { amount: number; currency: string };
  cut: number;
  timestamp: string; // ISO 8601
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

