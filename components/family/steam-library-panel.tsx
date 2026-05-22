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
import { Library, Heart, Users, Gift, Lock, AlertTriangle, Plus, Clock, CheckCircle2, Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { PledgeModal } from "@/components/wishlist/pledge-modal";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/context";

// ─── Types ────────────────────────────────────────────────────────────────────

type OwnedGame = { appId: number; name: string; playtimeMinutes: number };
type WishlistGame = { appId: number; name: string; comingSoon: boolean; releaseDate: string; isFree: boolean; priceCents: number; currency: string };

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

  return (
    <>
      <div className="group relative rounded-xl overflow-hidden border border-border/50 bg-card hover:border-primary/30 hover:shadow-[0_4px_16px_hsl(0_0%_0%/0.3)] transition-all duration-200">
        {/* Cover */}
        <div className="relative h-[80px]">
          <img
            src={headerImage(entry.appId)}
            alt={entry.name}
            className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110 group-hover:saturate-[1.1]"
            onError={(e) => {
              const el = e.currentTarget;
              if (!el.dataset.fallback) {
                el.dataset.fallback = "1";
                el.src = headerImageFallback(entry.appId);
              } else {
                el.parentElement!.style.display = "none";
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

          {/* Badges top-right */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            {entry.isShared && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-600/90 text-white">
                <Gift className="h-2.5 w-2.5" />
                {t.steamLibrary.sharedWishlist}
              </span>
            )}
            {entry.comingSoon && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-600/85 text-white">
                <Clock className="h-2.5 w-2.5" />
                {t.steamLibrary.comingSoon}{entry.releaseDate && entry.releaseDate !== "Em breve" ? ` · ${entry.releaseDate}` : ""}
              </span>
            )}
            {entry.isFree && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-600/85 text-white">
                {t.steamLibrary.free}
              </span>
            )}
            {entry.ownedByCurrentUser && !entry.isFree && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600/85 text-white">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {t.steamLibrary.youOwn}
              </span>
            )}
            {!entry.ownedByCurrentUser && isCrossover && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-600/90 text-white">
                <Users className="h-2.5 w-2.5" />
                {t.steamLibrary.crossover(entry.wantedBy.length)}
              </span>
            )}
            {!entry.ownedByCurrentUser && isMine && !isCrossover && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600/90 text-white">
                <Heart className="h-2.5 w-2.5" />
                {t.steamLibrary.youWant}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-3 py-2.5 space-y-2">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-semibold leading-tight line-clamp-1">{entry.name}</p>
            <p className="text-[11px] text-muted-foreground shrink-0">
              {entry.isFree
                ? t.steamLibrary.free
                : entry.priceCents > 0
                ? formatCurrency(entry.priceCents, entry.currency)
                : entry.comingSoon
                ? t.steamLibrary.toBeAnnounced
                : ""}
            </p>
          </div>

          {entry.wantedBy.length > 0 && (
            <div className="flex items-center gap-1">
              {entry.wantedBy.map((uid) => {
                const m = memberMap.get(uid);
                if (!m) return null;
                const color = memberColors.get(uid) ?? "#888";
                return <MemberAvatar key={uid} member={m} color={color} size="xs" />;
              })}
              <span className="text-[10px] text-muted-foreground ml-0.5">
                {entry.wantedBy.length === 1
                  ? memberMap.get(entry.wantedBy[0])?.personaName ?? ""
                  : t.steamLibrary.members(entry.wantedBy.length)}
              </span>
            </div>
          )}

          {/* Actions */}
          {!entry.isShared && !entry.ownedByCurrentUser && !entry.isFree && (
            <button
              onClick={handleAdd}
              disabled={adding}
              className="w-full h-7 rounded-md text-[11px] font-semibold border border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="h-3 w-3" />
              {adding ? t.steamLibrary.adding : t.steamLibrary.addToList}
            </button>
          )}
          {canPledge && (
            <button
              onClick={() => setPledgeOpen(true)}
              className="w-full h-7 rounded-md text-[11px] font-semibold text-white transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))",
                boxShadow: "0 0 10px hsl(258 82% 66% / 0.2)",
              }}
            >
              {t.steamLibrary.contribute}
            </button>
          )}
        </div>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
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
    <div className="group relative rounded-lg overflow-hidden border border-border/40 bg-card hover:border-primary/30 hover:shadow-[0_3px_12px_hsl(0_0%_0%/0.25)] transition-all duration-200">
      <div className="relative h-[54px]">
        <img
          src={headerImage(game.appId)}
          alt={game.name}
          className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110"
          onError={(e) => {
            const el = e.currentTarget;
            if (!el.dataset.fallback) {
              el.dataset.fallback = "1";
              el.src = headerImageFallback(game.appId);
            } else {
              el.parentElement!.style.display = "none";
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-card/20 to-transparent" />
        {sharedBy && (
          <div className="absolute top-1 right-1">
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-sky-600/80 text-white">
              <Users className="h-2 w-2" />{game.ownedBy.length}
            </span>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 space-y-1.5">
        <p className="text-[11px] font-medium leading-tight line-clamp-2">{game.name}</p>
        <div className="flex items-center justify-between">
          <div className="flex -space-x-1">
            {game.ownedBy.map((uid) => {
              const m = memberMap.get(uid);
              if (!m) return null;
              const color = memberColors.get(uid) ?? "#888";
              return <MemberAvatar key={uid} member={m} color={color} size="xs" />;
            })}
          </div>
          {game.totalPlaytime > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {fmtPlaytime(game.totalPlaytime)}
            </span>
          )}
        </div>
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
      const endpoint = tab === "library" ? "/api/me/steam/sync-library" : "/api/me/steam/sync-wishlist";
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        toast.success(tab === "library" ? "Biblioteca sincronizada" : "Wishlist sincronizada");
      } else {
        const data = await res.json();
        const code = data.error?.code;
        const msg =
          code === "RATE_LIMITED" ? "Steam limitando requisições, tente em alguns segundos."
          : code === "STEAM_PRIVATE" ? `Perfil Steam privado — ${tab === "library" ? "biblioteca" : "wishlist"} indisponível.`
          : `Erro ao sincronizar ${tab === "library" ? "biblioteca" : "wishlist"}.`;
        toast.error(msg);
      }
    } catch {
      toast.error(`Erro ao sincronizar ${tab === "library" ? "biblioteca" : "wishlist"}.`);
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 animate-pulse">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-secondary" />
          ))}
        </div>
      ) : (
        <>
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
          <div className="flex justify-end">
            <button
              onClick={handleSync}
              disabled={syncing}
              title="Sincronizar wishlist Steam"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando…" : "Atualizar"}
            </button>
          </div>

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
