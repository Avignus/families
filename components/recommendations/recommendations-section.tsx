"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
  steamData: SteamData | null;
};

type Props = {
  familyId: string;
  currentUserId: string;
};

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const image = rec.steamData?.headerImage ?? `https://cdn.cloudflare.steamstatic.com/steam/apps/${rec.steamAppId}/header.jpg`;
  const name = rec.steamData?.name ?? rec.gameName;
  const storeUrl = `https://store.steampowered.com/app/${rec.steamAppId}`;

  return (
    <a
      href={storeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-44 rounded-lg border border-border/40 bg-card/60 hover:border-border hover:bg-card/80 transition-colors group"
    >
      <img
        src={image}
        alt={name}
        className="w-full h-[62px] object-cover rounded-t-lg group-hover:brightness-110 transition-[filter]"
      />
      <div className="px-2 py-2 space-y-1">
        <p className="text-[11px] font-semibold leading-tight line-clamp-1">{name}</p>
        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-3 group-hover:line-clamp-none">
          {rec.reason}
        </p>
      </div>
    </a>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-xs text-muted-foreground py-1">{label}</p>
  );
}

export function RecommendationsSection({ familyId, currentUserId }: Props) {
  const [expanded, setExpanded] = useState(true);

  const familyQuery = useQuery<Recommendation[]>({
    queryKey: ["family-recommendations", familyId],
    queryFn: async () => {
      const res = await fetch(`/api/families/${familyId}/recommendations`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.data ?? [];
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

  const familyRecs = familyQuery.data ?? [];
  const personalRecs = personalQuery.data ?? [];
  const isLoading = familyQuery.isLoading || personalQuery.isLoading;
  const isEmpty = !isLoading && familyRecs.length === 0 && personalRecs.length === 0;

  return (
    <>
      <Separator />
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-sm font-semibold w-full text-left"
        >
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <span>Recomendações</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="mt-4 space-y-5">
            {isLoading && (
              <div className="flex gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-shrink-0 w-44 h-32 rounded-lg bg-secondary animate-pulse" />
                ))}
              </div>
            )}

            {isEmpty && !isLoading && (
              <EmptyState label="Nenhuma recomendação disponível ainda. As recomendações são geradas semanalmente." />
            )}

            {!isLoading && familyRecs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Para a família</p>
                <div className="flex gap-3 overflow-x-auto pb-2 items-start">
                  {familyRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} />
                  ))}
                </div>
              </div>
            )}

            {!isLoading && personalRecs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Para você</p>
                <div className="flex gap-3 overflow-x-auto pb-2 items-start">
                  {personalRecs.map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} />
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
