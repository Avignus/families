"use client";

import type { ReputationTier } from "@/lib/reputation";

export function UserTierIcon({ tier, size = 18 }: { tier: ReputationTier; size?: number }) {
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
