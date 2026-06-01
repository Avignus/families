"use client";

import { useMemo, useState, useEffect, useRef } from "react";

function useInfiniteScroll(total: number, pageSize: number, resetKey: unknown) {
  const [count, setCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setCount(pageSize); }, [resetKey, pageSize]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && count < total) setCount((c) => Math.min(c + pageSize, total)); },
      { rootMargin: "120px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [count, total, pageSize]);

  return { count, sentinelRef };
}
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Library, Heart, Users, Gift, Lock, AlertTriangle, Plus, Clock, CheckCircle2, Search, RefreshCw, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { SteamPriceBadge } from "@/components/ui/steam-price-badge";
import { PledgeModal } from "@/components/wishlist/pledge-modal";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/context";

// ─── Types ────────────────────────────────────────────────────────────────────

type OwnedGame = { appId: number; name: string; playtimeMinutes: number };
type WishlistGame = { appId: number; name: string; comingSoon: boolean; releaseDate: string; isFree: boolean; priceCents: number; originalPriceCents: number; discountPercent: number; currency: string };

type MemberSteamData = {
  userId: string;
  steamId: string;
  personaName: string;
  avatarMedium: string;
  ownedGames: OwnedGame[] | null;
  steamWishlist: WishlistGame[] | null;
};

type SharedWishlistItem = {
  id: string;
  steamAppId: number;
  status: string;
  targetPriceCents: number;
  totalPledgedCents: number;
  currency: string;
};

type Props = {
  familyId: string;
  currentUserId: string;
  memberColors: Map<string, string>;
  sharedWishlistItems: SharedWishlistItem[];
  onRefresh: () => void;
};

type Tab = "wishes" | "library";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function headerImage(appId: number) {
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}

function headerImageFallback(appId: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

function capsuleImage(appId: number) {
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
}

function capsuleImageFallback(appId: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
}

function fmtPlaytime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.round(minutes / 60);
  return `${h}h`;
}

// ─── Member avatar strip ───────────────────────────────────────────────────────

function MemberAvatar({
  member,
  color,
  size = "sm",
}: {
  member: Pick<MemberSteamData, "personaName" | "avatarMedium">;
  color: string;
  size?: "sm" | "xs";
}) {
  const dim = size === "xs" ? "h-5 w-5" : "h-6 w-6";
  const fs = size === "xs" ? 7 : 8;
  return (
    <Avatar className={dim} style={{ boxShadow: `0 0 0 1.5px ${color}` }} title={member.personaName}>
      <AvatarImage src={member.avatarMedium} />
      <AvatarFallback style={{ backgroundColor: color, fontSize: fs }}>
        {member.personaName[0]}
      </AvatarFallback>
    </Avatar>
  );
}

// ─── Unified Wishes tab ───────────────────────────────────────────────────────

type UnifiedEntry = {
  appId: number;
  name: string;
  wantedBy: string[];
  isShared: boolean;
  comingSoon: boolean;
  releaseDate: string;
  isFree: boolean;
  priceCents: number;
  originalPriceCents: number;
  discountPercent: number;
  currency: string;
  ownedByCurrentUser: boolean;
};

function WishesTab({
  members,
  sharedWishlistMap,
  currentUserId,
  memberColors,
  memberMap,
  familyId,
  onRefresh,
}: {
  members: MemberSteamData[];
  sharedWishlistMap: Map<number, SharedWishlistItem>;
  currentUserId: string;
  memberColors: Map<string, string>;
  memberMap: Map<string, MemberSteamData>;
  familyId: string;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterIntersections, setFilterIntersections] = useState(false);
  const [search, setSearch] = useState("");
  const PAGE = 60;

  const currentUserOwnedAppIds = useMemo(() => {
    const member = memberMap.get(currentUserId);
    return new Set(member?.ownedGames?.map((g) => g.appId) ?? []);
  }, [memberMap, currentUserId]);

  const allEntries = useMemo(() => {
    const map = new Map<number, UnifiedEntry>();
    for (const member of members) {
      if (!member.steamWishlist) continue;
      for (const game of member.steamWishlist) {
        const existing = map.get(game.appId);
        if (existing) {
          existing.wantedBy.push(member.userId);
        } else {
          map.set(game.appId, {
            appId: game.appId,
            name: game.name,
            wantedBy: [member.userId],
            isShared: sharedWishlistMap.has(game.appId),
            comingSoon: game.comingSoon,
            releaseDate: game.releaseDate,
            isFree: game.isFree,
            priceCents: game.priceCents,
            originalPriceCents: game.originalPriceCents,
            discountPercent: game.discountPercent,
            currency: game.currency,
            ownedByCurrentUser: currentUserOwnedAppIds.has(game.appId),
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.wantedBy.length - a.wantedBy.length);
  }, [members, sharedWishlistMap, currentUserOwnedAppIds]);

  const filtered = useMemo(() => {
    let result = allEntries;
    if (filterIntersections) result = result.filter((e) => e.wantedBy.length >= 2);
    if (filterUserId) result = result.filter((e) => e.wantedBy.includes(filterUserId));
    if (search.trim()) result = result.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [allEntries, filterUserId, filterIntersections, search]);

  const resetKey = `${filterUserId}-${filterIntersections}-${search}`;
  const { count, sentinelRef: wishSentinelRef } = useInfiniteScroll(filtered.length, PAGE, resetKey);
  const visible = filtered.slice(0, count);
  const membersWithWishlist = members.filter((m) => m.steamWishlist !== null);
  const privateMembers = members.filter((m) => m.steamWishlist === null);
  const intersectionCount = allEntries.filter((e) => e.wantedBy.length >= 2).length;

  if (members.every((m) => m.steamWishlist === null)) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
        <Lock className="h-8 w-8 opacity-40" />
        <p>{t.steamLibrary.allPrivate}</p>
      </div>
    );
  }

  function setFilter(userId: string | null, intersections: boolean) {
    setFilterUserId(userId);
    setFilterIntersections(intersections);
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={t.steamLibrary.searchPlaceholder}
          className="pl-8 h-8 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {privateMembers.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          {privateMembers.map((m) => m.personaName).join(", ")} {t.steamLibrary.profilePrivateWishlist}
        </p>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter(null, false)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            !filterUserId && !filterIntersections
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.steamLibrary.all(allEntries.length)}
        </button>

        {intersectionCount > 0 && (
          <button
            onClick={() => setFilter(null, !filterIntersections)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
              filterIntersections
                ? "bg-sky-600/20 text-sky-400 border-sky-600/40"
                : "border-transparent bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3 w-3" />
            {t.steamLibrary.intersections(intersectionCount)}
          </button>
        )}

        {membersWithWishlist.map((m) => {
          const count = m.steamWishlist?.length ?? 0;
          const color = memberColors.get(m.userId) ?? "#888";
          const active = filterUserId === m.userId;
          return (
            <button
              key={m.userId}
              onClick={() => setFilter(active ? null : m.userId, false)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: active ? color + "33" : undefined,
                border: `1px solid ${active ? color : "transparent"}`,
                color: active ? color : undefined,
                backgroundColor: active ? undefined : "hsl(var(--secondary))",
              }}
            >
              <MemberAvatar member={m} color={color} size="xs" />
              {m.userId === currentUserId ? t.steamLibrary.you : m.personaName} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
          {visible.map((entry, i) => (
            <div key={entry.appId} className="fade-in-up" style={{ animationDelay: `${Math.max(0, i - (count - PAGE)) * 30}ms` }}>
              <WishEntry
                entry={entry}
                currentUserId={currentUserId}
                memberColors={memberColors}
                memberMap={memberMap}
                sharedItem={sharedWishlistMap.get(entry.appId) ?? null}
                familyId={familyId}
                onRefresh={onRefresh}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
          <Heart className="h-8 w-8 opacity-30" />
          <p>{t.steamLibrary.noWishesFound}</p>
        </div>
      )}

      <div ref={wishSentinelRef} className="h-1" />
    </div>
  );
}

function WishEntry({
  entry,
  currentUserId,
  memberColors,
  memberMap,
  sharedItem,
  familyId,
  onRefresh,
}: {
  entry: UnifiedEntry;
  currentUserId: string;
  memberColors: Map<string, string>;
  memberMap: Map<string, MemberSteamData>;
  sharedItem: SharedWishlistItem | null;
  familyId: string;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const isCrossover = entry.wantedBy.length >= 2;
  const isMine = entry.wantedBy.includes(currentUserId);

  const remaining = sharedItem ? sharedItem.targetPriceCents - sharedItem.totalPledgedCents : 0;
  const canPledge = sharedItem?.status === "open" && remaining > 0 && !entry.ownedByCurrentUser && !entry.isFree;

  const handleAdd = async () => {
    setAdding(true);
    try {
      const res = await fetch(`/api/families/${familyId}/wishlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamAppId: entry.appId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.message ?? t.family.errorAddingGame);
        return;
      }
      toast.success(t.family.gameAdded, {
        description: entry.name,
        action: {
          label: t.family.viewList,
          onClick: () => document.getElementById("family-wishlist")?.scrollIntoView({ behavior: "smooth", block: "start" }),
        },
      });
      onRefresh();
    } finally {
      setAdding(false);
    }
  };

  const showPrice = !entry.isFree && entry.priceCents > 0;

  return (
    <>
      <div className="group relative rounded-md overflow-hidden hover:scale-[1.04] hover:z-10 transition-all duration-200 hover:shadow-[0_8px_28px_hsl(0_0%_0%/0.55)]">
        {/* Portrait capsule image */}
        <div className="relative aspect-[2/3] bg-secondary">
          <img
            src={capsuleImage(entry.appId)}
            alt={entry.name}
            style={{ imageOrientation: "from-image" }}
            className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110 group-hover:saturate-[1.08]"
            onError={(e) => {
              const el = e.currentTarget;
              if (!el.dataset.fallback) { el.dataset.fallback = "1"; el.src = capsuleImageFallback(entry.appId); }
              else if (el.dataset.fallback === "1") { el.dataset.fallback = "2"; el.src = headerImage(entry.appId); }
              else { el.style.display = "none"; }
            }}
          />

          {/* Hover: name overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-1.5">
            <p className="text-[9px] font-semibold text-white leading-tight line-clamp-2">{entry.name}</p>
          </div>

          {/* Bottom badge: price */}
          {showPrice && (
            <div className="absolute bottom-0 inset-x-0 flex justify-center pb-1.5 group-hover:opacity-0 transition-opacity">
              <SteamPriceBadge
                priceCents={entry.priceCents}
                originalPriceCents={entry.originalPriceCents}
                discountPercent={entry.discountPercent}
                currency={entry.currency}
                size="xs"
              />
            </div>
          )}

          {/* Top-left: member avatars */}
          {entry.wantedBy.length > 0 && (
            <div className="absolute top-1 left-1 flex -space-x-1">
              {entry.wantedBy.slice(0, 3).map((uid) => {
                const m = memberMap.get(uid);
                if (!m) return null;
                const color = memberColors.get(uid) ?? "#888";
                return <MemberAvatar key={uid} member={m} color={color} size="xs" />;
              })}
            </div>
          )}

          {/* Top-right: status badges (icons only, compact) */}
          <div className="absolute top-1 right-1 flex flex-col items-end gap-0.5">
            {entry.isShared && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-violet-600/90" title={t.steamLibrary.sharedWishlist}>
                <Gift className="h-2.5 w-2.5 text-white" />
              </span>
            )}
            {entry.ownedByCurrentUser && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-600/90" title={t.steamLibrary.youOwn}>
                <CheckCircle2 className="h-2.5 w-2.5 text-white" />
              </span>
            )}
            {!entry.ownedByCurrentUser && isCrossover && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-sky-600/90 text-[9px] font-semibold text-white" title={t.steamLibrary.crossover(entry.wantedBy.length)}>
                <Users className="h-2 w-2" />{entry.wantedBy.length}
              </span>
            )}
            {entry.comingSoon && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-sky-700/85" title={t.steamLibrary.comingSoon}>
                <Clock className="h-2.5 w-2.5 text-white" />
              </span>
            )}
          </div>
        </div>

        {/* Action bar — always visible, compact */}
        {(!entry.isShared && !entry.ownedByCurrentUser && !entry.isFree && !entry.comingSoon) || canPledge ? (
          <div className="bg-card/95 px-1.5 py-1">
            {!entry.isShared && !entry.ownedByCurrentUser && !entry.isFree && !entry.comingSoon && (
              <button
                onClick={handleAdd}
                disabled={adding}
                className="w-full h-6 rounded text-[10px] font-semibold border border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="h-2.5 w-2.5" />
                {adding ? t.steamLibrary.adding : t.steamLibrary.addToList}
              </button>
            )}
            {canPledge && (
              <button
                onClick={() => setPledgeOpen(true)}
                className="w-full h-6 rounded text-[10px] font-semibold text-white transition-all hover:opacity-90 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))" }}
              >
                {t.steamLibrary.contribute}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {sharedItem && canPledge && (
        <PledgeModal
          open={pledgeOpen}
          onOpenChange={setPledgeOpen}
          itemId={sharedItem.id}
          gameName={entry.name}
          targetPriceCents={sharedItem.targetPriceCents}
          totalPledgedCents={sharedItem.totalPledgedCents}
          currency={sharedItem.currency}
          userCreditsCents={0}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}

// ─── Library tab ──────────────────────────────────────────────────────────────

type LibraryEntry = {
  appId: number;
  name: string;
  totalPlaytime: number;
  ownedBy: string[];
};

function LibraryTab({
  members,
  currentUserId,
  memberColors,
  memberMap,
}: {
  members: MemberSteamData[];
  currentUserId: string;
  memberColors: Map<string, string>;
  memberMap: Map<string, MemberSteamData>;
}) {
  const { t } = useLanguage();
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const PAGE = 60;

  const games: LibraryEntry[] = useMemo(() => {
    const map = new Map<number, LibraryEntry>();
    for (const member of members) {
      if (!member.ownedGames) continue;
      for (const game of member.ownedGames) {
        const existing = map.get(game.appId);
        if (existing) {
          existing.ownedBy.push(member.userId);
          existing.totalPlaytime += game.playtimeMinutes;
        } else {
          map.set(game.appId, {
            appId: game.appId,
            name: game.name,
            totalPlaytime: game.playtimeMinutes,
            ownedBy: [member.userId],
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalPlaytime - a.totalPlaytime);
  }, [members]);

  const filtered = useMemo(() => {
    let result = filterUserId ? games.filter((g) => g.ownedBy.includes(filterUserId)) : games;
    if (search.trim()) result = result.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [games, filterUserId, search]);
  const libResetKey = `${filterUserId}-${search}`;
  const { count: libCount, sentinelRef: libSentinelRef } = useInfiniteScroll(filtered.length, PAGE, libResetKey);
  const visible = filtered.slice(0, libCount);

  const privateMembers = members.filter((m) => m.ownedGames === null);
  const membersWithLibrary = members.filter((m) => m.ownedGames !== null);

  if (membersWithLibrary.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
        <Lock className="h-8 w-8 opacity-40" />
        <p>{t.steamLibrary.allPrivate}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={t.steamLibrary.searchPlaceholder}
          className="pl-8 h-8 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Member filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterUserId(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            filterUserId === null
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.steamLibrary.all(games.length)}
        </button>
        {membersWithLibrary.map((m) => {
          const count = games.filter((g) => g.ownedBy.includes(m.userId)).length;
          const color = memberColors.get(m.userId) ?? "#888";
          const active = filterUserId === m.userId;
          return (
            <button
              key={m.userId}
              onClick={() => setFilterUserId(active ? null : m.userId)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: active ? color + "33" : undefined,
                border: `1px solid ${active ? color : "transparent"}`,
                color: active ? color : undefined,
                backgroundColor: active ? undefined : "hsl(var(--secondary))",
              }}
            >
              <MemberAvatar member={m} color={color} size="xs" />
              {m.userId === currentUserId ? t.steamLibrary.you : m.personaName} ({count})
            </button>
          );
        })}
      </div>

      {privateMembers.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          {privateMembers.map((m) => m.personaName).join(", ")} {t.steamLibrary.profilePrivateLibrary}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
        {visible.map((game, i) => (
          <div key={game.appId} className="fade-in-up" style={{ animationDelay: `${Math.max(0, i - (libCount - PAGE)) * 20}ms` }}>
            <LibraryGameCard
              game={game}
              currentUserId={currentUserId}
              memberColors={memberColors}
              memberMap={memberMap}
            />
          </div>
        ))}
      </div>

      <div ref={libSentinelRef} className="h-1" />

      {filtered.length === 0 && (
        <p className="text-center py-8 text-sm text-muted-foreground">{t.steamLibrary.noWishesFound}</p>
      )}
    </div>
  );
}

function LibraryGameCard({
  game,
  currentUserId,
  memberColors,
  memberMap,
}: {
  game: LibraryEntry;
  currentUserId: string;
  memberColors: Map<string, string>;
  memberMap: Map<string, MemberSteamData>;
}) {
  const sharedBy = game.ownedBy.length > 1;

  return (
    <div className="group relative rounded-md overflow-hidden cursor-default hover:scale-[1.04] hover:z-10 transition-all duration-200 hover:shadow-[0_8px_28px_hsl(0_0%_0%/0.55)]">
      {/* Portrait capsule image */}
      <div className="relative aspect-[2/3] bg-secondary">
        <img
          src={capsuleImage(game.appId)}
          alt={game.name}
          className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110 group-hover:saturate-[1.08]"
          onError={(e) => {
            const el = e.currentTarget;
            if (!el.dataset.fallback) {
              el.dataset.fallback = "1";
              el.src = capsuleImageFallback(game.appId);
            } else if (el.dataset.fallback === "1") {
              el.dataset.fallback = "2";
              el.src = headerImage(game.appId);
            } else {
              el.style.display = "none";
            }
          }}
        />

        {/* Game name overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-2">
          <p className="text-[10px] font-semibold text-white leading-tight line-clamp-2">{game.name}</p>
        </div>

        {/* Bottom badge — shared count */}
        <div className="absolute bottom-0 inset-x-0 flex justify-center pb-1.5">
          {sharedBy ? (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-[#1b2838]/85 text-sky-300 backdrop-blur-sm">
              <Users className="h-2.5 w-2.5" /> {game.ownedBy.length}
            </span>
          ) : null}
        </div>

        {/* Member avatars — top-right when shared */}
        {sharedBy && (
          <div className="absolute top-1.5 right-1.5 flex flex-col items-end gap-0.5">
            <div className="flex -space-x-1">
              {game.ownedBy.slice(0, 3).map((uid) => {
                const m = memberMap.get(uid);
                if (!m) return null;
                const color = memberColors.get(uid) ?? "#888";
                return <MemberAvatar key={uid} member={m} color={color} size="xs" />;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root panel ───────────────────────────────────────────────────────────────

export function SteamLibraryPanel({ familyId, currentUserId, memberColors, sharedWishlistItems, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>("library");
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/me/steam/sync-library", { method: "POST" });
      if (res.ok) {
        toast.success("Biblioteca sincronizada");
      } else {
        const data = await res.json();
        const code = data.error?.code;
        const msg = code === "STEAM_PRIVATE"
          ? "Perfil Steam privado — biblioteca indisponível."
          : "Erro ao sincronizar biblioteca.";
        toast.error(msg);
      }
    } catch {
      toast.error("Erro ao sincronizar biblioteca.");
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["steam-library", familyId] });
      setSyncing(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["steam-library", familyId],
    queryFn: async () => {
      const r = await fetch(`/api/families/${familyId}/steam-library`);
      if (!r.ok) throw new Error("Failed to fetch Steam library");
      return r.json() as Promise<{ data: { members: MemberSteamData[]; steamKeyInvalid: boolean } }>;
    },
    staleTime: 5 * 60_000,
  });

  const members = data?.data?.members ?? [];
  const steamKeyInvalid = data?.data?.steamKeyInvalid ?? false;
  const currentMember = members.find((m) => m.userId === currentUserId);
  const myProfilePrivate = !isLoading && currentMember !== undefined && currentMember.ownedGames === null;
  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.userId, m])),
    [members]
  );
  const sharedWishlistMap = useMemo(
    () => new Map(sharedWishlistItems.map((i) => [i.steamAppId, i])),
    [sharedWishlistItems]
  );

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border/50 pb-0">
        <TabButton
          active={tab === "library"}
          onClick={() => setTab("library")}
          icon={<Library className="h-3.5 w-3.5" />}
          label="Biblioteca"
        />
        <TabButton
          active={tab === "wishes"}
          onClick={() => setTab("wishes")}
          icon={<Heart className="h-3.5 w-3.5" />}
          label="Desejos"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 animate-pulse">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-md bg-secondary" />
          ))}
        </div>
      ) : (
        <>
          {myProfilePrivate && (
            <div className="flex items-start gap-2.5 rounded-lg border border-sky-500/30 bg-sky-500/8 px-3 py-2.5 text-xs text-sky-300">
              <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                {t.steamLibrary.myProfilePrivate}{" "}
                <a
                  href="https://steamcommunity.com/my/edit/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-sky-200"
                >
                  {t.steamLibrary.makePublicLink}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            </div>
          )}
          {steamKeyInvalid && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                A Steam API Key configurada está inválida ou expirada.{" "}
                <a
                  href="https://steamcommunity.com/dev/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-amber-300"
                >
                  Gere uma nova chave
                </a>{" "}
                e atualize a variável <code className="font-mono">STEAM_API_KEY</code> no <code className="font-mono">.env</code>.
              </span>
            </div>
          )}
          {tab === "library" && (
            <div className="flex justify-end">
              <button
                onClick={handleSync}
                disabled={syncing}
                title="Sincronizar biblioteca Steam"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando…" : "Atualizar"}
              </button>
            </div>
          )}

          {tab === "wishes" ? (
            <WishesTab
              members={members}
              sharedWishlistMap={sharedWishlistMap}
              currentUserId={currentUserId}
              memberColors={memberColors}
              memberMap={memberMap}
              familyId={familyId}
              onRefresh={onRefresh}
            />
          ) : (
            <LibraryTab
              members={members}
              currentUserId={currentUserId}
              memberColors={memberColors}
              memberMap={memberMap}
            />
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
