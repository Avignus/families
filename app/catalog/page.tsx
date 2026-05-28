import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { CatalogClient } from "@/components/catalog/catalog-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

type LibraryStats = { totalGames: number; ownedGames: number; missingGames: number };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: {
    q?: string;
    page?: string;
    minPrice?: string;
    maxPrice?: string;
    minGames?: string;
    maxGames?: string;
    minOwned?: string;
    maxOwned?: string;
    minMissing?: string;
    maxMissing?: string;
    genre?: string | string[];
    games?: string | string[];
  };
}) {
  const session = await getSession();
  const currentUserId = (session?.user as { id?: string })?.id ?? null;
  const currentSteamId = (session?.user as { steamId?: string })?.steamId ?? null;

  const hasActiveFamily = currentUserId
    ? !!(await prisma.familyMembership.findFirst({
        where: { userId: currentUserId, status: "active" },
        select: { id: true },
      }))
    : false;

  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const genreFilter = searchParams.genre
    ? Array.isArray(searchParams.genre) ? searchParams.genre : [searchParams.genre]
    : [];
  const gameFilter = searchParams.games
    ? (Array.isArray(searchParams.games) ? searchParams.games : [searchParams.games])
        .map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  const minPriceCents = searchParams.minPrice ? Math.round(parseFloat(searchParams.minPrice) * 100) : null;
  const maxPriceCents = searchParams.maxPrice ? Math.round(parseFloat(searchParams.maxPrice) * 100) : null;
  const minGames = searchParams.minGames ? parseInt(searchParams.minGames) : null;
  const maxGames = searchParams.maxGames ? parseInt(searchParams.maxGames) : null;
  const minOwned = searchParams.minOwned ? parseInt(searchParams.minOwned) : null;
  const maxOwned = searchParams.maxOwned ? parseInt(searchParams.maxOwned) : null;
  const minMissing = searchParams.minMissing ? parseInt(searchParams.minMissing) : null;
  const maxMissing = searchParams.maxMissing ? parseInt(searchParams.maxMissing) : null;

  const hasGameFilters =
    minGames !== null || maxGames !== null ||
    minOwned !== null || maxOwned !== null ||
    minMissing !== null || maxMissing !== null;

  // Build WHERE clause for DB-level filtering
  const where: Record<string, unknown> = { isPublic: true };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { id: q },
    ];
  }
  if (minPriceCents !== null || maxPriceCents !== null) {
    const priceFilter: Record<string, number> = {};
    if (minPriceCents !== null) priceFilter.gte = minPriceCents;
    if (maxPriceCents !== null) priceFilter.lte = maxPriceCents;
    where.entryFeeCents = priceFilter;
  }
  if (gameFilter.length > 0) {
    where.wishlistItems = {
      some: { steamAppId: { in: gameFilter }, status: { not: "cancelled" } },
    };
  }

  // Load all families matching text + price (needed for in-memory game filters)
  const allFamilies = await prisma.family.findMany({
    where,
    include: {
      chief: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } },
      _count: { select: { memberships: { where: { status: "active" } } } },
      activeCoverTheme:   { select: { config: true, rarity: true, slug: true } },
      activeCoverOverlay: { select: { config: true, rarity: true, slug: true } },
      activeCoverVideo:   { select: { config: true, rarity: true, slug: true } },
      ...(currentUserId
        ? { memberships: { where: { userId: currentUserId }, select: { status: true, pixPaymentId: true, feePaidAt: true } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  // familyScore is available on all family rows since the migration
  // spotPricingEnabled is available on all family rows since the migration

  // Compute library stats when user is logged in or game filters are active.
  // familyAppIdsMap is also used for cover images, so it's declared outside the block.
  const familyLibraryStats = new Map<string, LibraryStats>();
  const familyAppIdsMap = new Map<string, Set<number>>();
  // Hoisted so the game-names section below can reference it
  const userAppIds = new Set<number>();

  let needsLibrarySync = false;

  if (currentSteamId || hasGameFilters) {
    if (currentSteamId) {
      const userCache = await prisma.steamUserCache.findUnique({
        where: { userId_type: { userId: currentSteamId, type: "library" } },
        select: { payload: true },
      });
      if (userCache) {
        const games = userCache.payload as Array<{ appId: number }>;
        if (Array.isArray(games)) games.forEach((g) => userAppIds.add(g.appId));
      } else {
        needsLibrarySync = true;
      }
    }


    // Batch-load all active memberships for all families
    const allMemberships = await prisma.familyMembership.findMany({
      where: {
        familyId: { in: allFamilies.map((f) => f.id) },
        status: "active",
      },
      select: { familyId: true, user: { select: { steamId: true } } },
    });

    // Batch-load all Steam library caches for those members
    const allSteamIds = [...new Set(allMemberships.map((m) => m.user.steamId))];
    const libraryCaches = await prisma.steamUserCache.findMany({
      where: { userId: { in: allSteamIds }, type: "library" },
      select: { userId: true, payload: true },
    });

    const steamLibMap = new Map<string, Set<number>>();
    for (const cache of libraryCaches) {
      const games = cache.payload as Array<{ appId: number }>;
      const appIds = new Set<number>();
      if (Array.isArray(games)) games.forEach((g) => appIds.add(g.appId));
      steamLibMap.set(cache.userId, appIds);
    }

    const familyMemberMap = new Map<string, string[]>();
    for (const m of allMemberships) {
      const arr = familyMemberMap.get(m.familyId) ?? [];
      arr.push(m.user.steamId);
      familyMemberMap.set(m.familyId, arr);
    }

    for (const family of allFamilies) {
      const memberSteamIds = familyMemberMap.get(family.id) ?? [];
      const appIds = new Set<number>();
      for (const steamId of memberSteamIds) {
        steamLibMap.get(steamId)?.forEach((id) => appIds.add(id));
      }
      familyAppIdsMap.set(family.id, appIds);

      const totalGames = appIds.size;
      let ownedGames = 0;
      for (const appId of appIds) {
        if (userAppIds.has(appId)) ownedGames++;
      }

      familyLibraryStats.set(family.id, {
        totalGames,
        ownedGames,
        missingGames: totalGames - ownedGames,
      });
    }
  }

  // Apply in-memory game-count filters
  const filteredFamilies = hasGameFilters
    ? allFamilies.filter((f) => {
        const s = familyLibraryStats.get(f.id);
        if (!s) return false;
        if (minGames !== null && s.totalGames < minGames) return false;
        if (maxGames !== null && s.totalGames > maxGames) return false;
        if (minOwned !== null && s.ownedGames < minOwned) return false;
        if (maxOwned !== null && s.ownedGames > maxOwned) return false;
        if (minMissing !== null && s.missingGames < minMissing) return false;
        if (maxMissing !== null && s.missingGames > maxMissing) return false;
        return true;
      })
    : allFamilies;

  // --- Genre computation & filtering ---
  // Read genres from SteamAppCache (no extra API calls — populated when cover images are fetched).
  // Falls back gracefully for families whose wishlist games aren't cached yet.
  const familyTopGenresMap = new Map<string, string[]>();

  const allWishlistRows = await prisma.wishlistItem.findMany({
    where: { familyId: { in: filteredFamilies.map((f) => f.id) }, status: { not: "cancelled" } },
    select: { familyId: true, steamAppId: true },
  });
  const allWishlistAppIds = [...new Set(allWishlistRows.map((r) => r.steamAppId))];
  const genreCacheRows = allWishlistAppIds.length > 0
    ? await prisma.steamAppCache.findMany({
        where: { steamAppId: { in: allWishlistAppIds } },
        select: { steamAppId: true, payload: true },
      })
    : [];
  const appGenreMap = new Map<number, string[]>();
  for (const c of genreCacheRows) {
    const genres = (c.payload as { genres?: string[] }).genres;
    if (genres?.length) appGenreMap.set(c.steamAppId, genres);
  }

  // Bootstrap: for games whose cache predates genre support, refresh up to 20 now
  // so the filter works on first page load (price-sync cron keeps the rest warm).
  const noGenreIds = allWishlistAppIds.filter((id) => !appGenreMap.has(id)).slice(0, 20);
  if (noGenreIds.length > 0) {
    const BATCH = 5;
    for (let i = 0; i < noGenreIds.length; i += BATCH) {
      const batch = noGenreIds.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map((id) => getAppDetails(id)));
      for (const r of results) {
        if (r.status === "fulfilled" && r.value?.genres?.length) {
          appGenreMap.set(r.value.appId, r.value.genres);
        }
      }
    }
  }

  const familyWishlistAppIds = new Map<string, number[]>();
  for (const r of allWishlistRows) {
    const arr = familyWishlistAppIds.get(r.familyId) ?? [];
    arr.push(r.steamAppId);
    familyWishlistAppIds.set(r.familyId, arr);
  }
  for (const f of filteredFamilies) {
    const counts = new Map<string, number>();
    for (const appId of (familyWishlistAppIds.get(f.id) ?? [])) {
      for (const g of (appGenreMap.get(appId) ?? [])) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
    familyTopGenresMap.set(f.id, top);
  }

  const genreFilteredFamilies = genreFilter.length > 0
    ? filteredFamilies.filter((f) => {
        const familyGenres = familyTopGenresMap.get(f.id) ?? [];
        return genreFilter.some((g) => familyGenres.includes(g));
      })
    : filteredFamilies;

  const total = genreFilteredFamilies.length;
  const skip = (page - 1) * PAGE_SIZE;
  const pagedFamilies = genreFilteredFamilies.slice(skip, skip + PAGE_SIZE);

  // For paginated families whose library data wasn't loaded above (anonymous user,
  // no game filters), load it now so covers can use owned games too.
  const familiesToLoad = pagedFamilies.filter((f) => !familyAppIdsMap.has(f.id));
  if (familiesToLoad.length > 0) {
    const mships = await prisma.familyMembership.findMany({
      where: { familyId: { in: familiesToLoad.map((f) => f.id) }, status: "active" },
      select: { familyId: true, user: { select: { steamId: true } } },
    });
    const steamIds = [...new Set(mships.map((m) => m.user.steamId))];
    const libMap = new Map<string, Set<number>>();
    if (steamIds.length > 0) {
      const caches = await prisma.steamUserCache.findMany({
        where: { userId: { in: steamIds }, type: "library" },
        select: { userId: true, payload: true },
      });
      for (const cache of caches) {
        const games = cache.payload as Array<{ appId: number }>;
        const ids = new Set<number>();
        if (Array.isArray(games)) games.forEach((g) => ids.add(g.appId));
        libMap.set(cache.userId, ids);
      }
    }
    for (const family of familiesToLoad) {
      const memberSteamIds = mships
        .filter((m) => m.familyId === family.id)
        .map((m) => m.user.steamId);
      const ids = new Set<number>();
      for (const steamId of memberSteamIds) {
        libMap.get(steamId)?.forEach((id) => ids.add(id));
      }
      familyAppIdsMap.set(family.id, ids);
    }
  }

  // Pre-compute spot prices for logged-in users, reusing already-loaded library data.
  // Uses only cached Steam prices (no API calls) — fast enough for the listing.
  const familySpotPricesMap = new Map<string, number>();
  if (currentSteamId) {
    const spotFamilies = pagedFamilies.filter((f) => f.spotPricingEnabled);
    if (spotFamilies.length > 0) {
      const allPricingIds = new Set<number>();
      for (const f of spotFamilies) {
        const familyIds = familyAppIdsMap.get(f.id) ?? new Set<number>();
        for (const id of familyIds) { if (!userAppIds.has(id)) allPricingIds.add(id); }
        for (const id of userAppIds) { if (!familyIds.has(id)) allPricingIds.add(id); }
      }
      const priceCaches = allPricingIds.size > 0
        ? await prisma.steamAppCache.findMany({
            where: { steamAppId: { in: [...allPricingIds] } },
            select: { steamAppId: true, payload: true },
          })
        : [];
      const priceMap = new Map<number, number>();
      for (const cache of priceCaches) {
        const p = cache.payload as { priceCents?: number; isFree?: boolean };
        if (!p.isFree && p.priceCents && p.priceCents > 0) priceMap.set(cache.steamAppId, p.priceCents);
      }
      for (const f of spotFamilies) {
        const familyIds = familyAppIdsMap.get(f.id) ?? new Set<number>();
        let familyValueCents = 0;
        for (const id of familyIds) { if (!userAppIds.has(id)) familyValueCents += priceMap.get(id) ?? 0; }
        let buyerContributionCents = 0;
        for (const id of userAppIds) { if (!familyIds.has(id)) buyerContributionCents += priceMap.get(id) ?? 0; }
        const netValueCents = Math.max(0, familyValueCents - buyerContributionCents);
        const spotPriceCents = Math.max(f.spotMinPriceCents, Math.round(netValueCents * f.spotFraction));
        familySpotPricesMap.set(f.id, spotPriceCents);
      }
    }
  }

  // Determine which game names to surface per paginated family:
  // - Logged-in + has missing games → names of games they'd gain (up to 4)
  // - Otherwise → sample of library games for context (up to 4, hash-offset per family)
  const gameNameAppIdsPerFamily = new Map<string, { ids: number[]; label: "missing" | "library" }>();
  for (const f of pagedFamilies) {
    const stats = familyLibraryStats.get(f.id);
    const libIds = familyAppIdsMap.get(f.id);
    if (!libIds || libIds.size === 0) continue;

    if (currentSteamId && stats && stats.missingGames > 0) {
      const missing: number[] = [];
      for (const id of libIds) {
        if (!userAppIds.has(id)) { missing.push(id); if (missing.length >= 4) break; }
      }
      gameNameAppIdsPerFamily.set(f.id, { ids: missing, label: "missing" });
    } else {
      let h = 5381;
      for (let i = 0; i < f.id.length; i++) h = (((h << 5) + h) ^ f.id.charCodeAt(i)) >>> 0;
      const arr = [...libIds];
      const offset = h % arr.length;
      const sample = [
        ...arr.slice(offset, offset + 4),
        ...arr.slice(0, Math.max(0, offset + 4 - arr.length)),
      ].slice(0, 4);
      gameNameAppIdsPerFamily.set(f.id, { ids: sample, label: "library" });
    }
  }

  // Batch-lookup names from SteamAppCatalog (single query for all paged families)
  const allNameIds = [
    ...new Set([...gameNameAppIdsPerFamily.values()].flatMap((v) => v.ids)),
  ];
  const nameRows = allNameIds.length > 0
    ? await prisma.steamAppCatalog.findMany({
        where: { appId: { in: allNameIds } },
        select: { appId: true, name: true },
      })
    : [];
  const nameMap = new Map(nameRows.map((r) => [r.appId, r.name]));

  // Load cover images for the paginated slice.
  // Priority: library games (cached) → wishlist games → client falls back to hash SVG.
  const items = await Promise.all(
    pagedFamilies.map(async (f) => {
      const memberCount = f._count.memberships;

      // Wishlist games first (family-specific, so each card looks different)
      const wishlistItems = await prisma.wishlistItem.findMany({
        where: { familyId: f.id, status: { not: "cancelled" } },
        select: { steamAppId: true },
        take: 4,
        orderBy: { createdAt: "desc" },
      });
      const wishlistCovers = (
        await Promise.all(
          wishlistItems.map((item) =>
            getAppDetails(item.steamAppId).then((d) => d?.headerImage ?? null)
          )
        )
      ).filter(Boolean) as string[];

      let covers: string[] = wishlistCovers;

      // Fill remaining slots from library games (cached only).
      // Use a hash offset so different families sample different games.
      if (covers.length < 4) {
        const libraryIds = familyAppIdsMap.get(f.id);
        if (libraryIds && libraryIds.size > 0) {
          const libArr = [...libraryIds];
          // Deterministic offset per family for visual variety
          let h = 5381;
          for (let i = 0; i < f.id.length; i++) h = (((h << 5) + h) ^ f.id.charCodeAt(i)) >>> 0;
          const offset = h % libArr.length;
          const sampleIds = [
            ...libArr.slice(offset, offset + 200),
            ...libArr.slice(0, Math.max(0, offset + 200 - libArr.length)),
          ].slice(0, 200);
          const wishlistAppIds = new Set(wishlistItems.map((w) => w.steamAppId));
          const excludeIds = [...wishlistAppIds];
          const cached = await prisma.steamAppCache.findMany({
            where: {
              steamAppId: {
                in: sampleIds,
                ...(excludeIds.length > 0 ? { notIn: excludeIds } : {}),
              },
            },
            select: { payload: true },
            take: 4 - covers.length,
          });
          const libCovers = cached
            .map((c) => (c.payload as Record<string, unknown>)?.headerImage as string | undefined ?? "")
            .filter(Boolean);
          covers = [...covers, ...libCovers];
        }
      }
      const myMembership =
        currentUserId &&
        "memberships" in f &&
        Array.isArray((f as { memberships?: unknown[] }).memberships) &&
        (f as { memberships?: unknown[] }).memberships!.length
          ? ((f as { memberships?: { status: string; pixPaymentId: string | null; feePaidAt: Date | null }[] }).memberships![0])
          : null;

      return {
        id: f.id,
        name: f.name,
        description: f.description,
        currency: f.currency,
        isPublic: f.isPublic,
        entryFeeCents: f.entryFeeCents,
        spotPricingEnabled: f.spotPricingEnabled,
        maxMembers: f.maxMembers,
        memberCount,
        spotsLeft: f.maxMembers ? f.maxMembers - memberCount : null,
        isFull: f.maxMembers ? memberCount >= f.maxMembers : false,
        chief: f.chief,
        gameCovers: covers,
        myStatus: myMembership?.status ?? null,
        hasPendingPix: !!(myMembership?.status === "pending" && myMembership.pixPaymentId && !myMembership.feePaidAt),
        spotPriceCents: familySpotPricesMap.get(f.id) ?? null,
        familyScore: f.familyScore,
        libraryStats: familyLibraryStats.get(f.id) ?? null,
        gameNames: (gameNameAppIdsPerFamily.get(f.id)?.ids ?? [])
          .map((id) => nameMap.get(id))
          .filter(Boolean) as string[],
        gameNamesLabel: gameNameAppIdsPerFamily.get(f.id)?.label ?? "library",
        topGenres: familyTopGenresMap.get(f.id) ?? [],
        // Personal theme overrides family theme for the current user
        coverTheme:   f.activeCoverTheme   as { config: Record<string, unknown>; rarity: string; slug: string } | null,
        coverOverlay: f.activeCoverOverlay as { config: Record<string, unknown>; rarity: string; slug: string } | null,
        coverVideo:   f.activeCoverVideo   as { config: Record<string, unknown>; rarity: string; slug: string } | null,
      };
    })
  );

  const filters = {
    minPrice: searchParams.minPrice ?? "",
    maxPrice: searchParams.maxPrice ?? "",
    minGames: searchParams.minGames ?? "",
    maxGames: searchParams.maxGames ?? "",
    minOwned: searchParams.minOwned ?? "",
    maxOwned: searchParams.maxOwned ?? "",
    minMissing: searchParams.minMissing ?? "",
    maxMissing: searchParams.maxMissing ?? "",
  };

  // Resolve names for pre-selected games (from URL params)
  const selectedGameRows = gameFilter.length > 0
    ? await prisma.steamAppCatalog.findMany({
        where: { appId: { in: gameFilter } },
        select: { appId: true, name: true },
      })
    : [];
  const selectedGames = gameFilter.map((id) => ({
    appId: id,
    name: selectedGameRows.find((r) => r.appId === id)?.name ?? `App ${id}`,
  }));

  return (
    <CatalogClient
      families={items}
      isLoggedIn={!!currentUserId}
      currentUserId={currentUserId}
      hasActiveFamily={hasActiveFamily}
      needsLibrarySync={needsLibrarySync}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      query={q}
      filters={filters}
      selectedGenres={genreFilter}
      selectedGames={selectedGames}
    />
  );
}
