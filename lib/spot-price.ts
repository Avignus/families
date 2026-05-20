import { prisma } from "./prisma";
import { getAppDetails } from "./steam";

export type SpotPriceResult = {
  spotPriceCents: number;
  familyValueCents: number;       // Σ price(family games buyer doesn't own)
  buyerContributionCents: number; // Σ price(buyer games family doesn't own)
  netValueCents: number;          // max(0, familyValue - buyerContribution)
  fraction: number;               // applied fraction (0.0–1.0)
  minPriceCents: number;          // applied floor
  coverage: {
    familyGamesTotal: number;  // unique games in family library buyer doesn't own
    familyGamesPriced: number; // of those, how many had a price in cache
    buyerGamesTotal: number;   // unique games buyer brings to the family
    buyerGamesPriced: number;
  };
};

export async function calculateSpotPrice(
  familyId: string,
  buyerUserId: string
): Promise<SpotPriceResult> {
  const family = await prisma.family.findUniqueOrThrow({
    where: { id: familyId },
    select: { spotFraction: true, spotMinPriceCents: true },
  });

  // Active members, excluding the buyer — we need steamIds because SteamUserCache is keyed by steamId
  const memberUsers = await prisma.familyMembership
    .findMany({
      where: { familyId, status: "active", userId: { not: buyerUserId } },
      include: { user: { select: { steamId: true } } },
    });
  const memberSteamIds = memberUsers.map((m) => m.user.steamId);

  // Buyer's steamId
  const buyerUser = await prisma.user.findUnique({
    where: { id: buyerUserId },
    select: { steamId: true },
  });
  const buyerSteamId = buyerUser?.steamId ?? buyerUserId;

  // Library caches — keyed by steamId in the DB
  const [memberCaches, buyerCaches] = await Promise.all([
    prisma.steamUserCache.findMany({
      where: { type: "library", userId: { in: memberSteamIds } },
      select: { payload: true },
    }),
    prisma.steamUserCache.findMany({
      where: { type: "library", userId: buyerSteamId },
      select: { payload: true },
    }),
  ]);

  const familyAppIds = new Set<number>();
  for (const cache of memberCaches) {
    for (const game of cache.payload as Array<{ appId: number }>) {
      if (game.appId) familyAppIds.add(game.appId);
    }
  }

  const buyerAppIds = new Set<number>();
  for (const cache of buyerCaches) {
    for (const game of cache.payload as Array<{ appId: number }>) {
      if (game.appId) buyerAppIds.add(game.appId);
    }
  }

  // Games family has that buyer doesn't own → value buyer receives
  const familyUniqueForBuyer = [...familyAppIds].filter((id) => !buyerAppIds.has(id));
  // Games buyer has that family doesn't own → buyer's contribution
  const buyerUniqueForFamily = [...buyerAppIds].filter((id) => !familyAppIds.has(id));

  // Fetch prices for all relevant appIds in one query
  const allRelevantIds = [
    ...new Set([...familyUniqueForBuyer, ...buyerUniqueForFamily]),
  ];

  const priceCaches = await prisma.steamAppCache.findMany({
    where: { steamAppId: { in: allRelevantIds } },
    select: { steamAppId: true, payload: true },
  });

  const priceMap = new Map<number, number>();
  const cachedIds = new Set<number>();
  for (const cache of priceCaches) {
    cachedIds.add(cache.steamAppId);
    const p = cache.payload as { priceCents?: number; isFree?: boolean };
    if (!p.isFree && p.priceCents && p.priceCents > 0) {
      priceMap.set(cache.steamAppId, p.priceCents);
    }
  }

  // Fetch prices for uncached games (on-demand, capped to avoid slow responses)
  const uncachedIds = allRelevantIds.filter((id) => !cachedIds.has(id)).slice(0, 30);
  if (uncachedIds.length > 0) {
    await Promise.allSettled(uncachedIds.map(async (appId) => {
      const details = await getAppDetails(appId);
      if (details && !details.isFree && details.priceCents > 0) {
        priceMap.set(appId, details.priceCents);
      }
    }));
  }

  let familyValueCents = 0;
  let familyGamesPriced = 0;
  for (const appId of familyUniqueForBuyer) {
    const price = priceMap.get(appId);
    if (price) {
      familyValueCents += price;
      familyGamesPriced++;
    }
  }

  let buyerContributionCents = 0;
  let buyerGamesPriced = 0;
  for (const appId of buyerUniqueForFamily) {
    const price = priceMap.get(appId);
    if (price) {
      buyerContributionCents += price;
      buyerGamesPriced++;
    }
  }

  const netValueCents = Math.max(0, familyValueCents - buyerContributionCents);
  const spotPriceCents = Math.max(
    family.spotMinPriceCents,
    Math.round(netValueCents * family.spotFraction)
  );

  return {
    spotPriceCents,
    familyValueCents,
    buyerContributionCents,
    netValueCents,
    fraction: family.spotFraction,
    minPriceCents: family.spotMinPriceCents,
    coverage: {
      familyGamesTotal: familyUniqueForBuyer.length,
      familyGamesPriced,
      buyerGamesTotal: buyerUniqueForFamily.length,
      buyerGamesPriced,
    },
  };
}
