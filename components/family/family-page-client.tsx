"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WishlistItemCard } from "@/components/wishlist/wishlist-item-card";
import { GameSearchModal } from "@/components/wishlist/game-search-modal";
import { VotesPanel } from "@/components/votes/votes-panel";
import { SteamLibraryPanel } from "@/components/family/steam-library-panel";
import { MemberActions } from "@/components/family/member-actions";
import { Plus, ChevronDown, ChevronUp, Settings, Copy, LogIn, Gamepad2, Check, X, Camera, AlertTriangle, Library, Share2, Wallet, ShoppingCart } from "lucide-react";
import { RecommendationsSection } from "@/components/recommendations/recommendations-section";
import { FamilyBadgesSection } from "@/components/family/family-badges-section";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { FamilyTierBadge } from "@/components/family-tier-badge";
import { ReputationBadge } from "@/components/reputation-badge";
import { getTier, TIER_COLORS } from "@/lib/reputation";
import { MonthlyBudgetForm } from "@/components/family/monthly-budget-form";
import { FamilyCoverArt } from "@/components/family-cover-art";
import { CoverTheme } from "@/components/cosmetics/cover-theme";
import { CoverOverlay } from "@/components/cosmetics/cover-overlay";
import { CoverVideo } from "@/components/cosmetics/cover-video";
import { THEME_IMAGES, type CoverThemeVariant } from "@/lib/cosmetics";
import { getMemberColor, formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";

type Member = {
  id: string;
  personaName: string;
  avatarUrl: string;
  avatarMedium: string;
  steamId: string;
  reputationScore?: number;
};

type WishlistItem = {
  id: string;
  steamAppId: number;
  targetPriceCents: number;
  currency: string;
  status: string;
  disbursedAt: string | null;
  ownerUserId: string | null;
  owner: Member | null;
  totalPledgedCents: number;
  percentFunded: number;
  priceAlert: "low" | "high" | null;
  priceAvgCents: number | null;
  steamData: { appId: number; name: string; headerImage: string; priceCents: number; currency: string; isFree: boolean; comingSoon?: boolean; releaseDate?: string; genres?: string[] } | null;
  itadDeals?: Array<{ shopId: string; shopName: string; priceCents: number; cut: number; url: string }>;
  pledges: Array<{
    id: string;
    pledgerUserId: string;
    amountCents: number;
    percent: number;
    paidAt: string | null;
    pledger: Member;
  }>;
};

type PendingMember = {
  id: string;
  user: Member;
  wishlistMatches: number[] | null;
  libraryExtras: { appId: number; name: string | null }[];
  feePaidAt: string | null;
  feeChargedCents: number | null;
};

type FamilyData = {
  id: string;
  name: string;
  currency: string;
  chiefId: string;
  isChief: boolean;
  currentUserId: string;
  monthlyBudgetCents: number;
  coverImageUrl: string | null;
  coverTheme:   { id: string; slug: string; name: string; config: Record<string, unknown> } | null;
  coverOverlay: { id: string; slug: string; name: string; config: Record<string, unknown> } | null;
  coverVideo:   { id: string; slug: string; name: string; config: Record<string, unknown> } | null;
  familyScore: number;
  memberships: Array<{ user: Member }>;
  pendingMemberships: PendingMember[];
  wishlistItems: WishlistItem[];
};

export function FamilyPageClient({
  familyId,
  gameStats,
  mosaicAppIds,
  totalPendingRequests,
  creditsCents,
  monthlyBudgetCents,
  autoDistributeEnabled,
}: {
  familyId: string;
  gameStats: { total: number; own: number; viaFamilies: number } | null;
  mosaicAppIds: number[];
  totalPendingRequests: number;
  creditsCents: number;
  monthlyBudgetCents: number;
  autoDistributeEnabled: boolean;
}) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const userId = (session?.user as { id?: string })?.id ?? "";
  const searchParams = useSearchParams();
  const pledgeItemId = searchParams.get("pledge") ?? null;
  const pledgePct = searchParams.get("pct") ? Math.min(100, Math.max(1, parseInt(searchParams.get("pct")!))) : undefined;

  const { data, isLoading, error, refetch } = useQuery<{ data: FamilyData }, { status: number; code: string }>({
    queryKey: ["family", familyId],
    queryFn: async () => {
      const r = await fetch(`/api/families/${familyId}`);
      const json = await r.json();
      if (!r.ok) {
        const e = Object.assign(new Error(json.error?.message ?? "Error"), {
          status: r.status,
          code: json.error?.code ?? "UNKNOWN",
        });
        throw e;
      }
      return json;
    },
    staleTime: 10_000,
    retry: false,
  });

  const family = data?.data;

  const [addGameOpen, setAddGameOpen] = useState(false);
  const [votesExpanded, setVotesExpanded] = useState(false);
  const [steamExpanded, setSteamExpanded] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [localCredits, setLocalCredits] = useState(creditsCents);
  const [autoDistribute, setAutoDistribute] = useState(autoDistributeEnabled);
  const [localCoverUrl, setLocalCoverUrl] = useState<string | null | undefined>(undefined);

  const handleDistributeCredits = async () => {
    setDistributing(true);
    try {
      const res = await fetch(`/api/families/${familyId}/distribute-credits`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? t.family.distributeError); return; }
      if (data.data?.distributed > 0) {
        setLocalCredits((prev) => prev - data.data.distributed);
        toast.success(t.family.creditsDistributed(formatCurrency(data.data.distributed, "BRL")));
        refetch();
      } else {
        toast.info(t.family.noItemsForContribution);
      }
    } finally {
      setDistributing(false);
    }
  };

  const sortedMemberships = family
    ? [...family.memberships].sort((a, b) =>
        a.user.id === family.chiefId ? -1 : b.user.id === family.chiefId ? 1 : 0
      )
    : [];

  const memberColors = new Map(
    sortedMemberships.map((m, i) => [m.user.id, getMemberColor(i)])
  );

  // Shares the same cache key as SteamLibraryPanel — no extra request
  const { data: steamLibrary } = useQuery<{ data: { members: Array<{ userId: string; ownedGames: Array<{ appId: number }> | null }> } }>({
    queryKey: ["steam-library", familyId],
    queryFn: async () => {
      const r = await fetch(`/api/families/${familyId}/steam-library`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 5 * 60_000,
    enabled: !!family,
  });

  const userOwnedAppIds = useMemo(() => {
    const member = steamLibrary?.data?.members?.find((m) => m.userId === userId);
    return new Set(member?.ownedGames?.map((g) => g.appId) ?? []);
  }, [steamLibrary, userId]);

  const handleAddGame = async (result: { appId: number; name: string }) => {
    setAddGameOpen(false);
    const res = await fetch(`/api/families/${familyId}/wishlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steamAppId: result.appId }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error?.code === "GAME_ALREADY_IN_FAMILY") {
        toast.error(data.error.message);
      } else {
        toast.error(data.error?.message ?? t.family.errorAddingGame);
      }
      return;
    }
    toast.success(t.family.gameAdded, {
      description: result.name,
      action: {
        label: t.family.viewList,
        onClick: () => document.getElementById("family-wishlist")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      },
    });
    refetch();
  };

  const copyId = () => {
    navigator.clipboard.writeText(familyId);
    toast.success(t.family.idCopied);
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-secondary rounded" />
          <div className="h-4 w-48 bg-secondary rounded" />
          <div className="flex gap-3 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 w-14 rounded-full bg-secondary" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {[1, 2].map((i) => <div key={i} className="h-48 bg-secondary rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    if ((error as { status?: number }).status === 403) {
      // Redirect to the public catalog page where the join flow lives
      if (typeof window !== "undefined") window.location.replace(`/catalog/${familyId}`);
      return null;
    }
    return (
      <div className="container py-8 text-center text-muted-foreground">
        {t.family.notFound}
      </div>
    );
  }

  if (!family) return null;

  const memberMap = new Map(family.memberships.map((m) => [m.user.id, m.user]));

  // Contributions feed: one entry per pledge on open/funded items
  const contributions: Array<{ pledger: Member; gameName: string; headerImage: string | null; steamAppId: number; amountCents: number; currency: string }> = [];
  for (const item of family.wishlistItems) {
    if (item.status !== "open" && item.status !== "funded") continue;
    const gameName = item.steamData?.name ?? `App #${item.steamAppId}`;
    for (const pledge of item.pledges) {
      const pledger = memberMap.get(pledge.pledgerUserId);
      if (!pledger) continue;
      contributions.push({ pledger, gameName, headerImage: item.steamData?.headerImage ?? null, steamAppId: item.steamAppId, amountCents: pledge.amountCents, currency: item.currency });
    }
  }

  const themeVariant = family.coverTheme?.config?.variant as CoverThemeVariant | undefined;
  const themeImage = themeVariant ? THEME_IMAGES[themeVariant] : null;

  return (
    <div className="relative">
      {/* Full-page ambient background — very subtle, carries the theme atmosphere */}
      {themeImage && (
        <>
          {/* Full-page base image — dim but clearly present throughout the page */}
          <div
            className="fixed inset-0 -z-20 pointer-events-none"
            style={{
              backgroundImage: `url(${themeImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              backgroundAttachment: "fixed",
            }}
          />
          {/* Dark scrim so content stays readable */}
          <div className="fixed inset-0 -z-10 pointer-events-none bg-background/80" />
        </>
      )}

    <div className="container py-8 space-y-6">
      <Card className="overflow-hidden">
        {/* isolate forces stacking context so overflow-hidden clips transforms */}
        <div className="relative h-[480px] overflow-hidden isolate group/banner">
          <div className="absolute inset-0">
            {/* Base layer: video > themed image > fallback */}
            {family.coverVideo ? (
              <CoverVideo config={family.coverVideo.config as { videoPath?: string }} />
            ) : family.coverTheme ? (
              <CoverTheme config={family.coverTheme.config} className="w-full h-full">
                {(localCoverUrl ?? family.coverImageUrl) ? (
                  <img src={localCoverUrl ?? family.coverImageUrl!} alt={family.name} className="w-full h-full object-cover" />
                ) : (
                  <FamilyCoverArt familyId={familyId} />
                )}
              </CoverTheme>
            ) : (localCoverUrl ?? family.coverImageUrl) ? (
              <img
                src={localCoverUrl ?? family.coverImageUrl!}
                alt={family.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <FamilyCoverArt familyId={familyId} />
            )}
          </div>
          {/* Gradient — z-10 so overlay (z-20) renders above it */}
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-card via-card/20 to-transparent" />
          {/* Overlay — inline-style divs, z-20 above gradient */}
          {family.coverOverlay && (
            <CoverOverlay config={family.coverOverlay.config as { cssClass?: string }} />
          )}
          {/* Chief: change cover button — z-30 above overlay */}
          {family.isChief && (
            <label className="absolute top-3 right-3 z-30 cursor-pointer opacity-0 group-hover/banner:opacity-100 transition-opacity">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append("file", file);
                  const res = await fetch(`/api/families/${familyId}/cover`, { method: "POST", body: form });
                  const data = await res.json();
                  if (!res.ok) { toast.error(data.error?.message ?? t.family.imageError); return; }
                  setLocalCoverUrl(data.data?.coverImageUrl ?? null);
                  toast.success(t.family.coverUpdated);
                  refetch();
                }}
              />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black/60 text-white backdrop-blur-sm hover:bg-black/75 transition-colors">
                <Camera className="h-3.5 w-3.5" /> {t.family.changeCover}
              </span>
            </label>
          )}

          <div className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-4 flex flex-col gap-2.5">
            {/* Badges strip — subtle overlay above family name */}
            <FamilyBadgesSection familyId={familyId} compact />

            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                    {family.name}
                  </h1>
                  <FamilyTierBadge score={family.familyScore} size="md" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground font-mono">{familyId}</span>
                  <button onClick={copyId} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {family.isChief && (
                <Link href={`/families/${familyId}/admin`}>
                  <Button size="sm" variant="outline" className="shrink-0">
                    <Settings className="h-4 w-4 mr-1" /> {t.family.manage}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <CardContent className="space-y-6">
          {/* Members strip */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{t.family.members}</h3>
            <div className="flex flex-wrap gap-4">
              {sortedMemberships.map(({ user }) => {
                const color = memberColors.get(user.id)!;
                const xp = user.reputationScore ?? 0;
                const borderColor = xp > 0 ? TIER_COLORS[getTier(xp)] : color;
                const canRemove = family.isChief && user.id !== family.chiefId;
                return (
                  <div key={user.id} className="flex flex-col items-center gap-1.5 group/member">
                    <div className="relative">
                      <Avatar className="h-12 w-12" style={{ boxShadow: `0 0 0 2px ${borderColor}` }}>
                        <AvatarImage src={user.avatarMedium} alt={user.personaName} />
                        <AvatarFallback style={{ backgroundColor: color }}>
                          {user.personaName[0]}
                        </AvatarFallback>
                      </Avatar>
                      {canRemove && (
                        <MemberActions
                          compact
                          familyId={familyId}
                          memberId={user.id}
                          memberName={user.personaName}
                          onSuccess={() => refetch()}
                        />
                      )}
                    </div>
                    <span className="text-xs max-w-[60px] truncate" style={{ color }}>
                      {user.personaName}
                    </span>
                    {user.id === family.chiefId && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{t.family.chief}</Badge>
                    )}
                    {user.id === userId && (
                      <span className="flex items-center gap-0.5 text-[10px] font-semibold tabular-nums" style={{ color: localCredits > 0 ? "hsl(258 82% 72%)" : undefined, opacity: localCredits > 0 ? 1 : 0.45 }}>
                        <Wallet className="h-2.5 w-2.5" />
                        {formatCurrency(localCredits, "BRL")}
                      </span>
                    )}
                    {(user.reputationScore ?? 0) > 0 && (
                      <ReputationBadge score={user.reputationScore!} />
                    )}
                  </div>
                );
              })}

              {/* Pending members — amber border, approve/reject */}
              {family.pendingMemberships.map(({ id: membershipId, user }) => (
                <PendingMemberAvatar
                  key={membershipId}
                  membershipId={membershipId}
                  familyId={familyId}
                  user={user}
                  onAction={() => refetch()}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* Pending join requests — rich cards (chief only) */}
          {family.isChief && family.pendingMemberships.length > 0 && (
            <div className="space-y-2">
              {family.pendingMemberships.map((pending) => (
                <PendingRequestCard
                  key={pending.id}
                  membershipId={pending.id}
                  familyId={familyId}
                  user={pending.user}
                  wishlistMatches={pending.wishlistMatches}
                  libraryExtras={pending.libraryExtras}
                  wishlistItems={family.wishlistItems}
                  feePaidAt={pending.feePaidAt}
                  feeChargedCents={pending.feeChargedCents}
                  onAction={() => refetch()}
                />
              ))}
            </div>
          )}

          {/* Total accessible games stat card — clickable mosaic */}
          {gameStats && (
            <Card
              className="border-primary/20 overflow-hidden cursor-pointer group"
              onClick={() => {
                setSteamExpanded(true);
                setTimeout(() => {
                  document.getElementById("steam-library-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 50);
              }}
            >
              <CardContent className="p-0">
                <div className="relative flex flex-col sm:flex-row items-stretch min-h-[88px]">
                  {/* Mosaic background — two rows scrolling in opposite directions */}
                  {mosaicAppIds.length > 0 && (() => {
                    const mid = Math.ceil(mosaicAppIds.length / 2);
                    const row1 = mosaicAppIds.slice(0, mid);
                    const row2 = mosaicAppIds.slice(mid);
                    const imgClass = "h-full w-[120px] shrink-0 object-cover opacity-25 group-hover:opacity-35 transition-opacity duration-300";
                    return (
                      <div className="absolute inset-0 overflow-hidden flex flex-col" aria-hidden>
                        {/* Row 1 wrapper — takes half the card height */}
                        <div className="flex-1 overflow-hidden">
                          <div className="flex h-full mosaic-row-left" style={{ width: "max-content" }}>
                            {[...row1, ...row1].map((appId, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={`https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_sm_120.jpg`} alt="" className={imgClass} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            ))}
                          </div>
                        </div>
                        {/* Row 2 wrapper — takes half the card height */}
                        <div className="flex-1 overflow-hidden">
                          <div className="flex h-full mosaic-row-right" style={{ width: "max-content" }}>
                            {[...row2, ...row2].map((appId, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={`https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_sm_120.jpg`} alt="" className={imgClass} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            ))}
                          </div>
                        </div>
                        {/* Gradient overlay */}
                        <div className="absolute inset-0" style={{
                          background: "linear-gradient(to right, hsl(var(--card)) 0%, hsl(var(--card) / 0.45) 25%, hsl(var(--card) / 0.45) 75%, hsl(var(--card)) 100%)",
                        }} />
                      </div>
                    );
                  })()}

                  {/* Left: count + label */}
                  <div className="relative flex items-center gap-4 px-6 py-5 flex-1">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "hsl(258 82% 60% / 0.18)", border: "1px solid hsl(258 82% 60% / 0.3)" }}>
                      <Library className="h-5 w-5" style={{ color: "hsl(258 82% 66%)" }} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        {gameStats.total.toLocaleString(t.dateLocale)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">{t.dashboard.totalGames}</p>
                    </div>
                  </div>

                  {/* Right: yours / via families */}
                  <div className="relative flex sm:flex-col justify-around sm:justify-center gap-0 sm:min-w-[180px] border-t sm:border-t-0 sm:border-l border-border/60 px-6 py-4 sm:py-5">
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-semibold">{gameStats.own.toLocaleString(t.dateLocale)}</span>
                      <span className="text-xs text-muted-foreground">{t.dashboard.yours}</span>
                    </div>
                    <div className="hidden sm:block h-px bg-border/60 my-2.5" />
                    <div className="flex items-center gap-2">
                      <Share2 className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(258 82% 66%)" }} />
                      <span className="text-sm font-semibold" style={{ color: "hsl(258 82% 66%)" }}>
                        {gameStats.viaFamilies.toLocaleString(t.dateLocale)}
                      </span>
                      <span className="text-xs text-muted-foreground">{t.dashboard.viaFamilies}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shared family wishlist */}
          <div id="family-wishlist">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{t.family.wishlistTitle}</h3>
              <Button size="sm" variant="outline" onClick={() => setAddGameOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> {t.family.addGame}
              </Button>
            </div>

            {/* Manual distribute banner — shown when auto-distribute is OFF and there are credits */}
            {!autoDistribute && localCredits > 0 && (
              <div className="flex items-center gap-4 p-4 mb-4 rounded-xl border border-primary/30 bg-primary/8">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-primary/15 shrink-0">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t.family.creditsAvailableStr(formatCurrency(localCredits, "BRL"))}</p>
                  <p className="text-xs text-muted-foreground">{t.family.distributeHint}</p>
                </div>
                <Button onClick={handleDistributeCredits} disabled={distributing} className="shrink-0">
                  <Wallet className="h-4 w-4 mr-2" />
                  {distributing ? t.family.distributing : t.family.distribute}
                </Button>
              </div>
            )}

            <MonthlyBudgetForm
              familyId={familyId}
              currency={family.currency}
              initialBudgetCents={family.monthlyBudgetCents}
              initialAutoDistribute={autoDistribute}
              onAutoDistributeChange={setAutoDistribute}
            />

            {(() => {
              const openItems = family.wishlistItems.filter((i) => i.status === "open" || i.status === "funded");
              const purchasedItems = family.wishlistItems.filter((i) => i.status === "purchased");
              return (
                <>
                  {openItems.length === 0 && purchasedItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {t.family.noGames}
                    </div>
                  ) : openItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {t.family.noGames}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {openItems.map((item) => (
                        <WishlistItemCard
                          key={item.id}
                          item={item}
                          familyId={familyId}
                          currentUserId={userId}
                          memberColors={memberColors}
                          onRefresh={() => refetch()}
                          ownedByCurrentUser={userOwnedAppIds.has(item.steamAppId)}
                          priceAlert={item.priceAlert}
                          priceAvgCents={item.priceAvgCents}
                          autoOpen={item.id === pledgeItemId}
                          initialPct={item.id === pledgeItemId ? pledgePct : undefined}
                          userCreditsCents={localCredits}
                        />
                      ))}
                    </div>
                  )}

                  {purchasedItems.length > 0 && (
                    <div className="mt-6 space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                        <ShoppingCart className="h-3.5 w-3.5 text-emerald-400" />
                        {t.family.purchasedGames}
                      </h4>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {purchasedItems.map((item) => (
                          <div key={item.id} className="flex-shrink-0 w-36 rounded-lg overflow-hidden border border-border/40 bg-card/60">
                            {item.steamData?.headerImage ? (
                              <img src={item.steamData.headerImage} alt={item.steamData.name} className="w-full h-[48px] object-cover opacity-80" />
                            ) : (
                              <div className="w-full h-[48px] bg-secondary" />
                            )}
                            <div className="px-2 py-1.5">
                              <p className="text-[11px] font-medium leading-tight line-clamp-1 text-muted-foreground">
                                {item.steamData?.name ?? `App #${item.steamAppId}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Votes panel */}
          <Separator />
          <div>
            <button
              onClick={() => setVotesExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold w-full text-left"
            >
              <span>{t.family.votes}</span>
              {votesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {votesExpanded && (
              <div className="mt-4">
                <VotesPanel familyId={familyId} currency={family.currency} />
              </div>
            )}
          </div>

          {/* Contributions feed */}
          {contributions.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">{t.family.contributionSummary}</h3>
                <div className="space-y-1">
                  {contributions.map(({ pledger, gameName, headerImage, steamAppId, amountCents, currency }, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-secondary/50 transition-colors group">
                      {/* Pledger avatar */}
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={pledger.avatarMedium} alt={pledger.personaName} />
                        <AvatarFallback className="text-[10px]">{pledger.personaName[0]}</AvatarFallback>
                      </Avatar>

                      {/* Name + game */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold" style={{ color: memberColors.get(pledger.id) }}>
                          {pledger.personaName}
                        </span>
                        <span className="text-sm text-muted-foreground"> · {gameName}</span>
                      </div>

                      {/* Thumbnail + amount — fixed right column so values always align */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-12 h-7">
                          {headerImage && (
                            <img
                              src={headerImage}
                              alt={gameName}
                              className="w-full h-full object-cover rounded opacity-70 group-hover:opacity-100 transition-opacity"
                            />
                          )}
                        </div>
                        <span className="text-sm font-semibold text-foreground tabular-nums w-16 text-right">
                          {formatCurrency(amountCents, currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* AI recommendations */}
          <RecommendationsSection
            familyId={familyId}
            currentUserId={userId}
            wishlistAppIds={new Set(family?.wishlistItems.filter(i => i.status !== "cancelled").map(i => i.steamAppId) ?? [])}
          />

          {/* Steam — games & unified wishlist */}
          <Separator />
          <div id="steam-library-section">
            <button
              onClick={() => setSteamExpanded((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold w-full text-left"
            >
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
              <span>{t.family.steamGames}</span>
              {steamExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {steamExpanded && (
              <div className="mt-4">
                <SteamLibraryPanel
                  familyId={familyId}
                  currentUserId={userId}
                  memberColors={memberColors}
                  sharedWishlistItems={family.wishlistItems}
                  onRefresh={refetch}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <GameSearchModal
        open={addGameOpen}
        onOpenChange={setAddGameOpen}
        onSelect={handleAddGame}
        title={t.family.addToWishlist}
        familyId={familyId}
        existingAppIds={new Set(family.wishlistItems.map((i) => i.steamAppId))}
      />
    </div>
    </div>
  );
}

function PendingRequestCard({
  membershipId, familyId, user, wishlistMatches, libraryExtras, wishlistItems, feePaidAt, feeChargedCents, onAction,
}: {
  membershipId: string;
  familyId: string;
  user: Member;
  wishlistMatches: number[] | null;
  libraryExtras: { appId: number; name: string | null }[];
  wishlistItems: WishlistItem[];
  feePaidAt: string | null;
  feeChargedCents: number | null;
  onAction: () => void;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const queryClient = useQueryClient();
  const xp = user.reputationScore ?? 0;
  const borderColor = xp > 0 ? TIER_COLORS[getTier(xp)] : "hsl(45 90% 55%)";

  const act = async (action: "approve" | "reject") => {
    setLoading(action);
    try {
      await fetch(`/api/families/${familyId}/join-requests/${membershipId}/${action}`, { method: "POST" });
      if (action === "approve") {
        await queryClient.invalidateQueries({ queryKey: ["steam-library", familyId] });
      }
      onAction();
    } finally {
      setLoading(null);
    }
  };

  const matchedItems = wishlistMatches
    ? wishlistItems.filter((item) => wishlistMatches.includes(item.steamAppId))
    : [];

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-lg bg-amber-500/8 border border-amber-500/25">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10 shrink-0 mt-0.5" style={{ boxShadow: `0 0 0 2px ${borderColor}` }}>
          <AvatarImage src={user.avatarMedium} alt={user.personaName} />
          <AvatarFallback style={{ backgroundColor: "hsl(45 90% 30%)" }}>
            {user.personaName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{user.personaName}</span>
            {xp > 0 && <ReputationBadge score={xp} />}
            {feePaidAt && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Pagou {feeChargedCents ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(feeChargedCents / 100) : ""}
              </span>
            )}
          </div>

          {/* Wishlist matches */}
          {wishlistMatches === null ? null : matchedItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">Não possui jogos da wishlist</p>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400/80">
                Possui {matchedItems.length} da wishlist
              </p>
              <TooltipPrimitive.Provider delayDuration={300}>
                <div className="flex flex-wrap gap-1.5">
                  {matchedItems.slice(0, 6).map((item) => {
                    const name = item.steamData?.name ?? `App ${item.steamAppId}`;
                    return (
                      <TooltipPrimitive.Root key={item.id}>
                        <TooltipPrimitive.Trigger asChild>
                          <div className="w-[80px] rounded-md overflow-hidden border border-amber-500/20 bg-card/60 cursor-default">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamAppId}/capsule_sm_120.jpg`} alt={name} className="w-full h-auto" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            <p className="text-[9px] leading-tight px-1 py-0.5 truncate text-foreground/80">{name}</p>
                          </div>
                        </TooltipPrimitive.Trigger>
                        <TooltipPrimitive.Portal>
                          <TooltipPrimitive.Content side="top" sideOffset={4} collisionPadding={8} className="z-50 max-w-[160px] text-[11px] bg-popover border border-border rounded px-2 py-1 shadow-md text-foreground break-words">
                            {name}
                          </TooltipPrimitive.Content>
                        </TooltipPrimitive.Portal>
                      </TooltipPrimitive.Root>
                    );
                  })}
                  {matchedItems.length > 6 && (
                    <span className="text-xs text-muted-foreground self-center">+{matchedItems.length - 6}</span>
                  )}
                </div>
              </TooltipPrimitive.Provider>
            </div>
          )}

          {/* Library extras — games they own that no family member has */}
          {libraryExtras.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Exclusivos — {libraryExtras.length} jogo{libraryExtras.length !== 1 ? "s" : ""} que a família não tem
              </p>
              <TooltipPrimitive.Provider delayDuration={300}>
                <div className="flex flex-wrap gap-1.5">
                  {libraryExtras.map(({ appId, name: rawName }) => {
                    const name = rawName ?? `App ${appId}`;
                    return (
                      <TooltipPrimitive.Root key={appId}>
                        <TooltipPrimitive.Trigger asChild>
                          <div className="w-[80px] rounded-md overflow-hidden border border-border/30 bg-card/40 cursor-default">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_sm_120.jpg`} alt={name} className="w-full h-auto opacity-70" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                            <p className="text-[9px] leading-tight px-1 py-0.5 truncate text-muted-foreground">{name}</p>
                          </div>
                        </TooltipPrimitive.Trigger>
                        <TooltipPrimitive.Portal>
                          <TooltipPrimitive.Content side="top" sideOffset={4} collisionPadding={8} className="z-50 max-w-[160px] text-[11px] bg-popover border border-border rounded px-2 py-1 shadow-md text-foreground break-words">
                            {name}
                          </TooltipPrimitive.Content>
                        </TooltipPrimitive.Portal>
                      </TooltipPrimitive.Root>
                    );
                  })}
                </div>
              </TooltipPrimitive.Provider>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => act("approve")}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/25 transition-colors disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Aprovar
        </button>
        <button
          onClick={() => act("reject")}
          disabled={!!loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-destructive/10 hover:bg-destructive/25 text-destructive border border-destructive/20 transition-colors disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Recusar
        </button>
      </div>
    </div>
  );
}

function PendingMemberAvatar({
  membershipId, familyId, user, onAction,
}: {
  membershipId: string;
  familyId: string;
  user: Member;
  onAction: () => void;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const queryClient = useQueryClient();

  const act = async (action: "approve" | "reject") => {
    setLoading(action);
    try {
      await fetch(`/api/families/${familyId}/join-requests/${membershipId}/${action}`, { method: "POST" });
      if (action === "approve") {
        // Invalidate steam library so new member's games load immediately
        await queryClient.invalidateQueries({ queryKey: ["steam-library", familyId] });
      }
      onAction();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <Avatar
          className="h-12 w-12"
          style={{ boxShadow: "0 0 0 2px hsl(45 90% 55%)" }}
        >
          <AvatarImage src={user.avatarMedium} alt={user.personaName} />
          <AvatarFallback style={{ backgroundColor: "hsl(45 90% 30%)" }}>
            {user.personaName[0]}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 border-2 border-background" />
      </div>
      <span className="text-xs max-w-[60px] truncate text-amber-400">
        {user.personaName}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => act("approve")}
          disabled={!!loading}
          title="Aprovar"
          className="h-5 w-5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center transition-colors"
        >
          <Check className="h-3 w-3 text-emerald-400" />
        </button>
        <button
          onClick={() => act("reject")}
          disabled={!!loading}
          title="Rejeitar"
          className="h-5 w-5 rounded-full bg-destructive/20 hover:bg-destructive/40 flex items-center justify-center transition-colors"
        >
          <X className="h-3 w-3 text-destructive" />
        </button>
      </div>
    </div>
  );
}

function JoinRequestScreen({ familyId }: { familyId: string }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/families/${familyId}/join-requests`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        if (json.error?.code === "ALREADY_PENDING") {
          toast.info(t.family.alreadyPending);
          setSent(true);
        } else {
          toast.error(json.error?.message ?? t.family.errorJoining);
        }
        return;
      }
      toast.success(t.family.requestSent);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-16 flex justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>{t.family.notMemberTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t.family.notMemberDesc}
          </p>
          <p className="text-xs text-muted-foreground font-mono">{familyId}</p>
          {sent ? (
            <p className="text-sm font-medium text-green-500">{t.family.requestSent}</p>
          ) : (
            <Button onClick={handleRequest} disabled={loading} className="w-full">
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? t.family.sending : t.family.requestJoin}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
