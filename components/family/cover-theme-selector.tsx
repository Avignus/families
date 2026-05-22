"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RARITY_CONFIG } from "@/lib/cosmetics";
import { CoverTheme } from "@/components/cosmetics/cover-theme";
import { CoverOverlay } from "@/components/cosmetics/cover-overlay";
import { CoverVideo } from "@/components/cosmetics/cover-video";
import { toast } from "sonner";
import { Lock, Loader2, Film } from "lucide-react";

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
    coverTheme:   Cosmetic | null;
    coverOverlay: Cosmetic | null;
    coverVideo:   Cosmetic | null;
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
        videos: Cosmetic[];
        activeCoverThemeId:   string | null;
        activeCoverOverlayId: string | null;
        activeCoverVideoId:   string | null;
      };
    },
    staleTime: 0,
  });

  const { data: personal } = useQuery({
    queryKey: ["family-personalization", familyId],
    queryFn: async () => {
      const res = await fetch(`/api/families/${familyId}/personalization`);
      if (!res.ok) return null;
      return (await res.json()).data as {
        coverTheme:       Cosmetic | null;
        coverVideo:       Cosmetic | null;
        ownedCoverThemes: Cosmetic[];
        ownedCoverVideos: Cosmetic[];
      };
    },
    staleTime: 0,
  });

  const applyOptimistic = (patch: Partial<FamilyQueryData["data"]>) => {
    qc.setQueryData<FamilyQueryData>(["family", familyId], (old) => {
      if (!old) return old;
      return { ...old, data: { ...old.data, ...patch } };
    });
  };

  const patchFamilyCover = useMutation({
    mutationFn: async (body: {
      cosmeticId?: string | null;
      overlayId?: string | null;
      videoId?: string | null;
      _actionId?: string;
    }) => {
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
      if (body.cosmeticId !== undefined) {
        const theme = body.cosmeticId
          ? (data?.available ?? []).find(t => t.id === body.cosmeticId) ?? null
          : null;
        applyOptimistic({ coverTheme: theme });
      }
      if (body.overlayId !== undefined) {
        const overlay = body.overlayId
          ? (data?.overlays ?? []).find(o => o.id === body.overlayId) ?? null
          : null;
        applyOptimistic({ coverOverlay: overlay });
      }
      if (body.videoId !== undefined) {
        setOptimisticVideoId(body.videoId);
        const video = body.videoId
          ? (data?.videos ?? []).find(v => v.id === body.videoId) ?? null
          : null;
        applyOptimistic({ coverVideo: video });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-cover-themes", familyId] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Erro");
      setOptimisticVideoId(undefined);
      qc.invalidateQueries({ queryKey: ["family", familyId] });
      qc.invalidateQueries({ queryKey: ["family-cover-themes", familyId] });
    },
    onSettled: () => {
      setPendingAction(null);
      setOptimisticVideoId(undefined);
    },
  });

  const setPersonalTheme = useMutation({
    mutationFn: async ({ coverThemeId, coverVideoId, _actionId }: {
      coverThemeId?: string | null;
      coverVideoId?: string | null;
      _actionId: string;
    }) => {
      const res = await fetch(`/api/families/${familyId}/personalization`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverThemeId, coverVideoId }),
      });
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Erro");
    },
    onMutate: ({ coverThemeId, coverVideoId, _actionId }) => {
      setPendingAction(_actionId);
      if (coverThemeId !== undefined) {
        const theme = coverThemeId
          ? (personal?.ownedCoverThemes ?? []).find(t => t.id === coverThemeId) ?? null
          : null;
        applyOptimistic({ coverTheme: theme });
      }
      if (coverVideoId !== undefined) {
        const video = coverVideoId
          ? (personal?.ownedCoverVideos ?? []).find(v => v.id === coverVideoId) ?? null
          : null;
        applyOptimistic({ coverVideo: video });
      }
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

  // Track optimistic video selection so the chip highlights instantly on click
  const [optimisticVideoId, setOptimisticVideoId] = useState<string | null | undefined>(undefined);

  if (!data) return null;

  const available       = data.available ?? [];
  const overlays        = data.overlays ?? [];
  const videos          = data.videos ?? [];
  const ownedPersonal   = personal?.ownedCoverThemes ?? [];
  const ownedPersonalVideos = personal?.ownedCoverVideos ?? [];
  const personalThemeId = personal?.coverTheme?.id ?? null;
  const personalVideoId = personal?.coverVideo?.id ?? null;
  const activeOverlayId = data.activeCoverOverlayId ?? null;
  // Use optimistic value while mutation is in-flight; fall back to server value
  const activeVideoId   = optimisticVideoId !== undefined ? optimisticVideoId : (data.activeCoverVideoId ?? null);
  const previewVideo    = videos.find(v => v.id === activeVideoId) ?? null;

  return (
    <div className={`space-y-6 relative ${isBusy ? "cursor-wait" : ""}`}>

      {/* Chief section */}
      {isChief && (
        <div className="space-y-4">
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
                  className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 text-left ${
                    isActive ? "border-primary" : "border-border/40 hover:border-border"
                  } ${isBusy && !isLoading ? "opacity-50 pointer-events-none" : ""}`}
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
                  <div className="absolute top-1 right-1">
                    {isLoading
                      ? <Loader2 className="h-3 w-3 animate-spin text-primary drop-shadow-[0_0_4px_hsl(var(--primary))]" />
                      : isActive
                        ? <div className="h-2 w-2 rounded-full bg-primary" />
                        : null}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Video chips */}
          {videos.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vídeo de fundo</p>

              {/* Live preview */}
              {previewVideo && (
                <div className="relative h-20 rounded-lg overflow-hidden bg-black border border-border/40">
                  <video
                    key={(previewVideo.config as { videoPath?: string }).videoPath}
                    autoPlay muted loop playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  >
                    <source src={(previewVideo.config as { videoPath?: string }).videoPath} type="video/mp4" />
                  </video>
                  <div className="absolute bottom-1 right-2 text-[9px] text-white/70">{previewVideo.name}</div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => patchFamilyCover.mutate({ videoId: null, _actionId: "video-none" })}
                  disabled={isBusy}
                  className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-150 ${
                    !activeVideoId ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"
                  } ${isBusy && pendingAction !== "video-none" ? "opacity-40 pointer-events-none" : ""}`}
                >
                  Nenhum
                </button>
                {videos.map((vid) => {
                  const rarity = RARITY_CONFIG[vid.rarity] ?? RARITY_CONFIG.comum;
                  const isActive = activeVideoId === vid.id;
                  const isLoading = pendingAction === `video-${vid.id}`;
                  return (
                    <button
                      key={vid.id}
                      onClick={() => patchFamilyCover.mutate({ videoId: vid.id, _actionId: `video-${vid.id}` })}
                      disabled={isBusy}
                      title={vid.description ?? vid.name}
                      className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-150 flex items-center gap-1.5 ${
                        isActive ? `border-current ${rarity.color} ${rarity.bg}` : "border-border/40 text-muted-foreground hover:border-border"
                      } ${isBusy && !isLoading ? "opacity-40 pointer-events-none" : ""}`}
                    >
                      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />}
                      {vid.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overlay chips */}
          {overlays.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sobreposição</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => patchFamilyCover.mutate({ overlayId: null, _actionId: "overlay-none" })}
                  disabled={isBusy}
                  className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-150 ${
                    !activeOverlayId ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"
                  } ${isBusy && pendingAction !== "overlay-none" ? "opacity-40 pointer-events-none" : ""}`}
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
                      className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-150 flex items-center gap-1 ${
                        isActive ? `border-current ${rarity.color} ${rarity.bg}` : "border-border/40 text-muted-foreground hover:border-border"
                      } ${isBusy && !isLoading ? "opacity-40 pointer-events-none" : ""}`}
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
      {(ownedPersonal.length > 0 || ownedPersonalVideos.length > 0) && (
        <div className="space-y-3 border-t border-border/40 pt-4">
          <div>
            <p className="text-sm font-semibold">Minha visão da família</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Só você vê. Outros membros e visitantes continuam vendo o tema do chief.
            </p>
          </div>

          {/* Personal video chips */}
          {ownedPersonalVideos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vídeo de fundo</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPersonalTheme.mutate({ coverVideoId: null, _actionId: "personal-video-none" })}
                  disabled={isBusy}
                  className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-150 ${
                    !personalVideoId ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"
                  } ${isBusy && pendingAction !== "personal-video-none" ? "opacity-40 pointer-events-none" : ""}`}
                >
                  Nenhum
                </button>
                {ownedPersonalVideos.map((vid) => {
                  const rarity = RARITY_CONFIG[vid.rarity] ?? RARITY_CONFIG.comum;
                  const isActive = personalVideoId === vid.id;
                  const isLoading = pendingAction === `personal-video-${vid.id}`;
                  return (
                    <button
                      key={vid.id}
                      onClick={() => setPersonalTheme.mutate({ coverVideoId: vid.id, _actionId: `personal-video-${vid.id}` })}
                      disabled={isBusy}
                      title={vid.description ?? vid.name}
                      className={`text-[11px] px-3 py-1.5 rounded-full border transition-all duration-150 flex items-center gap-1.5 ${
                        isActive ? `border-current ${rarity.color} ${rarity.bg}` : "border-border/40 text-muted-foreground hover:border-border"
                      } ${isBusy && !isLoading ? "opacity-40 pointer-events-none" : ""}`}
                    >
                      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Film className="h-3 w-3" />}
                      {vid.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Personal theme cards */}
          {ownedPersonal.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setPersonalTheme.mutate({ coverThemeId: null, _actionId: "personal-default" })}
                disabled={isBusy}
                className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 text-left ${
                  !personalThemeId ? "border-primary" : "border-border/40 hover:border-border"
                } ${isBusy && pendingAction !== "personal-default" ? "opacity-50 pointer-events-none" : ""}`}
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
                    className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 text-left ${
                      isPersonal ? "border-primary" : "border-border/40 hover:border-border"
                    } ${isBusy && !isLoading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className="h-14 relative overflow-hidden">
                      <CoverTheme config={theme.config as Record<string, unknown>} className="absolute inset-0" />
                      {isPersonal && activeOverlayId && (() => {
                        const ov = overlays.find(o => o.id === activeOverlayId);
                        return ov ? <CoverOverlay config={ov.config as {cssClass?:string}} /> : null;
                      })()}
                    </div>
                    <div className="px-2 py-1.5 bg-card/80">
                      <p className="text-[11px] font-semibold leading-tight">{theme.name}</p>
                      <span className={`text-[9px] font-medium ${rarity.color}`}>{rarity.label}</span>
                    </div>
                    <div className="absolute top-1 right-1">
                      {isLoading
                        ? <Loader2 className="h-3 w-3 animate-spin text-primary drop-shadow-[0_0_4px_hsl(var(--primary))]" />
                        : isPersonal
                          ? <div className="h-2 w-2 rounded-full bg-primary" />
                          : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isChief && ownedPersonal.length === 0 && ownedPersonalVideos.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Lock className="h-3.5 w-3.5" />
          <span>Conquiste insígnias para desbloquear temas e vídeos de capa personalizados.</span>
        </div>
      )}
    </div>
  );
}
