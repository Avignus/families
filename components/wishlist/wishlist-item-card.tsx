"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCurrency, getMemberColor } from "@/lib/utils";
import { PledgeModal } from "./pledge-modal";
import { ShoppingCart, Minus, X, Sparkles, RefreshCw, Clock, PackageOpen, CheckCircle2, Trash2, Link2, Copy, Check, Receipt, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n/context";

type Pledger = {
  id: string;
  personaName: string;
  avatarUrl: string;
  avatarMedium: string;
};

type PledgeData = {
  id: string;
  pledgerUserId: string;
  amountCents: number;
  percent: number;
  paidAt: string | null;
  pledger: Pledger;
};

type SteamData = {
  appId: number;
  name: string;
  headerImage: string;
  priceCents: number;
  currency: string;
  isFree: boolean;
  comingSoon?: boolean;
  releaseDate?: string;
};

type Props = {
  item: {
    id: string;
    steamAppId: number;
    targetPriceCents: number;
    currency: string;
    status: string;
    ownerUserId: string | null;
    owner: { id: string; personaName: string; avatarUrl: string; avatarMedium: string } | null;
    totalPledgedCents: number;
    percentFunded: number;
    steamData: SteamData | null;
    pledges: PledgeData[];
  };
  familyId: string;
  currentUserId: string;
  memberColors: Map<string, string>;
  onRefresh: () => void;
  ownedByCurrentUser?: boolean;
  priceAlert?: "low" | "high" | null;
  priceAvgCents?: number | null;
  autoOpen?: boolean;
  initialPct?: number;
};

export function WishlistItemCard({ item, familyId, currentUserId, memberColors, onRefresh, ownedByCurrentUser = false, priceAlert, priceAvgCents, autoOpen = false, initialPct }: Props) {
  const { t } = useLanguage();
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePct, setSharePct] = useState<number>(50);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const autoOpenFired = useRef(false);

  const initialAmountCents = initialPct && item.targetPriceCents
    ? Math.round((initialPct / 100) * item.targetPriceCents)
    : undefined;

  useEffect(() => {
    if (autoOpen && !autoOpenFired.current && item.status === "open") {
      autoOpenFired.current = true;
      setPledgeOpen(true);
    }
  }, [autoOpen, item.status]);

  const buildShareUrl = (pct: number) => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/families/${familyId}?pledge=${item.id}&pct=${pct}`;
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(buildShareUrl(sharePct));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOwner = item.ownerUserId === currentUserId;
  const remaining = item.targetPriceCents - item.totalPledgedCents;
  const gameName = item.steamData?.name ?? `App #${item.steamAppId}`;
  const isFunded = item.status === "funded";

  const paidPledges = item.pledges.filter((p) => p.paidAt !== null);
  const pendingPledges = item.pledges.filter((p) => p.paidAt === null);
  const paidPledgedCents = paidPledges.reduce((s, p) => s + p.amountCents, 0);
  const paidPercent = item.targetPriceCents > 0 ? Math.round((paidPledgedCents / item.targetPriceCents) * 100) : 0;
  const isPurchased = item.status === "purchased";
  const comingSoon = item.steamData?.comingSoon ?? false;
  const noPriceDefined = !item.steamData?.isFree && item.targetPriceCents === 0;

  const priceChanged =
    item.steamData &&
    !item.steamData.isFree &&
    item.targetPriceCents > 0 &&
    Math.abs(item.steamData.priceCents - item.targetPriceCents) / item.targetPriceCents > 0.05;

  const handleMarkPurchased = async () => {
    const res = await fetch(`/api/wishlist/${item.id}/purchased`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error?.message ?? "Erro"); return; }
    toast.success(t.wishlist.gamePurchased);
    onRefresh();
  };

  const handleUpdatePrice = async () => {
    const res = await fetch(`/api/wishlist/${item.id}`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error?.message ?? t.wishlist.priceUnavailable); return; }
    toast.success(t.wishlist.priceUpdated(formatCurrency(data.data.targetPriceCents, item.currency)));
    onRefresh();
  };

  const handleWithdrawPledge = async (pledgeId: string) => {
    const res = await fetch(`/api/pledges/${pledgeId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error?.message ?? "Erro"); return; }
    toast.success(t.wishlist.contributionCancelled);
    onRefresh();
  };

  const handleRemovePledge = async (pledgeId: string) => {
    const res = await fetch(`/api/pledges/${pledgeId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error?.message ?? "Erro"); return; }
    toast.success(t.wishlist.contributionRemoved);
    onRefresh();
  };

  const handleRemoveItem = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/wishlist/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? "Erro ao remover"); return; }
      toast.success(t.wishlist.gameRemoved(gameName));
      onRefresh();
    } finally {
      setRemoving(false);
      setRemoveConfirm(false);
    }
  };

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border transition-all duration-200 hover:border-primary/40 hover:shadow-[0_4px_20px_hsl(0_0%_0%/0.35)] ${
        isFunded
          ? "border-primary/50 bg-card"
          : isPurchased
          ? "border-border/40 bg-card/60 opacity-75"
          : "border-border/50 bg-card"
      }`}
      style={isFunded ? { boxShadow: "0 0 20px hsl(258 82% 66% / 0.15)" } : undefined}
    >
      {/* Game header image */}
      <div className="relative h-[108px]">
        {item.steamData?.headerImage ? (
          <img
            src={item.steamData.headerImage}
            alt={gameName}
            className={`w-full h-full object-cover transition-all duration-300 group-hover:brightness-110 group-hover:saturate-[1.1] ${comingSoon ? "opacity-80" : ""}`}
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <span className="text-muted-foreground text-xs">{t.wishlist.noImage}</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

        {/* Remove button — top-left, owner only, visible on card hover */}
        {isOwner && !isPurchased && (
          <div className="absolute top-2 left-2">
            {removeConfirm ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRemoveItem}
                  disabled={removing}
                  className="h-7 px-2 rounded-md text-[11px] font-semibold bg-destructive text-white hover:bg-destructive/90 transition-colors shadow-md"
                >
                  {removing ? "…" : t.wishlist.remove}
                </button>
                <button
                  onClick={() => setRemoveConfirm(false)}
                  className="h-7 w-7 rounded-md flex items-center justify-center bg-black/50 text-white/80 hover:bg-black/70 transition-colors shadow-md"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setRemoveConfirm(true)}
                className="h-7 w-7 rounded-md flex items-center justify-center bg-black/40 text-white/60 hover:bg-black/70 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-150 shadow-md backdrop-blur-sm"
                title={t.wishlist.removeTitle}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Badges top-right — status stacked */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {isFunded && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold funded-pulse"
              style={{ background: "hsl(258 82% 66% / 0.9)", color: "white" }}>
              <Sparkles className="h-3 w-3" /> {t.wishlist.funded}
            </span>
          )}
          {isPurchased && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/80 text-white">
              <ShoppingCart className="h-3 w-3" /> {t.wishlist.purchased}
            </span>
          )}
          {comingSoon && !isFunded && !isPurchased && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-600/85 text-white">
              <Clock className="h-3 w-3" />
              {t.wishlist.comingSoon}
              {item.steamData?.releaseDate && item.steamData.releaseDate !== "Em breve" ? ` · ${item.steamData.releaseDate}` : ""}
            </span>
          )}
          {noPriceDefined && !comingSoon && !isFunded && !isPurchased && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-600/85 text-zinc-300">
              <PackageOpen className="h-3 w-3" /> {t.wishlist.noPrice}
            </span>
          )}
          {ownedByCurrentUser && !isPurchased && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600/85 text-white">
              <CheckCircle2 className="h-3 w-3" /> {t.wishlist.youOwn}
            </span>
          )}
          {priceAlert === "low" && !isFunded && !isPurchased && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/90 text-white"
              title={priceAvgCents ? `Média histórica: ${formatCurrency(priceAvgCents, item.currency)}` : undefined}
            >
              {t.wishlist.historicLow}
            </span>
          )}
          {priceAlert === "high" && !isFunded && !isPurchased && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-500/80 text-zinc-200"
              title={priceAvgCents ? `Média histórica: ${formatCurrency(priceAvgCents, item.currency)}` : undefined}
            >
              {t.wishlist.aboveAverage}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 space-y-3">
        <div>
          <h3 className="font-semibold text-sm leading-tight truncate" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {gameName}
          </h3>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-muted-foreground">
              {item.steamData?.isFree
                ? t.wishlist.free
                : noPriceDefined
                ? t.wishlist.priceToSet
                : formatCurrency(item.steamData?.priceCents ?? item.targetPriceCents, item.currency)}
            </p>
            {item.owner && (
              <div className="flex items-center gap-1">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={item.owner.avatarMedium} />
                  <AvatarFallback style={{ backgroundColor: memberColors.get(item.owner.id), fontSize: 8 }}>
                    {item.owner.personaName[0]}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="text-[10px] max-w-[60px] truncate"
                  style={{ color: memberColors.get(item.owner.id) }}
                >
                  {item.owner.id === currentUserId ? t.wishlist.you : item.owner.personaName}
                </span>
              </div>
            )}
          </div>
        </div>

        {!item.steamData?.isFree && !noPriceDefined && (
          <div className="space-y-2">
            {/* Stats row — only confirmed (paid) amounts */}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {formatCurrency(paidPledgedCents, item.currency)}
                <span className="text-muted-foreground/50"> / {formatCurrency(item.targetPriceCents, item.currency)}</span>
                {priceChanged && (
                  <span className="ml-1 text-amber-400/80" title={`Alvo registrado: ${formatCurrency(item.targetPriceCents, item.currency)}`}>
                    ↑
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1.5">
                {pendingPledges.length > 0 && (
                  <span className="text-amber-400/70 flex items-center gap-0.5 tabular-nums">
                    <Clock className="h-2.5 w-2.5" />
                    +{formatCurrency(pendingPledges.reduce((s, p) => s + p.amountCents, 0), item.currency)}
                  </span>
                )}
                <span
                  className="font-bold tabular-nums"
                  style={{ color: isFunded ? "hsl(258 82% 72%)" : "hsl(214 30% 92%)" }}
                >
                  {paidPercent}%
                </span>
              </div>
            </div>

            {/* Segmented progress bar — paid solid, pending muted */}
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden flex">
              {paidPledges.map((pledge, i) => {
                const color = memberColors.get(pledge.pledgerUserId) ?? getMemberColor(i);
                const width = (pledge.amountCents / item.targetPriceCents) * 100;
                return (
                  <div
                    key={pledge.id}
                    className="h-full"
                    style={{ width: `${width}%`, backgroundColor: color, minWidth: width > 0 ? 2 : 0 }}
                    title={`${pledge.pledger.personaName}: ${formatCurrency(pledge.amountCents, item.currency)}`}
                  />
                );
              })}
              {pendingPledges.map((pledge, i) => {
                const color = memberColors.get(pledge.pledgerUserId) ?? getMemberColor(i);
                const width = (pledge.amountCents / item.targetPriceCents) * 100;
                return (
                  <div
                    key={pledge.id}
                    className="h-full"
                    style={{ width: `${width}%`, backgroundColor: color, opacity: 0.3, minWidth: width > 0 ? 2 : 0 }}
                    title={`${pledge.pledger.personaName} (pendente): ${formatCurrency(pledge.amountCents, item.currency)}`}
                  />
                );
              })}
            </div>

            {/* Pledge breakdown */}
            {item.pledges.length > 0 && (
              <div className="space-y-1.5 pt-0.5">
                {item.pledges.map((pledge, i) => {
                  const color = memberColors.get(pledge.pledgerUserId) ?? getMemberColor(i);
                  const isMyPledge = pledge.pledgerUserId === currentUserId;
                  return (
                    <div key={pledge.id} className={`flex items-center gap-1.5 text-xs ${!pledge.paidAt ? "opacity-60" : ""}`}>
                      <Avatar className="h-4 w-4 flex-shrink-0">
                        <AvatarImage src={pledge.pledger.avatarMedium} />
                        <AvatarFallback style={{ backgroundColor: color, fontSize: 8 }}>
                          {pledge.pledger.personaName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span style={{ color }} className="font-medium truncate max-w-[70px]">
                        {pledge.pledger.personaName}
                      </span>
                      <span className="text-muted-foreground flex-1 text-right tabular-nums">
                        {formatCurrency(pledge.amountCents, item.currency)}
                        <span className="text-muted-foreground/60"> ({pledge.percent}%)</span>
                      </span>
                      {!pledge.paidAt && (
                        <span title="Pagamento pendente"><Clock className="h-2.5 w-2.5 text-amber-400/70 flex-shrink-0" /></span>
                      )}
                      {isMyPledge && (item.status === "open" || item.status === "funded") && (
                        <button
                          onClick={() => handleWithdrawPledge(pledge.id)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors ml-0.5"
                          title={t.wishlist.cancelContribution}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      )}
                      {!isMyPledge && isOwner && (item.status === "open" || item.status === "funded") && (
                        <button
                          onClick={() => handleRemovePledge(pledge.id)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors ml-0.5"
                          title={t.wishlist.removeContribution}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Payment history toggle */}
            {paidPledges.length > 0 && (
              <div>
                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mt-1"
                >
                  <Receipt className="h-2.5 w-2.5" />
                  {historyOpen ? "Ocultar histórico" : `Histórico (${paidPledges.length})`}
                  {historyOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                </button>
                {historyOpen && (
                  <div className="mt-1.5 rounded-lg border border-border/40 bg-secondary/30 p-2 space-y-1.5">
                    {paidPledges.map((pledge, i) => {
                      const color = memberColors.get(pledge.pledgerUserId) ?? getMemberColor(i);
                      return (
                        <div key={pledge.id} className="flex items-center gap-1.5 text-xs">
                          <Avatar className="h-4 w-4 flex-shrink-0">
                            <AvatarImage src={pledge.pledger.avatarMedium} />
                            <AvatarFallback style={{ backgroundColor: color, fontSize: 8 }}>
                              {pledge.pledger.personaName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span style={{ color }} className="font-medium truncate max-w-[70px]">
                            {pledge.pledger.personaName}
                          </span>
                          <span className="text-muted-foreground tabular-nums flex-1 text-right">
                            {formatCurrency(pledge.amountCents, item.currency)}
                          </span>
                          <span className="text-muted-foreground/50 text-[10px] tabular-nums whitespace-nowrap">
                            {new Date(pledge.paidAt!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Share popover */}
        {shareOpen && item.status === "open" && !item.steamData?.isFree && !ownedByCurrentUser && (
          <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 space-y-2.5 text-xs">
            <p className="font-medium text-foreground/80">{t.wishlist.requestContribution}</p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={100}
                value={sharePct}
                onChange={(e) => setSharePct(Number(e.target.value))}
                className="flex-1 accent-primary h-1.5"
              />
              <span className="w-8 text-right font-semibold tabular-nums">{sharePct}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {formatCurrency(Math.round((sharePct / 100) * item.targetPriceCents), item.currency)}
              </span>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-primary/15 hover:bg-primary/25 text-primary transition-colors"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? t.wishlist.copied : t.wishlist.copyLink}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-0.5">
          {item.status === "open" && noPriceDefined && isOwner && (
            <button
              onClick={handleUpdatePrice}
              className="flex-1 h-8 rounded-md text-xs font-semibold border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              {t.wishlist.updatePrice}
            </button>
          )}
          {item.status === "open" && remaining > 0 && (
            <button
              onClick={() => setPledgeOpen(true)}
              className="flex-1 h-8 rounded-md text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))",
                boxShadow: "0 0 12px hsl(258 82% 66% / 0.2)",
              }}
            >
              {t.wishlist.contribute}
            </button>
          )}
          {item.status === "open" && !item.steamData?.isFree && (
            <button
              onClick={() => setShareOpen((v) => !v)}
              className={`h-8 w-8 rounded-md flex items-center justify-center border transition-colors ${
                shareOpen
                  ? "border-primary/40 text-primary bg-primary/10"
                  : "border-transparent text-muted-foreground/50 hover:text-primary hover:border-primary/20 hover:bg-primary/5"
              }`}
              title={t.wishlist.requestContribution}
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          )}
          {isFunded && isOwner && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={handleMarkPurchased}
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              {t.wishlist.markPurchased}
            </Button>
          )}
        </div>
      </div>

      <PledgeModal
        open={pledgeOpen}
        onOpenChange={setPledgeOpen}
        itemId={item.id}
        gameName={gameName}
        targetPriceCents={item.targetPriceCents}
        totalPledgedCents={item.totalPledgedCents}
        currency={item.currency}
        onSuccess={onRefresh}
        initialAmountCents={initialAmountCents}
      />
    </div>
  );
}
