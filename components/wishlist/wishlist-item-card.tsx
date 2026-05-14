"use client";

import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCurrency, getMemberColor } from "@/lib/utils";
import { PledgeModal } from "./pledge-modal";
import { ShoppingCart, Minus, X, Sparkles, RefreshCw, Clock, PackageOpen, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  currentUserId: string;
  memberColors: Map<string, string>;
  onRefresh: () => void;
  ownedByCurrentUser?: boolean;
  priceAlert?: "low" | "high" | null;
  priceAvgCents?: number | null;
};

export function WishlistItemCard({ item, currentUserId, memberColors, onRefresh, ownedByCurrentUser = false, priceAlert, priceAvgCents }: Props) {
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  const isOwner = item.ownerUserId === currentUserId;
  const remaining = item.targetPriceCents - item.totalPledgedCents;
  const gameName = item.steamData?.name ?? `App #${item.steamAppId}`;
  const isFunded = item.status === "funded";
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
    toast.success("Jogo marcado como comprado!");
    onRefresh();
  };

  const handleUpdatePrice = async () => {
    const res = await fetch(`/api/wishlist/${item.id}`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error?.message ?? "Preço ainda indisponível na Steam"); return; }
    toast.success(`Preço atualizado: ${formatCurrency(data.data.targetPriceCents, item.currency)}`);
    onRefresh();
  };

  const handleWithdrawPledge = async (pledgeId: string) => {
    const res = await fetch(`/api/pledges/${pledgeId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error?.message ?? "Erro"); return; }
    toast.success("Contribuição cancelada");
    onRefresh();
  };

  const handleRemovePledge = async (pledgeId: string) => {
    const res = await fetch(`/api/pledges/${pledgeId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error?.message ?? "Erro"); return; }
    toast.success("Contribuição removida");
    onRefresh();
  };

  const handleRemoveItem = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/wishlist/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? "Erro ao remover"); return; }
      toast.success(`${gameName} removido da lista`);
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
            <span className="text-muted-foreground text-xs">Sem imagem</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

        {/* Badges top-right — status stacked */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {isFunded && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold funded-pulse"
              style={{ background: "hsl(258 82% 66% / 0.9)", color: "white" }}>
              <Sparkles className="h-3 w-3" /> Financiado
            </span>
          )}
          {isPurchased && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/80 text-white">
              <ShoppingCart className="h-3 w-3" /> Comprado
            </span>
          )}
          {comingSoon && !isFunded && !isPurchased && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-600/85 text-white">
              <Clock className="h-3 w-3" />
              Em breve
              {item.steamData?.releaseDate && item.steamData.releaseDate !== "Em breve" ? ` · ${item.steamData.releaseDate}` : ""}
            </span>
          )}
          {noPriceDefined && !comingSoon && !isFunded && !isPurchased && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-600/85 text-zinc-300">
              <PackageOpen className="h-3 w-3" /> Sem preço
            </span>
          )}
          {ownedByCurrentUser && !isPurchased && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-600/85 text-white">
              <CheckCircle2 className="h-3 w-3" /> Você já tem
            </span>
          )}
          {priceAlert === "low" && !isFunded && !isPurchased && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-500/90 text-white"
              title={priceAvgCents ? `Média histórica: ${formatCurrency(priceAvgCents, item.currency)}` : undefined}
            >
              🔥 Mínimo histórico
            </span>
          )}
          {priceAlert === "high" && !isFunded && !isPurchased && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-500/80 text-zinc-200"
              title={priceAvgCents ? `Média histórica: ${formatCurrency(priceAvgCents, item.currency)}` : undefined}
            >
              ⚠️ Acima da média
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
                ? "Gratuito"
                : noPriceDefined
                ? "Preço a definir"
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
                  {item.owner.id === currentUserId ? "você" : item.owner.personaName}
                </span>
              </div>
            )}
          </div>
        </div>

        {!item.steamData?.isFree && !noPriceDefined && (
          <div className="space-y-2">
            {/* Stats row */}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {formatCurrency(item.totalPledgedCents, item.currency)}
                <span className="text-muted-foreground/50"> / {formatCurrency(item.targetPriceCents, item.currency)}</span>
                {priceChanged && (
                  <span className="ml-1 text-amber-400/80" title={`Alvo registrado: ${formatCurrency(item.targetPriceCents, item.currency)}`}>
                    ↑
                  </span>
                )}
              </span>
              <span
                className="font-bold tabular-nums"
                style={{ color: isFunded ? "hsl(258 82% 72%)" : "hsl(214 30% 92%)" }}
              >
                {item.percentFunded}%
              </span>
            </div>

            {/* Segmented progress bar */}
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden flex">
              {item.pledges.map((pledge, i) => {
                const color = memberColors.get(pledge.pledgerUserId) ?? getMemberColor(i);
                const width = (pledge.amountCents / item.targetPriceCents) * 100;
                return (
                  <div
                    key={pledge.id}
                    className="pledge-segment h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${width}%`, backgroundColor: color, minWidth: width > 0 ? 2 : 0 }}
                    title={`${pledge.pledger.personaName}: ${formatCurrency(pledge.amountCents, item.currency)}`}
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
                      <span className="text-muted-foreground flex-1 text-right tabular-nums">
                        {formatCurrency(pledge.amountCents, item.currency)}
                        <span className="text-muted-foreground/60"> ({pledge.percent}%)</span>
                      </span>
                      {isMyPledge && (item.status === "open" || item.status === "funded") && (
                        <button
                          onClick={() => handleWithdrawPledge(pledge.id)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors ml-0.5"
                          title="Cancelar minha contribuição"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      )}
                      {!isMyPledge && isOwner && (item.status === "open" || item.status === "funded") && (
                        <button
                          onClick={() => handleRemovePledge(pledge.id)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors ml-0.5"
                          title="Remover contribuição"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
              Atualizar preço da Steam
            </button>
          )}
          {item.status === "open" && remaining > 0 && !ownedByCurrentUser && (
            <button
              onClick={() => setPledgeOpen(true)}
              className="flex-1 h-8 rounded-md text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))",
                boxShadow: "0 0 12px hsl(258 82% 66% / 0.2)",
              }}
            >
              Contribuir
            </button>
          )}
          {item.status === "open" && remaining > 0 && ownedByCurrentUser && (
            <div className="flex-1 h-8 rounded-md text-xs font-medium border border-emerald-500/30 text-emerald-400/70 flex items-center justify-center gap-1.5 cursor-default select-none">
              <CheckCircle2 className="h-3 w-3" />
              Você já tem este jogo
            </div>
          )}
          {isFunded && isOwner && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={handleMarkPurchased}
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              Marcar como Comprado
            </Button>
          )}
          {isOwner && !isPurchased && (
            removeConfirm ? (
              <div className="flex gap-1">
                <button
                  onClick={handleRemoveItem}
                  disabled={removing}
                  className="h-8 px-2.5 rounded-md text-xs font-semibold bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/30 transition-colors"
                >
                  {removing ? "…" : "Confirmar"}
                </button>
                <button
                  onClick={() => setRemoveConfirm(false)}
                  className="h-8 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground border border-border/40 hover:border-border transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setRemoveConfirm(true)}
                className="h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-colors"
                title="Remover da lista"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )
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
      />
    </div>
  );
}
