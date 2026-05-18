import type { FamilyTier } from "@/lib/family-reputation";

const CONFIGS: Record<FamilyTier, {
  base: string;
  mid: string;
  light: string;
  shine: string;
  glow?: string;
}> = {
  ferro: {
    base: "hsl(220 10% 30%)",
    mid:  "hsl(220 10% 45%)",
    light:"hsl(220 12% 58%)",
    shine:"hsl(220 15% 72%)",
  },
  bronze: {
    base: "hsl(22 50% 28%)",
    mid:  "hsl(25 54% 42%)",
    light:"hsl(28 58% 58%)",
    shine:"hsl(32 62% 72%)",
  },
  prata: {
    base: "hsl(218 14% 40%)",
    mid:  "hsl(220 16% 58%)",
    light:"hsl(220 18% 74%)",
    shine:"hsl(220 22% 88%)",
  },
  ouro: {
    base: "hsl(36 72% 30%)",
    mid:  "hsl(40 80% 46%)",
    light:"hsl(46 88% 62%)",
    shine:"hsl(52 92% 76%)",
    glow: "hsl(45 90% 55%)",
  },
  elite: {
    base: "hsl(258 60% 28%)",
    mid:  "hsl(258 68% 44%)",
    light:"hsl(260 74% 62%)",
    shine:"hsl(262 82% 78%)",
    glow: "hsl(258 82% 66%)",
  },
};

export function TierIcon({ tier, size = 18 }: { tier: FamilyTier; size?: number }) {
  const c = CONFIGS[tier];
  const filter = c.glow
    ? `drop-shadow(0 0 ${Math.round(size * 0.28)}px ${c.glow})`
    : undefined;

  // All coordinates in a 24×24 viewBox
  // Outer diamond, inner diamond, facet highlight, top sparkle
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, filter }}
    >
      {/* Shadow base */}
      <polygon points="12,2 22,12 12,22 2,12" fill={c.base} />
      {/* Main face */}
      <polygon points="12,4 20,12 12,20 4,12" fill={c.mid} />
      {/* Upper-left light facet */}
      <polygon points="12,4 20,12 12,12 4,12" fill={c.light} opacity="0.6" />
      {/* Top facet — brighter */}
      <polygon points="12,4 20,12 12,9" fill={c.shine} opacity="0.55" />
      {/* Inner gem */}
      <polygon points="12,7 17,12 12,17 7,12" fill={c.light} opacity="0.35" />
      {/* Center sparkle */}
      <polygon points="12,9 14,12 12,15 10,12" fill={c.shine} opacity="0.7" />
      {/* Top-edge white highlight */}
      <polygon points="12,2 15,6 12,7 9,6" fill="white" opacity="0.18" />
      {/* Outer border */}
      <polygon
        points="12,2 22,12 12,22 2,12"
        fill="none"
        stroke={c.light}
        strokeWidth="0.6"
        opacity="0.7"
      />
    </svg>
  );
}
