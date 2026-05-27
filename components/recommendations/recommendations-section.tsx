"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Lightbulb, Plus, Check, Loader2, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type SteamData = {
  name: string;
  headerImage: string;
  priceCents: number;
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
      className={`group relative flex-shrink-0 w-[120px] rounded-md overflow-hidden block hover:scale-[1.04] hover:z-10 transition-all duration-200 hover:shadow-[0_8px_28px_hsl(0_0%_0%/0.55)] ${isNew ? "ring-1 ring-primary/50" : ""}`}
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

        {/* Name badge — always visible, hides on hover */}
        <div className="absolute bottom-0 inset-x-0 pt-8 pb-1.5 px-1.5 bg-gradient-to-t from-black/80 to-transparent group-hover:opacity-0 transition-opacity duration-200">
          <p className="text-[10px] font-semibold text-white leading-tight line-clamp-2">{name}</p>
        </div>

        {/* "novo" badge */}
        {isNew && (
          <span className="absolute top-1.5 left-1.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/90 text-white">
            novo
          </span>
        )}

        {/* Added checkmark */}
        {added && (
          <div className="absolute top-1.5 right-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/80 backdrop-blur-sm">
              <Check className="h-3 w-3 text-white" />
            </span>
          </div>
        )}
      </div>
    </a>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground py-1">{label}</p>;
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

  const familyRecs = familyQuery.data?.recs ?? [];
  const personalRecs = personalQuery.data ?? [];
  const quota = familyQuery.data?.quota;
  const isLoading = familyQuery.isLoading || personalQuery.isLoading;
  const isEmpty = !isLoading && familyRecs.length === 0 && personalRecs.length === 0;

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
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex-shrink-0 w-[120px] aspect-[2/3] rounded-md bg-secondary animate-pulse" />
                ))}
              </div>
            )}

            {refreshMutation.isPending && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  Consultando IA e buscando jogos — pode levar até 30 segundos…
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex-shrink-0 w-[120px] aspect-[2/3] rounded-md bg-secondary animate-pulse" />
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
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {familyRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} familyId={familyId} wishlistAppIds={wishlistAppIds} />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && personalRecs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Para você</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {personalRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} familyId={familyId} wishlistAppIds={wishlistAppIds} />
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
