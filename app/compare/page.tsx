"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, ExternalLink, Tag } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type SearchResult = { appId: number; name: string; headerImage: string };
type Deal = { shopId: number; shopName: string; priceCents: number; cut: number; url: string };
type GameInfo = {
  name: string;
  headerImage: string;
  priceCents: number;
  originalPriceCents?: number;
  discountPercent?: number;
  isFree: boolean;
  currency: string;
};

export default function ComparePage() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [selectedGame, setSelectedGame] = useState<SearchResult | null>(null);
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/steam/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.data ?? []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const selectGame = async (game: SearchResult) => {
    setSelectedGame(game);
    setShowSuggestions(false);
    setQuery(game.name);
    setDeals([]);
    setGameInfo(null);
    setLoadingPrices(true);
    try {
      const res = await fetch(`/api/itad/prices?steamAppId=${game.appId}`);
      const data = await res.json();
      setGameInfo(data.data?.game ?? null);
      setDeals(data.data?.deals ?? []);
    } catch {
      setDeals([]);
    } finally {
      setLoadingPrices(false);
    }
  };

  const cheapest = deals[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Comparar preços
          </h1>
          <p className="text-muted-foreground text-sm">
            Veja o preço de um jogo em todas as lojas disponíveis e compre onde for mais barato.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 focus-within:border-primary/60 transition-colors">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
              placeholder="Nome do jogo..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (!e.target.value) { setSelectedGame(null); setDeals([]); setGameInfo(null); } }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
            {loadingSearch && (
              <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border/60 bg-card shadow-xl overflow-hidden">
              {suggestions.slice(0, 8).map((s) => (
                <button
                  key={s.appId}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors text-left"
                  onClick={() => selectGame(s)}
                >
                  <img src={s.headerImage} alt="" className="h-8 w-14 object-cover rounded shrink-0" />
                  <span className="text-sm truncate">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loadingPrices && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Buscando preços...
          </div>
        )}

        {/* Game + Deals */}
        {!loadingPrices && selectedGame && (
          <>
            {/* Game header */}
            {gameInfo && (
              <div className="rounded-xl overflow-hidden border border-border/50 bg-card">
                <div className="h-32 relative">
                  <img src={gameInfo.headerImage} alt={gameInfo.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-card/90 via-card/50 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-4 gap-1">
                    <h2 className="font-bold text-lg leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                      {gameInfo.name}
                    </h2>
                    {gameInfo.isFree ? (
                      <span className="text-sm text-emerald-400 font-semibold">Grátis</span>
                    ) : gameInfo.priceCents > 0 ? (
                      <div className="flex items-center gap-2">
                        {(gameInfo.discountPercent ?? 0) > 0 && gameInfo.originalPriceCents && gameInfo.originalPriceCents > gameInfo.priceCents ? (
                          <>
                            <span className="text-xs text-muted-foreground line-through">
                              {formatCurrency(gameInfo.originalPriceCents, gameInfo.currency)}
                            </span>
                            <span className="text-sm font-bold text-[#beee11]">
                              {formatCurrency(gameInfo.priceCents, gameInfo.currency)}
                            </span>
                            <span className="text-xs bg-[#4c6b22] text-[#beee11] font-bold px-1.5 py-0.5 rounded">
                              -{gameInfo.discountPercent}%
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-semibold">
                            {formatCurrency(gameInfo.priceCents, gameInfo.currency)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">na Steam</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* No deals */}
            {deals.length === 0 && !loadingPrices && (
              <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                <Tag className="h-8 w-8 mx-auto opacity-40" />
                <p>Nenhuma oferta encontrada no momento.</p>
                <p className="text-xs opacity-60">Tente novamente mais tarde ou verifique o nome do jogo.</p>
              </div>
            )}

            {/* Deals table */}
            {deals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {deals.length} loja{deals.length !== 1 ? "s" : ""} — ordenado por menor preço
                </p>
                <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/30">
                  {deals.map((deal, i) => {
                    const isCheapest = i === 0 && deals.length > 1;
                    const originalCents = deal.cut > 0
                      ? Math.round(deal.priceCents / (1 - deal.cut / 100))
                      : null;

                    return (
                      <div
                        key={`${deal.shopId}-${i}`}
                        className={`flex items-center gap-4 px-4 py-3 ${isCheapest ? "bg-emerald-500/5" : "bg-card"} hover:bg-accent/30 transition-colors`}
                      >
                        {/* Rank */}
                        <span className={`text-xs font-bold w-5 shrink-0 ${isCheapest ? "text-emerald-400" : "text-muted-foreground/40"}`}>
                          #{i + 1}
                        </span>

                        {/* Store name */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isCheapest ? "text-emerald-400" : ""}`}>
                            {deal.shopName}
                          </p>
                          {isCheapest && (
                            <p className="text-[10px] text-emerald-500/70">Melhor preço</p>
                          )}
                        </div>

                        {/* Price */}
                        <div className="flex items-center gap-2 shrink-0">
                          {deal.cut > 0 && originalCents && (
                            <>
                              <span className="text-[10px] bg-[#4c6b22] text-[#beee11] font-bold px-1.5 py-0.5 rounded">
                                -{deal.cut}%
                              </span>
                              <span className="text-xs text-muted-foreground line-through">
                                {formatCurrency(originalCents, "BRL")}
                              </span>
                            </>
                          )}
                          <span className={`text-sm font-bold ${deal.cut > 0 ? "text-[#beee11]" : ""}`}>
                            {formatCurrency(deal.priceCents, "BRL")}
                          </span>
                        </div>

                        {/* CTA */}
                        <a
                          href={deal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                          style={{ background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))" }}
                        >
                          Comprar <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>

                {cheapest && (
                  <p className="text-xs text-muted-foreground/50 text-center pt-1">
                    Preços via IsThereAnyDeal · Atualizado a cada 12h
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!selectedGame && !loadingPrices && (
          <div className="text-center py-20 text-muted-foreground space-y-2">
            <Search className="h-10 w-10 mx-auto opacity-20" />
            <p className="text-sm">Digite o nome de um jogo para ver os preços.</p>
          </div>
        )}
      </div>
    </div>
  );
}
