"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Heart, Plus } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrency } from "@/lib/utils";

type SearchResult = {
  appId: number;
  name: string;
  headerImage: string;
};

type WishlistGame = {
  appId: number;
  name: string;
  comingSoon: boolean;
  isFree: boolean;
  priceCents: number;
  currency: string;
};

type MemberData = {
  userId: string;
  personaName: string;
  avatarMedium: string;
  steamWishlist: WishlistGame[] | null;
};

type SuggestionGame = {
  appId: number;
  name: string;
  priceCents: number;
  isFree: boolean;
  members: Array<{ userId: string; personaName: string; avatarMedium: string }>;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (result: { appId: number; name: string }) => void;
  title?: string;
  familyId?: string;
  existingAppIds?: Set<number>;
};

type PriceFilter = "free" | "20" | "50" | "any";

const PRICE_PRESETS: Array<{ key: PriceFilter; label: string; maxCents: number }> = [
  { key: "free", label: "Gratuito", maxCents: 0 },
  { key: "20",   label: "≤ R$20",   maxCents: 2000 },
  { key: "50",   label: "≤ R$50",   maxCents: 5000 },
  { key: "any",  label: "Qualquer", maxCents: Infinity },
];

function headerImage(appId: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

export function GameSearchModal({ open, onOpenChange, onSelect, title, familyId, existingAppIds }: Props) {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t.gameSearch.defaultTitle;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortFilter, setSortFilter] = useState<"all" | "most">("most");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("any");

  const { data: libraryData, isLoading: suggestionsLoading } = useQuery<{ data: { members: MemberData[] } }>({
    queryKey: ["steam-library", familyId],
    queryFn: async () => {
      const r = await fetch(`/api/families/${familyId}/steam-library`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: !!familyId && open,
    staleTime: 5 * 60_000,
  });

  const suggestions = useMemo<SuggestionGame[]>(() => {
    const members = libraryData?.data?.members ?? [];
    const gameMap = new Map<number, SuggestionGame>();

    for (const member of members) {
      for (const game of member.steamWishlist ?? []) {
        if (existingAppIds?.has(game.appId)) continue;
        if (!gameMap.has(game.appId)) {
          gameMap.set(game.appId, {
            appId: game.appId,
            name: game.name,
            priceCents: game.priceCents,
            isFree: game.isFree,
            members: [],
          });
        }
        gameMap.get(game.appId)!.members.push({
          userId: member.userId,
          personaName: member.personaName,
          avatarMedium: member.avatarMedium,
        });
      }
    }

    let all = [...gameMap.values()];

    if (priceFilter === "free") {
      all = all.filter((g) => g.isFree);
    } else if (priceFilter !== "any") {
      const preset = PRICE_PRESETS.find((p) => p.key === priceFilter)!;
      all = all.filter((g) => !g.isFree && g.priceCents <= preset.maxCents);
    }

    return sortFilter === "most"
      ? all.sort((a, b) => b.members.length - a.members.length)
      : all;
  }, [libraryData, existingAppIds, sortFilter, priceFilter]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/steam/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    const id = setTimeout(() => search(q), 300);
    return () => clearTimeout(id);
  };

  const handleSelect = (result: { appId: number; name: string }) => {
    onSelect(result);
    setQuery("");
    setResults([]);
  };

  const isSearching = query.length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg h-[560px] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Fixed header */}
        <DialogHeader className="px-5 pt-5 pb-0 flex-shrink-0">
          <DialogTitle>{resolvedTitle}</DialogTitle>
        </DialogHeader>

        {/* Fixed search bar */}
        <div className="px-5 pt-4 pb-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Input
              className="pl-9 pr-9"
              placeholder={t.gameSearch.placeholder}
              value={query}
              onChange={handleChange}
              autoFocus
            />
          </div>
        </div>

        {/* Fixed filter bar — suggestions only */}
        {!isSearching && !!familyId && (
          <div className="px-5 pb-2 flex-shrink-0 space-y-2 border-b border-border/50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground">{t.gameSearch.suggestions}</span>
                {suggestions.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                    {suggestions.length}
                  </Badge>
                )}
              </div>
              <div className="flex gap-1">
                {(["most", "all"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSortFilter(f)}
                    className={`text-[11px] px-2 py-0.5 rounded-full transition-colors ${
                      sortFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {f === "most" ? t.gameSearch.filterMostWanted : t.gameSearch.filterAll}
                  </button>
                ))}
              </div>
            </div>

            {/* Price chips */}
            <div className="flex gap-1.5 pb-2">
              {PRICE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPriceFilter(p.key)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-colors ${
                    priceFilter === p.key
                      ? "bg-primary/15 text-primary border-primary/40 font-medium"
                      : "text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scrollable content — fixed height, always takes remaining space */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3">
          {isSearching ? (
            loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : results.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">{t.gameSearch.noResults}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {results.map((r) => {
                  const alreadyAdded = existingAppIds?.has(r.appId);
                  return (
                    <button
                      key={r.appId}
                      onClick={() => !alreadyAdded && handleSelect(r)}
                      disabled={alreadyAdded}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-secondary transition-colors text-left disabled:opacity-50 disabled:cursor-default"
                    >
                      <img
                        src={r.headerImage}
                        alt={r.name}
                        className="w-16 h-9 object-cover rounded flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                      />
                      <span className="text-sm font-medium flex-1 min-w-0 truncate">{r.name}</span>
                      {alreadyAdded && (
                        <Badge variant="secondary" className="text-xs shrink-0">{t.gameSearch.alreadyAdded}</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )
          ) : !familyId ? null : suggestionsLoading ? (
            <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t.gameSearch.loadingSuggestions}</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">{t.gameSearch.suggestionsEmpty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {suggestions.map((game) => (
                <SuggestionCard
                  key={game.appId}
                  game={game}
                  wantedByLabel={t.gameSearch.wantedBy(game.members.length)}
                  onSelect={() => handleSelect({ appId: game.appId, name: game.name })}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionCard({
  game,
  wantedByLabel,
  onSelect,
}: {
  game: SuggestionGame;
  wantedByLabel: string;
  onSelect: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onSelect}
      title={wantedByLabel}
      className="group relative rounded-lg overflow-hidden border border-border/50 bg-card text-left transition-all duration-150 hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative h-[72px] bg-secondary overflow-hidden">
        {!imgError ? (
          <img
            src={headerImage(game.appId)}
            alt={game.name}
            className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/50">No image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {game.members.length > 1 && (
          <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
            <Heart className="h-2.5 w-2.5 text-rose-400 fill-rose-400" />
            <span className="text-[10px] font-semibold text-white">{game.members.length}</span>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-primary/90 backdrop-blur-sm rounded-full p-1.5">
            <Plus className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        </div>
      </div>

      <div className="px-2 py-1.5 space-y-1.5">
        <p className="text-xs font-medium leading-tight line-clamp-2 min-h-[2rem]">{game.name}</p>

        <div className="flex items-center justify-between gap-1">
          <div className="flex -space-x-1.5">
            {game.members.slice(0, 4).map((m) => (
              <Avatar key={m.userId} className="h-5 w-5 ring-1 ring-background">
                <AvatarImage src={m.avatarMedium} />
                <AvatarFallback className="text-[8px]">{m.personaName[0]}</AvatarFallback>
              </Avatar>
            ))}
            {game.members.length > 4 && (
              <div className="h-5 w-5 rounded-full ring-1 ring-background bg-secondary flex items-center justify-center text-[8px] text-muted-foreground">
                +{game.members.length - 4}
              </div>
            )}
          </div>
          <span className="text-[10px] font-semibold shrink-0">
            {game.isFree ? (
              <span className="text-emerald-400">Grátis</span>
            ) : game.priceCents > 0 ? (
              <span className="text-muted-foreground">{formatCurrency(game.priceCents, "BRL")}</span>
            ) : null}
          </span>
        </div>
      </div>
    </button>
  );
}
