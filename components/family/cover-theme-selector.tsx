"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RARITY_CONFIG } from "@/lib/cosmetics";
import { CoverTheme } from "@/components/cosmetics/cover-theme";
import { CoverOverlay } from "@/components/cosmetics/cover-overlay";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";

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

type FamilyQueryData = {
  data: {
    coverTheme: Cosmetic | null;
    coverOverlay: Cosmetic | null;
    [key: string]: unknown;
  };
};

type Props = {
  familyId: string;
  isChief: boolean;
  currentUserId: string;
};

export function CoverThemeSelector({ familyId, isChief, currentUserId }: Props) {
  const qc = useQueryClient();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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

  // Optimistic update: apply theme change to the family cache immediately,
  // avoiding a full refetch (which reloads members, wishlist, pledges, etc.)
  const applyOptimisticTheme = (theme: Cosmetic | null) => {
    qc.setQueryData<FamilyQueryData>(["family", familyId], (old) => {
      if (!old) return old;
      return { ...old, data: { ...old.data, coverTheme: theme } };
    });
  };

  const applyOptimisticOverlay = (overlay: Cosmetic | null) => {
    qc.setQueryData<FamilyQueryData>(["family", familyId], (old) => {
      if (!old) return old;
      return { ...old, data: { ...old.data, coverOverlay: overlay } };
    });
  };

  const patchFamilyCover = useMutation({
    mutationFn: async (body: { cosmeticId?: string | null; overlayId?: string | null; _actionId?: string }) => {
      const { _actionId, ...payload } = body;
      const res = await fetch(`/api/families/${familyId}/cover-theme`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Erro");
    },
    onMutate: (body) => {
      setPendingAction(body._actionId ?? "patch");

      // Optimistic update: update the family banner immediately
      if (body.cosmeticId !== undefined) {
        const theme = body.cosmeticId
          ? (data?.available ?? []).find(t => t.id === body.cosmeticId) ?? null
          : null;
        applyOptimisticTheme(theme);
      }
      if (body.overlayId !== undefined) {
        const overlay = body.overlayId
          ? (data?.overlays ?? []).find(o => o.id === body.overlayId) ?? null
          : null;
        applyOptimisticOverlay(overlay);
      }
    },
    onSuccess: () => {
      // Only invalidate the selector data (lightweight), NOT the full family query
      qc.invalidateQueries({ queryKey: ["family-cover-themes", familyId] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Erro");
      // Rollback: refetch fresh data
      qc.invalidateQueries({ queryKey: ["family", familyId] });
      qc.invalidateQueries({ queryKey: ["family-cover-themes", familyId] });
    },
    onSettled: () => setPendingAction(null),
  });

  const setPersonalTheme = useMutation({
    mutationFn: async ({ coverThemeId, _actionId }: { coverThemeId: string | null; _actionId: string }) => {
      const res = await fetch(`/api/families/${familyId}/personalization`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverThemeId }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Erro");
    },
    onMutate: ({ coverThemeId, _actionId }) => {
      setPendingAction(_actionId);
      // Optimistic update for personal theme
      const theme = coverThemeId
        ? (personal?.ownedCoverThemes ?? []).find(t => t.id === coverThemeId) ?? null
        : null;
      applyOptimisticTheme(theme);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-personalization", familyId] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Erro");
      qc.invalidateQueries({ queryKey: ["family", familyId] });
      qc.invalidateQueries({ queryKey: ["family-personalization", familyId] });
    },
    onSettled: () => setPendingAction(null),
  });

  const isBusy = patchFamilyCover.isPending || setPersonalTheme.isPending;

  if (!data) return null;

  const available = data.available ?? [];
  const overlays = data.overlays ?? [];
  const ownedPersonal = personal?.ownedCoverThemes ?? [];
  const personalThemeId = personal?.coverTheme?.id ?? null;
  const activeOverlayId = data.activeCoverOverlayId ?? null;

  return (
    <div className="space-y-6 relative">
      {/* Blocking overlay during mutation */}
      {isBusy && (
        <div className="absolute inset-0 z-50 bg-background/60 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Aplicando tema...
          </div>
        </div>
      )}

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
              const isLoading = pendingAction === `theme-${theme.id}`;
              return (
                <button
                  key={theme.id}
                  onClick={() => patchFamilyCover.mutate({
                    cosmeticId: theme.isDefault ? null : theme.id,
                    _actionId: `theme-${theme.id}`,
                  })}
                  disabled={isBusy}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all text-left disabled:opacity-60 ${
                    isActive ? "border-primary" : "border-border/40 hover:border-border"
                  }`}
                >
                  <div className="h-14 relative overflow-hidden">
                    <CoverTheme config={theme.config as Record<string, unknown>} className="absolute inset-0" />
                    {theme.isDefault && (
                      <div className="absolute inset-0 bg-card/60 flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground">Padrão</span>
                      </div>
                    )}
                    {isActive && activeOverlayId && (() => {
                      const ov = overlays.find(o => o.id === activeOverlayId);
                      return ov ? <CoverOverlay config={ov.config as {cssClass?:string}} /> : null;
                    })()}
                    {isLoading && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
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

          {/* Overlay chips */}
          {overlays.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sobreposição</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => patchFamilyCover.mutate({ overlayId: null, _actionId: "overlay-none" })}
                  disabled={isBusy}
                  className={`text-[11px] px-3 py-1.5 rounded-full border transition-all disabled:opacity-60 ${
                    !activeOverlayId ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"
                  }`}
                >
                  Nenhuma
                </button>
                {overlays.map((ov) => {
                  const rarity = RARITY_CONFIG[ov.rarity] ?? RARITY_CONFIG.comum;
                  const isActive = activeOverlayId === ov.id;
                  const isLoading = pendingAction === `overlay-${ov.id}`;
                  return (
                    <button
                      key={ov.id}
                      onClick={() => patchFamilyCover.mutate({ overlayId: ov.id, _actionId: `overlay-${ov.id}` })}
                      disabled={isBusy}
                      title={ov.description ?? ov.name}
                      className={`text-[11px] px-3 py-1.5 rounded-full border transition-all disabled:opacity-60 flex items-center gap-1 ${
                        isActive ? `border-current ${rarity.color} ${rarity.bg}` : "border-border/40 text-muted-foreground hover:border-border"
                      }`}
                    >
                      {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                      {ov.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Personal section */}
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
              onClick={() => setPersonalTheme.mutate({ coverThemeId: null, _actionId: "personal-default" })}
              disabled={isBusy}
              className={`relative rounded-lg overflow-hidden border-2 transition-all text-left disabled:opacity-60 ${
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
              const isLoading = pendingAction === `personal-${theme.id}`;
              return (
                <button
                  key={theme.id}
                  onClick={() => setPersonalTheme.mutate({ coverThemeId: theme.id, _actionId: `personal-${theme.id}` })}
                  disabled={isBusy}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all text-left disabled:opacity-60 ${
                    isPersonal ? "border-primary" : "border-border/40 hover:border-border"
                  }`}
                >
                  <div className="h-14 relative overflow-hidden">
                    <CoverTheme config={theme.config as Record<string, unknown>} className="absolute inset-0" />
                    {isPersonal && activeOverlayId && (() => {
                      const ov = overlays.find(o => o.id === activeOverlayId);
                      return ov ? <CoverOverlay config={ov.config as {cssClass?:string}} /> : null;
                    })()}
                    {isLoading && (
                      <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
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
