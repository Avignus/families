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
  };
}) {
  const session = await getSession();
  const currentUserId = (session?.user as { id?: string })?.id ?? null;
  const currentSteamId = (session?.user as { steamId?: string })?.steamId ?? null;

  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));

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
  const where: Record<string, unknown> = {};
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

  // Load all families matching text + price (needed for in-memory game filters)
  const allFamilies = await prisma.family.findMany({
    where,
    include: {
      chief: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } },
      _count: { select: { memberships: { where: { status: "active" } } } },
      ...(currentUserId
        ? { memberships: { where: { userId: currentUserId }, select: { status: true } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute library stats when user is logged in or game filters are active
  const familyLibraryStats = new Map<string, LibraryStats>();

  if (currentSteamId || hasGameFilters) {
    // Load current user's Steam library
    const userAppIds = new Set<number>();
    if (currentSteamId) {
      const userCache = await prisma.steamUserCache.findUnique({
        where: { userId_type: { userId: currentSteamId, type: "library" } },
        select: { payload: true },
      });
      if (userCache) {
        const games = userCache.payload as Array<{ appId: number }>;
        if (Array.isArray(games)) games.forEach((g) => userAppIds.add(g.appId));
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
      const familyAppIds = new Set<number>();
      for (const steamId of memberSteamIds) {
        steamLibMap.get(steamId)?.forEach((id) => familyAppIds.add(id));
      }

      const totalGames = familyAppIds.size;
      let ownedGames = 0;
      for (const appId of familyAppIds) {
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

  const total = filteredFamilies.length;
  const skip = (page - 1) * PAGE_SIZE;
  const pagedFamilies = filteredFamilies.slice(skip, skip + PAGE_SIZE);

  // Load wishlist cover images only for the paginated slice
  const items = await Promise.all(
    pagedFamilies.map(async (f) => {
      const memberCount = f._count.memberships;
      const wishlistItems = await prisma.wishlistItem.findMany({
        where: { familyId: f.id, status: { not: "cancelled" } },
        select: { steamAppId: true },
        take: 4,
        orderBy: { createdAt: "desc" },
      });
      const covers = await Promise.all(
        wishlistItems.map((item) =>
          getAppDetails(item.steamAppId).then((d) => d?.headerImage ?? null)
        )
      );
      const myMembership =
        currentUserId &&
        "memberships" in f &&
        Array.isArray((f as { memberships?: unknown[] }).memberships) &&
        (f as { memberships?: unknown[] }).memberships!.length
          ? ((f as { memberships?: { status: string }[] }).memberships![0])
          : null;

      return {
        id: f.id,
        name: f.name,
        description: f.description,
        currency: f.currency,
        isPublic: f.isPublic,
        entryFeeCents: f.entryFeeCents,
        maxMembers: f.maxMembers,
        memberCount,
        spotsLeft: f.maxMembers ? f.maxMembers - memberCount : null,
        isFull: f.maxMembers ? memberCount >= f.maxMembers : false,
        chief: f.chief,
        gameCovers: covers.filter((c): c is string => Boolean(c)),
        myStatus: myMembership?.status ?? null,
        libraryStats: familyLibraryStats.get(f.id) ?? null,
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

  return (
    <CatalogClient
      families={items}
      isLoggedIn={!!currentUserId}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      query={q}
      filters={filters}
    />
  );
}
