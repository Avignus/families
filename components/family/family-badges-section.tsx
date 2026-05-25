"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Shield, Users } from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { RARITY_CONFIG } from "@/lib/cosmetics";
import { useLanguage } from "@/lib/i18n/context";

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
  compact?: boolean;
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
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs">Carregando insígnias…</span>
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma insígnia ainda.
      </p>
    );
  }

  if (compact) {
    return (
      <TooltipPrimitive.Provider delayDuration={200}>
        <div className="flex flex-wrap gap-1.5">
          {badges.slice(0, 6).map((badge) => (
            <BadgeIcon key={badge.achievementId} badge={badge} />
          ))}
        </div>
      </TooltipPrimitive.Provider>
    );
  }

  const familyBadges = badges.filter((b) => b.category === "familia");
  const memberBadges = badges.filter((b) => b.category !== "familia");

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <div className="space-y-3">
        {familyBadges.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Família
            </p>
            <div className="flex flex-wrap gap-1.5">
              {familyBadges.map((badge) => (
                <BadgeIcon key={badge.achievementId} badge={badge} />
              ))}
            </div>
          </div>
        )}

        {memberBadges.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              Membros
            </p>
            <div className="flex flex-wrap gap-1.5">
              {memberBadges.map((badge) => (
                <BadgeIcon key={badge.achievementId} badge={badge} />
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipPrimitive.Provider>
  );
}

function BadgeIcon({ badge }: { badge: Badge }) {
  const { t } = useLanguage();
  const cfg = RARITY_CONFIG[badge.rarity] ?? RARITY_CONFIG.comum;
  const [imgError, setImgError] = useState(false);
  const title = t.achievements[badge.slug] ?? badge.title;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center cursor-default transition-transform hover:scale-110 ${cfg.bg} ${cfg.glow}`}
          style={{ border: `1.5px solid ${rarityBorderColor(badge.rarity)}` }}
        >
          {!imgError ? (
            <img
              src={`/badges/${badge.slug}.png`}
              alt={title}
              className="w-7 h-7 object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <Shield className={`h-4 w-4 ${cfg.color}`} />
          )}
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="top"
          align="center"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 w-44 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-left animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <p className="text-xs font-semibold text-foreground leading-tight">{title}</p>
          <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${cfg.color}`}>{cfg.label}</p>
          {badge.description && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{badge.description}</p>
          )}
          {badge.members.length > 0 && (
            <div className="flex -space-x-1 mt-1.5">
              {badge.members.slice(0, 5).map((m) => (
                <Avatar key={m.userId} className="h-4 w-4 ring-1 ring-background" title={m.personaName}>
                  <AvatarImage src={m.avatarMedium} />
                  <AvatarFallback className="text-[6px]">{m.personaName[0]}</AvatarFallback>
                </Avatar>
              ))}
              {badge.members.length > 5 && (
                <div className="h-4 w-4 rounded-full ring-1 ring-background bg-secondary flex items-center justify-center text-[7px] text-muted-foreground">
                  +{badge.members.length - 5}
                </div>
              )}
            </div>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
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
