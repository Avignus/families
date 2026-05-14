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
    const res = await fetch(`${BASE}/games/history/v2?key=${KEY}&id=${encodeURIComponent(itadId)}&country=${country}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Add or remove games from the platform ITAD account's waitlist.
 * This drives the webhook — ITAD will push us when any tracked game drops in price.
 */
export async function itadWaitlistAdd(steamAppIds: number[]): Promise<void> {
  if (!KEY || steamAppIds.length === 0) return;
  try {
    // Resolve ITAD IDs first (required for waitlist API)
    const ids = (await Promise.all(steamAppIds.map(itadLookup))).filter(Boolean) as string[];
    if (ids.length === 0) return;
    await fetch(`${BASE}/waitlist/games/v1?key=${KEY}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids),
    });
  } catch { /* non-critical, best-effort */ }
}

export async function itadWaitlistRemove(steamAppIds: number[]): Promise<void> {
  if (!KEY || steamAppIds.length === 0) return;
  try {
    const ids = (await Promise.all(steamAppIds.map(itadLookup))).filter(Boolean) as string[];
    if (ids.length === 0) return;
    await fetch(`${BASE}/waitlist/games/v1?key=${KEY}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids),
    });
  } catch { /* non-critical, best-effort */ }
}
