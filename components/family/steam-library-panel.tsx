"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Library, Heart, Users, Gift, Lock, AlertTriangle, Plus, Clock, CheckCircle2 } from "lucide-react";
import { PledgeModal } from "@/components/wishlist/pledge-modal";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type OwnedGame = { appId: number; name: string; playtimeMinutes: number };
type WishlistGame = { appId: number; name: string; comingSoon: boolean; releaseDate: string; isFree: boolean };

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
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [filterIntersections, setFilterIntersections] = useState(false);
  const [showAll, setShowAll] = useState(false);
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
    return result;
  }, [allEntries, filterUserId, filterIntersections]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE);
  const membersWithWishlist = members.filter((m) => m.steamWishlist !== null);
  const privateMembers = members.filter((m) => m.steamWishlist === null);
  const intersectionCount = allEntries.filter((e) => e.wantedBy.length >= 2).length;

  if (members.every((m) => m.steamWishlist === null)) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
        <Lock className="h-8 w-8 opacity-40" />
        <p>Todos os perfis Steam são privados.</p>
      </div>
    );
  }

  function setFilter(userId: string | null, intersections: boolean) {
    setFilterUserId(userId);
    setFilterIntersections(intersections);
    setShowAll(false);
  }

  return (
    <div className="space-y-4">
      {privateMembers.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          {privateMembers.map((m) => m.personaName).join(", ")} tem perfil privado — lista de desejos não disponível.
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
          Todos ({allEntries.length})
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
            Interseções ({intersectionCount})
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
              {m.userId === currentUserId ? "Você" : m.personaName} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {visible.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((entry) => (
            <WishEntry
              key={entry.appId}
              entry={entry}
              currentUserId={currentUserId}
              memberColors={memberColors}
              memberMap={memberMap}
              sharedItem={sharedWishlistMap.get(entry.appId) ?? null}
              familyId={familyId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
          <Heart className="h-8 w-8 opacity-30" />
          <p>Nenhum desejo encontrado.</p>
        </div>
      )}

      {filtered.length > PAGE && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/40 rounded-lg hover:border-border"
        >
          Mostrar mais {filtered.length - PAGE} desejos
        </button>
      )}
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
        toast.error(data.error?.message ?? "Erro ao adicionar jogo");
        return;
      }
      toast.success("Adicionado à lista!", {
        description: entry.name,
        action: {
          label: "Ver lista →",
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
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

          {/* Badges top-right */}
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            {entry.isShared && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-600/90 text-white">
                <Gift className="h-2.5 w-2.5" />
                Lista Compartilhada
              </span>
            )}
            {entry.comingSoon && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-600/85 text-white">
                <Clock className="h-2.5 w-2.5" />
                Em breve{entry.releaseDate && entry.releaseDate !== "Em breve" ? ` · ${entry.releaseDate}` : ""}
              </span>
            )}
            {entry.isFree && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-600/85 text-white">
                Gratuito
              </span>
            )}
            {entry.ownedByCurrentUser && !entry.isFree && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600/85 text-white">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Você já tem
              </span>
            )}
            {!entry.ownedByCurrentUser && isCrossover && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-600/90 text-white">
                <Users className="h-2.5 w-2.5" />
                Cruzamento · {entry.wantedBy.length} querem
              </span>
            )}
            {!entry.ownedByCurrentUser && isMine && !isCrossover && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600/90 text-white">
                <Heart className="h-2.5 w-2.5" />
                Você quer
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-3 py-2.5 space-y-2">
          <p className="text-xs font-semibold leading-tight line-clamp-1">{entry.name}</p>

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
                  : `${entry.wantedBy.length} membros`}
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
              {adding ? "Adicionando..." : "Adicionar à Lista"}
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
              Contribuir
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
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
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

  const filtered = filterUserId ? games.filter((g) => g.ownedBy.includes(filterUserId)) : games;
  const visible = showAll ? filtered : filtered.slice(0, PAGE);

  const privateMembers = members.filter((m) => m.ownedGames === null);
  const membersWithLibrary = members.filter((m) => m.ownedGames !== null);

  if (membersWithLibrary.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground text-sm">
        <Lock className="h-8 w-8 opacity-40" />
        <p>Todos os perfis Steam são privados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          Todos ({games.length})
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
              {m.userId === currentUserId ? "Você" : m.personaName} ({count})
            </button>
          );
        })}
      </div>

      {privateMembers.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="h-3 w-3" />
          {privateMembers.map((m) => m.personaName).join(", ")} tem perfil privado — biblioteca não disponível.
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {visible.map((game) => (
          <LibraryGameCard
            key={game.appId}
            game={game}
            currentUserId={currentUserId}
            memberColors={memberColors}
            memberMap={memberMap}
          />
        ))}
      </div>

      {filtered.length > PAGE && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/40 rounded-lg hover:border-border"
        >
          Mostrar mais {filtered.length - PAGE} jogos
        </button>
      )}

      {filtered.length === 0 && (
        <p className="text-center py-8 text-sm text-muted-foreground">Nenhum jogo encontrado.</p>
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
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
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
