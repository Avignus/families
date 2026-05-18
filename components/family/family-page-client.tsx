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
import { Plus, ChevronDown, ChevronUp, Settings, Copy, LogIn, Gamepad2, Check, X, Camera, AlertTriangle, Library, Share2, Wallet, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { MonthlyBudgetForm } from "@/components/family/monthly-budget-form";
import { FamilyCoverArt } from "@/components/family-cover-art";
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
};

type WishlistItem = {
  id: string;
  steamAppId: number;
  targetPriceCents: number;
  currency: string;
  status: string;
  ownerUserId: string | null;
  owner: Member | null;
  totalPledgedCents: number;
  percentFunded: number;
  priceAlert: "low" | "high" | null;
  priceAvgCents: number | null;
  steamData: { appId: number; name: string; headerImage: string; priceCents: number; currency: string; isFree: boolean; comingSoon?: boolean; releaseDate?: string } | null;
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
  memberships: Array<{ user: Member }>;
  pendingMemberships: PendingMember[];
  wishlistItems: WishlistItem[];
};

export function FamilyPageClient({
  familyId,
  gameStats,
  totalPendingRequests,
  creditsCents,
  monthlyBudgetCents,
  autoDistributeEnabled,
}: {
  familyId: string;
  gameStats: { total: number; own: number; viaFamilies: number } | null;
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
  const [togglingAutoDistribute, setTogglingAutoDistribute] = useState(false);

  const handleDistributeCredits = async () => {
    setDistributing(true);
    try {
      const res = await fetch(`/api/families/${familyId}/distribute-credits`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? "Erro ao distribuir"); return; }
      if (data.data?.distributed > 0) {
        setLocalCredits((prev) => prev - data.data.distributed);
        toast.success(`${formatCurrency(data.data.distributed, "BRL")} distribuídos na família!`);
        refetch();
      } else {
        toast.info("Nenhum item disponível para contribuição no momento.");
      }
    } finally {
      setDistributing(false);
    }
  };

  const handleEnableAutoDistribute = async () => {
    setTogglingAutoDistribute(true);
    setAutoDistribute(true);
    try {
      const res = await fetch(`/api/families/${familyId}/budget`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoDistributeEnabled: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAutoDistribute(false);
        toast.error(data.error?.message ?? "Erro ao ativar redistribuição automática");
      } else {
        toast.success("Redistribuição automática ativada");
      }
    } finally {
      setTogglingAutoDistribute(false);
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

  // Settlement summary
  const settlement: Record<string, Record<string, number>> = {};
  for (const item of family.wishlistItems) {
    if (!item.ownerUserId) continue;
    for (const pledge of item.pledges) {
      if (item.status === "open" || item.status === "funded") {
        if (!settlement[pledge.pledgerUserId]) settlement[pledge.pledgerUserId] = {};
        settlement[pledge.pledgerUserId][item.ownerUserId] =
          (settlement[pledge.pledgerUserId][item.ownerUserId] ?? 0) + pledge.amountCents;
      }
    }
  }

  const memberMap = new Map(family.memberships.map((m) => [m.user.id, m.user]));

  return (
    <div className="container py-8 space-y-6">
      <Card className="overflow-hidden">
        {/* Cover art banner */}
        <div className="relative h-44 group/banner">
          <div className="absolute inset-0">
            {family.coverImageUrl ? (
              <img
                src={family.coverImageUrl}
                alt={family.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <FamilyCoverArt familyId={familyId} />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

          {/* Chief: change cover button (appears on hover) */}
          {family.isChief && (
            <label className="absolute top-3 right-3 cursor-pointer opacity-0 group-hover/banner:opacity-100 transition-opacity">
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
                  toast.success(t.family.coverUpdated);
                  refetch();
                }}
              />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black/60 text-white backdrop-blur-sm hover:bg-black/75 transition-colors">
                <Camera className="h-3.5 w-3.5" /> {t.family.changeCover}
              </span>
            </label>
          )}

          <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {family.name}
              </h1>
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

        <CardContent className="space-y-6">
          {/* Members strip */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{t.family.members}</h3>
            <div className="flex flex-wrap gap-4">
              {sortedMemberships.map(({ user }) => {
                const color = memberColors.get(user.id)!;
                const canRemove = family.isChief && user.id !== family.chiefId;
                return (
                  <div key={user.id} className="flex flex-col items-center gap-1.5 group/member">
                    <div className="relative">
                      <Avatar className="h-12 w-12" style={{ boxShadow: `0 0 0 2px ${color}` }}>
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

          {/* Pending join request banner (chief only) */}
          {family.isChief && totalPendingRequests > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: t.dashboard.pendingAlert(totalPendingRequests).replace(String(totalPendingRequests), `<strong>${totalPendingRequests}</strong>`) }} />
            </div>
          )}

          {/* Total accessible games stat card */}
          {gameStats && (
            <Card className="border-primary/20 overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row items-stretch">
                  <div className="flex items-center gap-4 px-6 py-5 flex-1"
                    style={{ background: "linear-gradient(135deg, hsl(258 82% 60% / 0.12), hsl(258 82% 60% / 0.04))" }}>
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
                  <div className="flex sm:flex-col justify-around sm:justify-center gap-0 sm:min-w-[180px] border-t sm:border-t-0 sm:border-l border-border/60 px-6 py-4 sm:py-5 bg-card/40">
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
                  <p className="text-sm font-semibold">{formatCurrency(localCredits, "BRL")} disponíveis</p>
                  <p className="text-xs text-muted-foreground">Distribua seus créditos entre os jogos da wishlist</p>
                </div>
                <Button onClick={handleDistributeCredits} disabled={distributing} className="shrink-0">
                  <Wallet className="h-4 w-4 mr-2" />
                  {distributing ? "Distribuindo…" : "Distribuir"}
                </Button>
              </div>
            )}

            {/* Auto-distribute form — only when enabled */}
            {autoDistribute ? (
              <MonthlyBudgetForm
                familyId={familyId}
                currency={family.currency}
                initialBudgetCents={family.monthlyBudgetCents}
                initialAutoDistribute={autoDistribute}
                onAutoDistributeChange={setAutoDistribute}
              />
            ) : family.isChief && (
              <div className="flex items-center justify-between p-3 mb-4 rounded-lg border border-border/50 bg-secondary/30">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium">Redistribuição automática</p>
                    <p className="text-[10px] text-muted-foreground">Ativar para distribuir créditos automaticamente ao receber</p>
                  </div>
                </div>
                <Switch
                  checked={false}
                  onCheckedChange={handleEnableAutoDistribute}
                  disabled={togglingAutoDistribute}
                  aria-label="Ativar redistribuição automática"
                />
              </div>
            )}

            {family.wishlistItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {t.family.noGames}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {family.wishlistItems.map((item) => (
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
                  />
                ))}
              </div>
            )}
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

          {/* Settlement table */}
          {Object.keys(settlement).length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">{t.family.contributionSummary}</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(settlement).map(([pledgerId, owed]) =>
                    Object.entries(owed).map(([ownerId, cents]) => {
                      const pledger = memberMap.get(pledgerId);
                      const owner = memberMap.get(ownerId);
                      if (!pledger || !owner) return null;
                      return (
                        <div key={`${pledgerId}-${ownerId}`} className="flex justify-between text-muted-foreground">
                          <span>
                            <span style={{ color: memberColors.get(pledgerId) }}>{pledger.personaName}</span>
                            {" "}{t.family.owes}{" "}
                            <span style={{ color: memberColors.get(ownerId) }}>{owner.personaName}</span>
                          </span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(cents, family.currency)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {t.family.appDisclaimer}
                </p>
              </div>
            </>
          )}

          {/* Steam — games & unified wishlist */}
          <Separator />
          <div>
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
