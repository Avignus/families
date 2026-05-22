"use client";

import type { FamilyTier } from "@/lib/family-reputation";

export function TierIcon({ tier, size = 18 }: { tier: FamilyTier; size?: number }) {
  const h = Math.round(size * 1.25);
  return (
    <img
      src={`/elos/${tier}.png`}
      width={size}
      height={h}
      style={{ flexShrink: 0, objectFit: "contain" }}
      alt={tier}
    />
  );
}
