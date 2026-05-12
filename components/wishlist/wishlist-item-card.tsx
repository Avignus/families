"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCurrency, getMemberColor } from "@/lib/utils";
import { PledgeModal } from "./pledge-modal";
import { ShoppingCart, Minus, Sparkles } from "lucide-react";
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
};

export function WishlistItemCard({ item, currentUserId, memberColors, onRefresh }: Props) {
  const [pledgeOpen, setPledgeOpen] = useState(false);

  const isOwner = item.ownerUserId === currentUserId;
  const remaining = item.targetPriceCents - item.totalPledgedCents;
  const gameName = item.steamData?.name ?? `App #${item.steamAppId}`;
  const isFunded = item.status === "funded";
  const isPurchased = item.status === "purchased";

  const priceChanged =
    item.steamData &&
    !item.steamData.isFree &&
    Math.abs(item.steamData.priceCents - item.targetPriceCents) / item.targetPriceCents > 0.05;

  const handleMarkPurchased = async () => {
    const res = await fetch(`/api/wishlist/${item.id}/purchased`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error?.message ?? "Erro"); return; }
    toast.success("Jogo marcado como comprado!");
    onRefresh();
  };

  const handleWithdrawPledge = async (pledgeId: string) => {
    const res = await fetch(`/api/pledges/${pledgeId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error?.message ?? "Erro"); return; }
    toast.success("Contribuição cancelada");
    onRefresh();
  };

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 ${
        isFunded
          ? "border-primary/50 bg-card"
          : isPurchased
          ? "border-border/40 bg-card/60 opacity-75"
          : "border-border/50 bg-card"
      }`}
      style={isFunded ? { boxShadow: "0 0 20px hsl(258 82% 66% / 0.15)" } : undefined}
    >
      {/* Game header image */}
      <div className="relative overflow-hidden h-[108px]">
        {item.steamData?.headerImage ? (
          <img
            src={item.steamData.headerImage}
            alt={gameName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center">
            <span className="text-muted-foreground text-xs">Sem imagem</span>
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-2 right-2">
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
              {item.steamData?.isFree ? "Gratuito" : formatCurrency(item.targetPriceCents, item.currency)}
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

        {priceChanged && (
          <div className="text-[11px] text-amber-400/90 bg-amber-400/8 border border-amber-400/20 rounded-md px-2 py-1.5">
            Preço atual na Steam: <strong>{formatCurrency(item.steamData!.priceCents, item.currency)}</strong>
          </div>
        )}

        {!item.steamData?.isFree && (
          <div className="space-y-2">
            {/* Stats row */}
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {formatCurrency(item.totalPledgedCents, item.currency)}
                <span className="text-muted-foreground/50"> / {formatCurrency(item.targetPriceCents, item.currency)}</span>
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
                      {isMyPledge && item.status === "open" && (
                        <button
                          onClick={() => handleWithdrawPledge(pledge.id)}
                          className="text-muted-foreground/50 hover:text-destructive transition-colors ml-0.5"
                          title="Cancelar contribuição"
                        >
                          <Minus className="h-3 w-3" />
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
          {item.status === "open" && remaining > 0 && (
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
          {isFunded && (isOwner) && (
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
