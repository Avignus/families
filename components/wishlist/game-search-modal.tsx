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

function headerImage(appId: number) {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

export function GameSearchModal({ open, onOpenChange, onSelect, title, familyId, existingAppIds }: Props) {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t.gameSearch.defaultTitle;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "most">("most");

  // Reuses the same cache as SteamLibraryPanel
  const { data: libraryData } = useQuery<{ data: { members: MemberData[] } }>({
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
          gameMap.set(game.appId, { appId: game.appId, name: game.name, members: [] });
        }
        gameMap.get(game.appId)!.members.push({
          userId: member.userId,
          personaName: member.personaName,
          avatarMedium: member.avatarMedium,
        });
      }
    }

    const all = [...gameMap.values()];
    if (filter === "most") {
      return all.sort((a, b) => b.members.length - a.members.length);
    }
    return all;
  }, [libraryData, existingAppIds, filter]);

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

  const showSuggestions = query.length < 2 && !!familyId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle>{resolvedTitle}</DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={t.gameSearch.placeholder}
              value={query}
              onChange={handleChange}
              autoFocus
            />
          </div>
        </div>

        {/* Search results */}
        {query.length >= 2 && (
          <div className="px-5 pb-5 space-y-1 max-h-80 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && results.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                {t.gameSearch.noResults}
              </p>
            )}
            {results.map((r) => {
              const alreadyAdded = existingAppIds?.has(r.appId);
              return (
                <button
                  key={r.appId}
                  onClick={() => !alreadyAdded && handleSelect(r)}
                  disabled={alreadyAdded}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary transition-colors text-left disabled:opacity-50 disabled:cursor-default"
                >
                  <img
                    src={r.headerImage}
                    alt={r.name}
                    className="w-16 h-9 object-cover rounded flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
                  />
                  <span className="text-sm font-medium flex-1">{r.name}</span>
                  {alreadyAdded && (
                    <Badge variant="secondary" className="text-xs shrink-0">{t.gameSearch.alreadyAdded}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Suggestions section */}
        {showSuggestions && (
          <div className="flex flex-col min-h-0">
            {/* Header */}
            <div className="px-5 py-3 flex items-center justify-between gap-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Heart className="h-3.5 w-3.5 text-rose-400" />
                {t.gameSearch.suggestions}
                {suggestions.length > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                    {suggestions.length}
                  </Badge>
                )}
              </div>
              {suggestions.length > 0 && (
                <div className="flex gap-1">
                  {(["most", "all"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                        filter === f
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {f === "most" ? t.gameSearch.filterMostWanted : t.gameSearch.filterAll}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Grid */}
            <div className="overflow-y-auto max-h-80 px-5 pb-5">
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t.gameSearch.suggestionsEmpty}
                </p>
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
          </div>
        )}
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
      {/* Game image */}
      <div className="relative h-[72px] bg-secondary overflow-hidden">
        {!imgError && (
          <img
            src={headerImage(game.appId)}
            alt={game.name}
            className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        )}
        {imgError && (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/50">No image</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Member count badge */}
        {game.members.length > 1 && (
          <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
            <Heart className="h-2.5 w-2.5 text-rose-400 fill-rose-400" />
            <span className="text-[10px] font-semibold text-white">{game.members.length}</span>
          </div>
        )}

        {/* Add icon on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-primary/90 backdrop-blur-sm rounded-full p-1.5">
            <Plus className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-2 py-1.5 space-y-1.5">
        <p className="text-xs font-medium leading-tight line-clamp-2 min-h-[2rem]">{game.name}</p>

        {/* Member avatars */}
        <div className="flex -space-x-1.5">
          {game.members.slice(0, 5).map((m) => (
            <Avatar key={m.userId} className="h-5 w-5 ring-1 ring-background">
              <AvatarImage src={m.avatarMedium} />
              <AvatarFallback className="text-[8px]">{m.personaName[0]}</AvatarFallback>
            </Avatar>
          ))}
          {game.members.length > 5 && (
            <div className="h-5 w-5 rounded-full ring-1 ring-background bg-secondary flex items-center justify-center text-[8px] text-muted-foreground">
              +{game.members.length - 5}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
