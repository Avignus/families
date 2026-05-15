"use client";

import { formatCurrency } from "@/lib/utils";
import { ShoppingCart, Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

type Props = {
  item: {
    id: string;
    steamAppId: number;
    targetPriceCents: number;
    currency: string;
    status: string;
    pledgedCents: number;
    percent: number;
    steam: {
      name: string;
      headerImage: string;
      priceCents: number;
      isFree: boolean;
    } | null;
    owner: {
      personaName: string;
      avatarMedium: string;
    } | null;
  };
};

export function CatalogWishlistItem({ item }: Props) {
  const { t } = useLanguage();
  const isFunded = item.status === "funded";
  const isPurchased = item.status === "purchased";
  const gameName = item.steam?.name ?? `App #${item.steamAppId}`;

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border transition-colors ${
        isFunded
          ? "border-primary/50 bg-card"
          : isPurchased
          ? "border-border/40 bg-card/60 opacity-75"
          : "border-border/50 bg-card"
      }`}
      style={isFunded ? { boxShadow: "0 0 20px hsl(258 82% 66% / 0.15)" } : undefined}
    >
      {/* Header image */}
      <div className="relative h-[108px] bg-secondary">
        {item.steam?.headerImage ? (
          <img
            src={item.steam.headerImage}
            alt={gameName}
            className="w-full h-full object-cover transition-all duration-300 group-hover:brightness-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-muted-foreground text-xs">{t.catalogWishlistItem.noImage}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

        <div className="absolute top-2 right-2">
          {isFunded && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: "hsl(258 82% 66% / 0.9)", color: "white" }}
            >
              <Sparkles className="h-3 w-3" /> {t.catalogWishlistItem.funded}
            </span>
          )}
          {isPurchased && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/80 text-white">
              <ShoppingCart className="h-3 w-3" /> {t.catalogWishlistItem.purchased}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 space-y-3">
        <div>
          <h3
            className="font-semibold text-sm leading-tight truncate"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            {gameName}
          </h3>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-muted-foreground">
              {item.steam?.isFree ? t.catalogWishlistItem.free : formatCurrency(item.targetPriceCents, item.currency)}
            </p>
            {item.owner && (
              <div className="flex items-center gap-1">
                <img
                  src={item.owner.avatarMedium}
                  alt={item.owner.personaName}
                  className="h-4 w-4 rounded-full"
                />
                <span className="text-[10px] max-w-[60px] truncate text-muted-foreground">
                  {item.owner.personaName}
                </span>
              </div>
            )}
          </div>
        </div>

        {!item.steam?.isFree && item.targetPriceCents > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {formatCurrency(item.pledgedCents, item.currency)}
                <span className="text-muted-foreground/50">
                  {" "}/ {formatCurrency(item.targetPriceCents, item.currency)}
                </span>
              </span>
              <span
                className="font-bold tabular-nums"
                style={{ color: isFunded ? "hsl(258 82% 72%)" : "hsl(214 30% 92%)" }}
              >
                {item.percent}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, item.percent)}%`,
                  background: isFunded
                    ? "hsl(258 82% 66%)"
                    : "linear-gradient(90deg, hsl(258 82% 55%), hsl(258 82% 66%))",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
