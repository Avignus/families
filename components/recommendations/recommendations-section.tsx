"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
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
  resetsAt: string;
};

type Props = {
  familyId: string;
  currentUserId: string;
};

function RecommendationCard({ rec, familyId }: { rec: Recommendation; familyId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

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
      setAdded(true);
      toast.success("Adicionado à lista", { description: rec.steamData?.name ?? rec.gameName });
      qc.invalidateQueries({ queryKey: ["family", familyId] });
    } finally {
      setAdding(false);
    }
  };

  const image = rec.steamData?.headerImage ?? `https://cdn.cloudflare.steamstatic.com/steam/apps/${rec.steamAppId}/header.jpg`;
  const name = rec.steamData?.name ?? rec.gameName;
  const storeUrl = `https://store.steampowered.com/app/${rec.steamAppId}`;
  const isNew = rec.source === "ondemand";

  return (
    <a
      href={storeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-col flex-shrink-0 w-44 border transition-colors group relative rounded-lg ${
        isNew ? "ring-1 ring-primary/30" : ""
      } border-border/40 bg-card/60 hover:border-border hover:bg-card/80`}
    >
      {isNew && (
        <span className="absolute top-1.5 left-1.5 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/90 text-white">
          novo
        </span>
      )}
      <img
        src={image}
        alt={name}
        className="w-full h-[62px] object-cover rounded-t-lg group-hover:brightness-110 transition-[filter]"
      />
      <div className="px-2 py-2 flex flex-col flex-1 gap-1">
        <p className="text-[11px] font-semibold leading-tight line-clamp-1">{name}</p>
        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-5 flex-1">
          {rec.reason}
        </p>
        <button
          onClick={handleAdd}
          disabled={adding || added}
          className={`w-full h-6 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors mt-1 shrink-0 ${
            added
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
              : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
          } disabled:opacity-60`}
        >
          {adding ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : added ? (
            <><Check className="h-3 w-3" /> Na lista</>
          ) : (
            <><Plus className="h-3 w-3" /> Adicionar</>
          )}
        </button>
      </div>
    </a>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-xs text-muted-foreground py-1">{label}</p>;
}

export function RecommendationsSection({ familyId, currentUserId }: Props) {
  const [expanded, setExpanded] = useState(true);

  const familyQuery = useQuery<{ recs: Recommendation[]; quota: Quota }>({
    queryKey: ["family-recommendations", familyId],
    queryFn: async () => {
      const res = await fetch(`/api/families/${familyId}/recommendations`);
      if (!res.ok) return { recs: [], quota: { used: 0, limit: 3, remaining: 3, resetsAt: "" } };
      const data = await res.json();
      return data.data ?? { recs: [], quota: { used: 0, limit: 3, remaining: 3, resetsAt: "" } };
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
              title={quota.remaining === 0 ? `Limite diário atingido. Renova amanhã.` : `${quota.remaining} busca${quota.remaining !== 1 ? "s" : ""} restante${quota.remaining !== 1 ? "s" : ""} hoje`}
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
                  ? "Limite atingido"
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
              <div className="flex gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-shrink-0 w-44 h-40 rounded-lg bg-secondary animate-pulse" />
                ))}
              </div>
            )}

            {refreshMutation.isPending && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  Consultando IA e buscando jogos — pode levar até 30 segundos…
                </p>
                <div className="flex gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex-shrink-0 w-44 h-40 rounded-lg bg-secondary animate-pulse" />
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
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {familyRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} familyId={familyId} />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && personalRecs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Para você</p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {personalRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} familyId={familyId} />
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
