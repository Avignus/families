"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Lightbulb, Plus, Check, Loader2, Sparkles, Tag } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { SteamPriceBadge } from "@/components/ui/steam-price-badge";
import type { SaleItem } from "@/app/api/families/[id]/on-sale/route";

type SteamData = {
  name: string;
  headerImage: string;
  priceCents: number;
  originalPriceCents?: number;
  discountPercent?: number;
  currency: string;
  isFree: boolean;
};

type Recommendation = {
  id: string;
  steamAppId: number;
  gameName: string;
  reason: string;
  rank: number;
  batchId: string | null;
  source: string;
  generatedAt: string;
  steamData: SteamData | null;
};

type Quota = {
  used: number;
  limit: number;
  remaining: number;
  tier: string;
  resetsAt: string | null;
};

type Props = {
  familyId: string;
  currentUserId: string;
  wishlistAppIds: Set<number>;
};

function RecommendationCard({ rec, familyId, wishlistAppIds }: { rec: Recommendation; familyId: string; wishlistAppIds: Set<number> }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const added = wishlistAppIds.has(rec.steamAppId);

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    try {
      const res = await fetch(`/api/families/${familyId}/wishlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamAppId: rec.steamAppId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = data.error?.code;
        toast.error(code === "GAME_ALREADY_IN_FAMILY" ? "Jogo já está na lista" : (data.error?.message ?? "Erro ao adicionar"));
        return;
      }
      toast.success("Adicionado à lista", { description: rec.steamData?.name ?? rec.gameName });
      qc.invalidateQueries({ queryKey: ["family", familyId] });
    } finally {
      setAdding(false);
    }
  };

  const headerImage = rec.steamData?.headerImage ?? `https://cdn.cloudflare.steamstatic.com/steam/apps/${rec.steamAppId}/header.jpg`;
  const name = rec.steamData?.name ?? rec.gameName;
  const storeUrl = `https://store.steampowered.com/app/${rec.steamAppId}`;
  const isNew = rec.source === "ondemand";

  return (
    <a
      href={storeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative rounded-md overflow-hidden block hover:scale-[1.04] hover:z-10 transition-all duration-200 hover:shadow-[0_8px_28px_hsl(0_0%_0%/0.55)] ${isNew ? "ring-1 ring-primary/50" : ""}`}
    >
      <div className="relative aspect-[2/3] bg-secondary">
        <img
          src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${rec.steamAppId}/library_600x900.jpg`}
          alt={name}
          className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110 group-hover:saturate-[1.08]"
          onError={(e) => {
            const el = e.currentTarget;
            if (!el.dataset.fallback) { el.dataset.fallback = "1"; el.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${rec.steamAppId}/library_600x900.jpg`; }
            else if (el.dataset.fallback === "1") { el.dataset.fallback = "2"; el.src = headerImage; }
            else { el.style.display = "none"; }
          }}
        />

        {/* Hover overlay: reason + add button */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2 gap-1.5">
          <p className="text-[9px] text-white/80 leading-snug line-clamp-4">{rec.reason}</p>
          <button
            onClick={handleAdd}
            disabled={adding || added}
            className={`w-full h-6 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors shrink-0 ${
              added
                ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/30"
                : "bg-white/15 hover:bg-white/25 text-white border border-white/20"
            } disabled:opacity-60`}
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : added ? <><Check className="h-3 w-3" /> Na lista</> : <><Plus className="h-3 w-3" /> Adicionar</>}
          </button>
        </div>

        {/* Name strip — always visible, hides on hover */}
        <div className="absolute bottom-0 inset-x-0 group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
          <div className="h-8 bg-gradient-to-b from-transparent to-black/80" />
          <div className="bg-black/80 pb-9 px-1.5 pt-0.5">
            <p className="text-[10px] font-semibold text-white leading-tight line-clamp-2">{name}</p>
          </div>
        </div>

        {/* Price / Grátis badge — hides on hover */}
        {rec.steamData && (
          <div className="absolute bottom-0 inset-x-0 flex justify-center pb-1.5 group-hover:opacity-0 transition-opacity pointer-events-none">
            {rec.steamData.isFree ? (
              <div className="rounded bg-[#2a3f5a] font-bold text-[#c7d5e0] leading-none px-2 py-1.5 text-[11px]">
                Grátis
              </div>
            ) : rec.steamData.priceCents > 0 ? (
              <SteamPriceBadge
                priceCents={rec.steamData.priceCents}
                originalPriceCents={rec.steamData.originalPriceCents}
                discountPercent={rec.steamData.discountPercent}
                currency={rec.steamData.currency}
                size="xs"
              />
            ) : null}
          </div>
        )}

        {/* "novo" badge */}
        {isNew && (
          <span className="absolute top-1.5 left-1.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/90 text-white">
            novo
          </span>
        )}

        {/* Store icon / added checkmark — top-right */}
        {added ? (
          <div className="absolute top-1.5 right-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/80 backdrop-blur-sm">
              <Check className="h-3 w-3 text-white" />
            </span>
          </div>
        ) : (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-black/60 backdrop-blur-sm flex items-center justify-center group-hover:opacity-0 transition-opacity pointer-events-none">
            <img
              src="/api/favicon?domain=store.steampowered.com"
              alt="Steam"
              className="w-3.5 h-3.5 rounded-sm"
              onError={(e) => { e.currentTarget.parentElement!.style.display = "none"; }}
            />
          </div>
        )}
      </div>
    </a>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground py-1">{label}</p>;
}

function storeFavicon(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `/api/favicon?domain=${encodeURIComponent(hostname)}`;
  } catch {
    return "";
  }
}

function SaleCard({ item, familyId, wishlistAppIds, showAdd }: {
  item: SaleItem;
  familyId: string;
  wishlistAppIds: Set<number>;
  showAdd: boolean;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const added = wishlistAppIds.has(item.steamAppId);

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    try {
      const res = await fetch(`/api/families/${familyId}/wishlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steamAppId: item.steamAppId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error?.code === "GAME_ALREADY_IN_FAMILY" ? "Jogo já está na lista" : (data.error?.message ?? "Erro ao adicionar"));
        return;
      }
      toast.success("Adicionado à lista", { description: item.name });
      qc.invalidateQueries({ queryKey: ["family", familyId] });
    } finally {
      setAdding(false);
    }
  };

  return (
    <a
      href={item.cheapestDeal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative rounded-md overflow-hidden block hover:scale-[1.04] hover:z-10 transition-all duration-200 hover:shadow-[0_8px_28px_hsl(0_0%_0%/0.55)]"
    >
      <div className="relative aspect-[2/3] bg-secondary">
        <img
          src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${item.steamAppId}/library_600x900.jpg`}
          alt={item.name}
          className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110 group-hover:saturate-[1.08]"
          onError={(e) => {
            const el = e.currentTarget;
            if (!el.dataset.fallback) { el.dataset.fallback = "1"; el.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamAppId}/library_600x900.jpg`; }
            else { el.style.display = "none"; }
          }}
        />

        {/* Name strip — always visible, hides on hover */}
        <div className="absolute bottom-0 inset-x-0 group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
          <div className="h-8 bg-gradient-to-b from-transparent to-black/80" />
          <div className="bg-black/80 pb-9 px-1.5 pt-0.5">
            <p className="text-[10px] font-semibold text-white leading-tight line-clamp-2">{item.name}</p>
          </div>
        </div>

        {/* Hover overlay: loja */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/40 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2">
          <p className="text-[10px] font-semibold text-white leading-tight line-clamp-2">{item.name}</p>
          <p className="text-[9px] text-white/50 truncate mt-0.5">{item.cheapestDeal.shopName}</p>
        </div>

        {/* Botão "+" — só para recomendados, canto inferior direito */}
        {showAdd && (
          <button
            onClick={handleAdd}
            disabled={adding || added}
            className={`absolute bottom-2 right-2 z-10 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-50 ${
              added
                ? "bg-emerald-500/80 text-white"
                : "bg-white/20 hover:bg-white/35 text-white backdrop-blur-sm"
            }`}
            title={added ? "Na lista" : "Adicionar à wishlist"}
          >
            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        )}

        {/* Favicon da loja — canto superior direito, some no hover */}
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded bg-black/60 backdrop-blur-sm flex items-center justify-center group-hover:opacity-0 transition-opacity pointer-events-none"
          title={item.cheapestDeal.shopName}>
          <img
            src={storeFavicon(item.cheapestDeal.url)}
            alt={item.cheapestDeal.shopName}
            className="w-3.5 h-3.5 rounded-sm"
            onError={(e) => { e.currentTarget.parentElement!.style.display = "none"; }}
          />
        </div>

        {/* Price badge — centrado no fundo, some no hover */}
        <div className="absolute bottom-0 inset-x-0 flex justify-center pb-1.5 group-hover:opacity-0 transition-opacity pointer-events-none">
          <SteamPriceBadge
            priceCents={item.cheapestDeal.priceCents}
            originalPriceCents={item.steamPriceCents}
            discountPercent={item.cheapestDeal.cut}
            currency={item.currency}
            size="xs"
          />
        </div>
      </div>
    </a>
  );
}

export function RecommendationsSection({ familyId, currentUserId, wishlistAppIds }: Props) {
  const [expanded, setExpanded] = useState(true);

  const familyQuery = useQuery<{ recs: Recommendation[]; quota: Quota }>({
    queryKey: ["family-recommendations", familyId],
    queryFn: async () => {
      const res = await fetch(`/api/families/${familyId}/recommendations`);
      if (!res.ok) return { recs: [], quota: { used: 0, limit: 1, remaining: 1, tier: "bronze", resetsAt: null } };
      const data = await res.json();
      return data.data ?? { recs: [], quota: { used: 0, limit: 1, remaining: 1, tier: "bronze", resetsAt: null } };
    },
    staleTime: 10 * 60 * 1000,
  });

  const personalQuery = useQuery<Recommendation[]>({
    queryKey: ["personal-recommendations", currentUserId],
    queryFn: async () => {
      const res = await fetch("/api/me/recommendations");
      if (!res.ok) return [];
      const data = await res.json();
      return data.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const qc = useQueryClient();

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/families/${familyId}/recommendations`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Erro ao buscar recomendações");
      return data.data as { family: Recommendation[]; personal: Recommendation[]; quota: Quota };
    },
    onSuccess: (data) => {
      // Prepend new family recs + update quota
      qc.setQueryData<{ recs: Recommendation[]; quota: Quota }>(
        ["family-recommendations", familyId],
        (old) => ({
          recs: [...data.family, ...(old?.recs ?? [])],
          quota: data.quota,
        })
      );
      // Prepend new personal recs
      qc.setQueryData<Recommendation[]>(
        ["personal-recommendations", currentUserId],
        (old) => [...data.personal, ...(old ?? [])]
      );
      toast.success(`${data.family.length + data.personal.length} novas recomendações encontradas`);
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar recomendações");
    },
  });

  const onSaleQuery = useQuery<{ wishlistOnSale: SaleItem[]; recsOnSale: SaleItem[] }>({
    queryKey: ["family-on-sale", familyId],
    queryFn: async () => {
      const res = await fetch(`/api/families/${familyId}/on-sale`);
      if (!res.ok) return { wishlistOnSale: [], recsOnSale: [] };
      const data = await res.json();
      return data.data ?? { wishlistOnSale: [], recsOnSale: [] };
    },
    staleTime: 60 * 60 * 1000, // 1 hour — ITAD cache is 12h, no need to refresh often
  });

  const familyRecs = familyQuery.data?.recs ?? [];
  const personalRecs = personalQuery.data ?? [];
  const quota = familyQuery.data?.quota;
  const isLoading = familyQuery.isLoading || personalQuery.isLoading;
  const isEmpty = !isLoading && familyRecs.length === 0 && personalRecs.length === 0;
  const wishlistOnSale = onSaleQuery.data?.wishlistOnSale ?? [];
  const recsOnSale = onSaleQuery.data?.recsOnSale ?? [];

  return (
    <>
      <Separator />
      <div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-left"
          >
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <span>Recomendações</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {expanded && quota && (
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending || quota.remaining === 0}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                quota.remaining === 0
                  ? `Limite semanal atingido (elo ${quota.tier}). ${quota.resetsAt ? `Renova em ${Math.ceil((new Date(quota.resetsAt).getTime() - Date.now()) / 86400000)}d.` : ""}`
                  : `${quota.remaining} busca${quota.remaining !== 1 ? "s" : ""} restante${quota.remaining !== 1 ? "s" : ""} esta semana · elo ${quota.tier}`
              }
            >
              {refreshMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>
                {refreshMutation.isPending
                  ? "Buscando..."
                  : quota.remaining === 0
                  ? "Limite semanal"
                  : "Descobrir mais"}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                quota.remaining === 0
                  ? "bg-muted/50 text-muted-foreground"
                  : "bg-primary/10 text-primary"
              }`}>
                {quota.remaining}/{quota.limit}
              </span>
            </button>
          )}
        </div>

        {expanded && (
          <div className="mt-4 space-y-5">
            {isLoading && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="aspect-[2/3] rounded-md bg-secondary animate-pulse" />
                ))}
              </div>
            )}

            {refreshMutation.isPending && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  Consultando IA e buscando jogos — pode levar até 30 segundos…
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="aspect-[2/3] rounded-md bg-secondary animate-pulse" />
                  ))}
                </div>
              </div>
            )}

            {isEmpty && !isLoading && !refreshMutation.isPending && (
              <EmptyState label={quota && quota.remaining > 0 ? "Nenhuma recomendação ainda. Clique em \"Descobrir mais\" para gerar agora." : "Nenhuma recomendação disponível. O limite diário foi atingido — tente amanhã."} />
            )}

            {!isLoading && familyRecs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Para a família</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {familyRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} familyId={familyId} wishlistAppIds={wishlistAppIds} />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && personalRecs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Para você</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {personalRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} familyId={familyId} wishlistAppIds={wishlistAppIds} />
                  ))}
                </div>
              </div>
            )}

            {wishlistOnSale.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Jogos da wishlist em promoção
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {wishlistOnSale.map((item) => (
                    <SaleCard key={item.steamAppId} item={item} familyId={familyId} wishlistAppIds={wishlistAppIds} showAdd={false} />
                  ))}
                </div>
              </div>
            )}

            {recsOnSale.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Recomendados em promoção
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {recsOnSale.map((item) => (
                    <SaleCard key={item.steamAppId} item={item} familyId={familyId} wishlistAppIds={wishlistAppIds} showAdd={true} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
