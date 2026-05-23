"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Shield } from "lucide-react";
import { RARITY_CONFIG } from "@/lib/cosmetics";

type BadgeMember = {
  userId: string;
  personaName: string;
  avatarMedium: string;
};

type Badge = {
  achievementId: string;
  slug: string;
  title: string;
  description: string;
  rarity: string;
  category: string;
  members: BadgeMember[];
};

type Props = {
  familyId: string;
  compact?: boolean; // catalog card: show fewer badges, smaller
};

export function FamilyBadgesSection({ familyId, compact = false }: Props) {
  const { data, isLoading } = useQuery<{ data: { badges: Badge[] } }>({
    queryKey: ["family-badges", familyId],
    queryFn: async () => {
      const r = await fetch(`/api/families/${familyId}/badges`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 2 * 60_000,
  });

  const badges = data?.data?.badges ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando insígnias…</span>
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhuma insígnia desbloqueada ainda.
      </p>
    );
  }

  const displayed = compact ? badges.slice(0, 6) : badges;

  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
      {displayed.map((badge) => (
        <BadgeCard key={badge.achievementId} badge={badge} compact={compact} />
      ))}
    </div>
  );
}

function BadgeCard({ badge, compact }: { badge: Badge; compact: boolean }) {
  const cfg = RARITY_CONFIG[badge.rarity] ?? RARITY_CONFIG.comum;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`rounded-xl border bg-card flex flex-col items-center text-center transition-all ${cfg.glow} ${compact ? "p-2 gap-1" : "p-4 gap-3"}`}
      style={{ borderColor: rarityBorderColor(badge.rarity) }}
    >
      {/* Badge image */}
      <div className={`group relative flex items-center justify-center rounded-full ${cfg.bg} ${compact ? "w-12 h-12" : "w-24 h-24"}`}>
        {!imgError ? (
          <img
            src={`/badges/${badge.slug}.png`}
            alt={badge.title}
            className={`object-contain ${compact ? "w-10 h-10" : "w-20 h-20"}`}
            onError={() => setImgError(true)}
          />
        ) : (
          <Shield className={`${compact ? "h-6 w-6" : "h-12 w-12"} ${cfg.color}`} />
        )}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap text-[11px] bg-popover border border-border rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-md text-foreground">
          {badge.title}
        </span>
      </div>

      {/* Title */}
      <p className={`font-semibold leading-tight line-clamp-2 ${compact ? "text-[10px]" : "text-sm"}`}>
        {badge.title}
      </p>

      {/* Rarity label */}
      <span className={`uppercase tracking-wide font-bold ${compact ? "text-[8px]" : "text-[11px]"} ${cfg.color}`}>
        {cfg.label}
      </span>

      {/* Member avatars */}
      <div className="flex -space-x-1.5 justify-center">
        {badge.members.slice(0, compact ? 3 : 5).map((m) => (
          <Avatar key={m.userId} className={`ring-1 ring-background ${compact ? "h-4 w-4" : "h-6 w-6"}`} title={m.personaName}>
            <AvatarImage src={m.avatarMedium} />
            <AvatarFallback className="text-[7px]">{m.personaName[0]}</AvatarFallback>
          </Avatar>
        ))}
        {badge.members.length > (compact ? 3 : 5) && (
          <div className={`rounded-full ring-1 ring-background bg-secondary flex items-center justify-center text-muted-foreground ${compact ? "h-4 w-4 text-[7px]" : "h-6 w-6 text-[9px]"}`}>
            +{badge.members.length - (compact ? 3 : 5)}
          </div>
        )}
      </div>
    </div>
  );
}

function rarityBorderColor(rarity: string): string {
  const map: Record<string, string> = {
    lendario: "rgba(251,191,36,0.35)",
    raro:     "rgba(96,165,250,0.35)",
    incomum:  "rgba(52,211,153,0.25)",
    comum:    "rgba(113,113,122,0.2)",
  };
  return map[rarity] ?? map.comum;
}
