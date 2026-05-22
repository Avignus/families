"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RARITY_CONFIG } from "@/lib/cosmetics";
import { CoverTheme } from "@/components/cosmetics/cover-theme";
import { toast } from "sonner";
import { Lock } from "lucide-react";

type Cosmetic = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  rarity: string;
  config: Record<string, unknown>;
  isDefault: boolean;
  contributor?: { id: string; personaName: string; avatarUrl: string } | null;
};

type Props = {
  familyId: string;
  isChief: boolean;
  currentUserId: string;
};

export function CoverThemeSelector({ familyId, isChief, currentUserId }: Props) {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["family-cover-themes", familyId],
    queryFn: async () => {
      const res = await fetch(`/api/families/${familyId}/cover-theme`);
      if (!res.ok) return null;
      return (await res.json()).data as {
        available: Cosmetic[];
        overlays: Cosmetic[];
        activeCoverThemeId: string | null;
        activeCoverOverlayId: string | null;
      };
    },
    staleTime: 0,
  });

  const { data: personal } = useQuery({
    queryKey: ["family-personalization", familyId],
    queryFn: async () => {
      const res = await fetch(`/api/families/${familyId}/personalization`);
      if (!res.ok) return null;
      return (await res.json()).data as { coverTheme: Cosmetic | null; ownedCoverThemes: Cosmetic[] };
    },
    staleTime: 0,
  });

  const patchFamilyCover = useMutation({
    mutationFn: async (body: { cosmeticId?: string | null; overlayId?: string | null }) => {
      const res = await fetch(`/api/families/${familyId}/cover-theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Erro");
    },
    onSuccess: () => {
      toast.success("Capa atualizada!");
      qc.invalidateQueries({ queryKey: ["family-cover-themes", familyId] });
      qc.invalidateQueries({ queryKey: ["family", familyId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const setPersonalTheme = useMutation({
    mutationFn: async (coverThemeId: string | null) => {
      const res = await fetch(`/api/families/${familyId}/personalization`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverThemeId }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Erro");
    },
    onSuccess: () => {
      toast.success("Sua visão pessoal foi atualizada!");
      qc.invalidateQueries({ queryKey: ["family-personalization", familyId] });
      qc.invalidateQueries({ queryKey: ["family", familyId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (!data) return null;

  const available = data.available ?? [];
  const overlays = data.overlays ?? [];
  const ownedPersonal = personal?.ownedCoverThemes ?? [];
  const personalThemeId = personal?.coverTheme?.id ?? null;
  const activeOverlayId = data.activeCoverOverlayId ?? null;

  return (
    <div className="space-y-6">
      {/* Chief section */}
      {isChief && (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold">Tema da família</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Visível para todos. Desbloqueado pelos membros do clã.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {available.map((theme) => {
              const rarity = RARITY_CONFIG[theme.rarity] ?? RARITY_CONFIG.comum;
              const isActive = data.activeCoverThemeId === theme.id
                || (!data.activeCoverThemeId && theme.slug === "capa-mosaico");
              return (
                <button
                  key={theme.id}
                  onClick={() => patchFamilyCover.mutate({ cosmeticId: theme.isDefault ? null : theme.id })}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                    isActive ? "border-primary" : "border-border/40 hover:border-border"
                  }`}
                >
                  <div className="h-14 relative">
                    <CoverTheme config={theme.config as Record<string, unknown>} className="absolute inset-0" />
                    {theme.isDefault && (
                      <div className="absolute inset-0 bg-card/60 flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground">Padrão</span>
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5 bg-card/80">
                    <p className="text-[11px] font-semibold leading-tight">{theme.name}</p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={`text-[9px] font-medium ${rarity.color}`}>{rarity.label}</span>
                      {theme.contributor && (
                        <span className="text-[9px] text-muted-foreground truncate max-w-[70px]">
                          por {theme.contributor.personaName}
                        </span>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Overlay section — chief picks an overlay on top of any theme */}
          {overlays.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sobreposição</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => patchFamilyCover.mutate({ overlayId: null })}
                  className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                    !activeOverlayId ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"
                  }`}
                >
                  Nenhuma
                </button>
                {overlays.map((ov) => {
                  const rarity = RARITY_CONFIG[ov.rarity] ?? RARITY_CONFIG.comum;
                  const isActive = activeOverlayId === ov.id;
                  return (
                    <button
                      key={ov.id}
                      onClick={() => patchFamilyCover.mutate({ overlayId: ov.id })}
                      title={ov.description ?? ov.name}
                      className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${
                        isActive ? `border-current ${rarity.color} ${rarity.bg}` : "border-border/40 text-muted-foreground hover:border-border"
                      }`}
                    >
                      {ov.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Personal section (all members) */}
      {ownedPersonal.length > 0 && (
        <div className="space-y-3 border-t border-border/40 pt-4">
          <div>
            <p className="text-sm font-semibold">Minha visão da família</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Só você vê. Outros membros e visitantes continuam vendo o tema do chief.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              onClick={() => setPersonalTheme.mutate(null)}
              className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                !personalThemeId ? "border-primary" : "border-border/40 hover:border-border"
              }`}
            >
              <div className="h-14 bg-card/40 flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">Tema do chief</span>
              </div>
              <div className="px-2 py-1.5 bg-card/80">
                <p className="text-[11px] font-semibold">Padrão</p>
              </div>
              {!personalThemeId && <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />}
            </button>

            {ownedPersonal.map((theme) => {
              const rarity = RARITY_CONFIG[theme.rarity] ?? RARITY_CONFIG.comum;
              const isPersonal = personalThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => setPersonalTheme.mutate(theme.id)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                    isPersonal ? "border-primary" : "border-border/40 hover:border-border"
                  }`}
                >
                  <div className="h-14 relative">
                    <CoverTheme config={theme.config as Record<string, unknown>} className="absolute inset-0" />
                  </div>
                  <div className="px-2 py-1.5 bg-card/80">
                    <p className="text-[11px] font-semibold leading-tight">{theme.name}</p>
                    <span className={`text-[9px] font-medium ${rarity.color}`}>{rarity.label}</span>
                  </div>
                  {isPersonal && <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isChief && ownedPersonal.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Lock className="h-3.5 w-3.5" />
          <span>Conquiste insígnias para desbloquear temas de capa personalizados.</span>
        </div>
      )}
    </div>
  );
}
