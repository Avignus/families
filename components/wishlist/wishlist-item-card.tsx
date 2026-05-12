"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, getMemberColor } from "@/lib/utils";
import { PledgeModal } from "./pledge-modal";
import { ShoppingCart, Minus } from "lucide-react";
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

  const priceChanged =
    item.steamData &&
    !item.steamData.isFree &&
    Math.abs(item.steamData.priceCents - item.targetPriceCents) / item.targetPriceCents > 0.05;

  const handleMarkPurchased = async () => {
    const res = await fetch(`/api/wishlist/${item.id}/purchased`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error?.message ?? "Erro");
      return;
    }
    toast.success("Jogo marcado como comprado!");
    onRefresh();
  };

  const handleWithdrawPledge = async (pledgeId: string) => {
    const res = await fetch(`/api/pledges/${pledgeId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error?.message ?? "Erro");
      return;
    }
    toast.success("Contribuição cancelada");
    onRefresh();
  };

  const statusColors: Record<string, string> = {
    open: "secondary",
    funded: "default",
    purchased: "outline",
    cancelled: "destructive",
  };

  const statusLabels: Record<string, string> = {
    open: "Aberto",
    funded: "Financiado!",
    purchased: "Comprado",
    cancelled: "Cancelado",
  };

  return (
    <Card className="overflow-hidden">
      {item.steamData?.headerImage && (
        <div className="relative">
          <img
            src={item.steamData.headerImage}
            alt={gameName}
            className="w-full h-32 object-cover"
          />
          <div className="absolute top-2 right-2">
            <Badge variant={statusColors[item.status] as "default" | "secondary" | "outline" | "destructive"}>
              {statusLabels[item.status] ?? item.status}
            </Badge>
          </div>
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold truncate">{gameName}</h3>
          <p className="text-sm text-muted-foreground">
            {item.steamData?.isFree ? "Gratuito" : formatCurrency(item.targetPriceCents, item.currency)}
          </p>
        </div>

        {priceChanged && (
          <div className="text-xs text-amber-400 bg-amber-400/10 rounded px-2 py-1">
            Preço na Steam: {formatCurrency(item.steamData!.priceCents, item.currency)} —
            meta atual: {formatCurrency(item.targetPriceCents, item.currency)}
          </div>
        )}

        {!item.steamData?.isFree && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {formatCurrency(item.totalPledgedCents, item.currency)} / {formatCurrency(item.targetPriceCents, item.currency)}
              </span>
              <span className="font-medium text-foreground">{item.percentFunded}%</span>
            </div>
            <Progress value={item.percentFunded} className="h-2" />

            {/* Pledge breakdown */}
            {item.pledges.length > 0 && (
              <div className="space-y-1 pt-1">
                {item.pledges.map((pledge, i) => {
                  const color = memberColors.get(pledge.pledgerUserId) ?? getMemberColor(i);
                  const isMyPledge = pledge.pledgerUserId === currentUserId;
                  return (
                    <div key={pledge.id} className="flex items-center gap-2 text-xs">
                      <Avatar className="h-5 w-5 flex-shrink-0">
                        <AvatarImage src={pledge.pledger.avatarMedium} />
                        <AvatarFallback style={{ backgroundColor: color }}>
                          {pledge.pledger.personaName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span style={{ color }} className="font-medium">
                        {pledge.pledger.personaName}
                      </span>
                      <span className="text-muted-foreground flex-1">
                        {formatCurrency(pledge.amountCents, item.currency)} ({pledge.percent}%)
                      </span>
                      {isMyPledge && item.status === "open" && (
                        <button
                          onClick={() => handleWithdrawPledge(pledge.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
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

        <div className="flex gap-2 pt-1">
          {!isOwner && item.status === "open" && remaining > 0 && (
            <Button size="sm" className="flex-1" onClick={() => setPledgeOpen(true)}>
              Contribuir
            </Button>
          )}
          {(isOwner || item.status === "funded") && item.status === "funded" && (
            <Button size="sm" variant="outline" className="flex-1" onClick={handleMarkPurchased}>
              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
              Marcar como Comprado
            </Button>
          )}
        </div>
      </CardContent>

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
    </Card>
  );
}
