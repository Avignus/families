"use client";

import type { ReputationTier } from "@/lib/reputation";

type TierConfig = {
  frame: string;
  frameEdge: string;
  body: string;
  starDark: string;
  starMid: string;
  starLight: string;
  starShine: string;
  glow?: string;
  runes?: boolean;
};

const CONFIGS: Record<ReputationTier, TierConfig> = {
  bronze: {
    frame:     "#1e1008",
    frameEdge: "#a06830",
    body:      "#2e1a0a",
    starDark:  "#3e1e08",
    starMid:   "#7a4820",
    starLight: "#c07838",
    starShine: "#e8a858",
  },
  prata: {
    frame:     "#1e2230",
    frameEdge: "#90a8c0",
    body:      "#2c3848",
    starDark:  "#485870",
    starMid:   "#7890a8",
    starLight: "#c0d4e8",
    starShine: "#f0f8ff",
  },
  ouro: {
    frame:     "#181000",
    frameEdge: "#d09000",
    body:      "#281800",
    starDark:  "#503800",
    starMid:   "#b07800",
    starLight: "#f0b800",
    starShine: "#fff080",
    glow:      "#c09000",
  },
  elite: {
    frame:     "#0c0416",
    frameEdge: "#7020c8",
    body:      "#140828",
    starDark:  "#220848",
    starMid:   "#4c10a0",
    starLight: "#8830d8",
    starShine: "#c868ff",
    glow:      "#6818b8",
    runes:     true,
  },
  lendario: {
    frame:     "#1a0008",
    frameEdge: "#e03060",
    body:      "#280012",
    starDark:  "#500020",
    starMid:   "#b80040",
    starLight: "#ff4070",
    starShine: "#ffb0c8",
    glow:      "#dd0040",
    runes:     true,
  },
};

// 5-point star: center (16,21), outer R=8, inner r=3.2
// Outer points at -90°, -18°, 54°, 126°, 198° (clockwise from top)
const O: [number, number][] = [
  [16,    13   ], // [0] top
  [23.61, 18.53], // [1] top-right
  [20.70, 27.47], // [2] bottom-right
  [11.30, 27.47], // [3] bottom-left
  [8.39,  18.53], // [4] top-left
];

// Inner points at -54°, 18°, 90°, 162°, 234°
const I: [number, number][] = [
  [17.88, 18.41], // [0] between top and top-right
  [19.04, 21.99], // [1] between top-right and bottom-right
  [16,    24.20], // [2] between bottom-right and bottom-left
  [12.96, 21.99], // [3] between bottom-left and top-left
  [14.12, 18.41], // [4] between top-left and top
];

function p(...coords: [number, number][]): string {
  return coords.map(([x, y]) => `${x},${y}`).join(" ");
}

const STAR_OUTLINE = p(O[0], I[0], O[1], I[1], O[2], I[2], O[3], I[3], O[4], I[4]);

// 32 × 40 viewBox — same shield silhouette as TierIcon
export function UserTierIcon({ tier, size = 18 }: { tier: ReputationTier; size?: number }) {
  const c = CONFIGS[tier];
  const h = Math.round(size * 1.25);
  const dropShadow = c.glow
    ? `drop-shadow(0 0 ${Math.round(size * 0.35)}px ${c.glow}cc)`
    : undefined;

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 32 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, filter: dropShadow }}
    >
      {/* ── Shield frame (outer) ── */}
      <path
        d="M16,0.5 L30.5,6 L30.5,23 L26,32 L16,39.5 L6,32 L1.5,23 L1.5,6 Z"
        fill={c.frame}
        stroke={c.frameEdge}
        strokeWidth="0.7"
      />

      {/* ── Shield body (inner) ── */}
      <path
        d="M16,3.5 L27.5,8.5 L27.5,23 L23.5,30.5 L16,37 L8.5,30.5 L4.5,23 L4.5,8.5 Z"
        fill={c.body}
      />

      {/* ── Inner border trim ── */}
      <path
        d="M16,3.5 L27.5,8.5 L27.5,23 L23.5,30.5 L16,37 L8.5,30.5 L4.5,23 L4.5,8.5 Z"
        fill="none"
        stroke={c.frameEdge}
        strokeWidth="0.4"
        opacity="0.55"
      />

      {/* ── Metallic top rim ── */}
      <path
        d="M16,0.5 L30.5,6 L27.5,8.5 L16,3.5 L4.5,8.5 L1.5,6 Z"
        fill={c.frameEdge}
        opacity="0.25"
      />

      {/* ── Elite rune marks ── */}
      {c.runes && (
        <g opacity="0.55" fill={c.frameEdge}>
          <rect x="23"  y="7"  width="1.5" height="3"   rx="0.4" transform="rotate(20,23.75,8.5)"   />
          <rect x="25"  y="11" width="1.5" height="2.5" rx="0.4" transform="rotate(40,25.75,12.25)" />
          <rect x="26"  y="16" width="1.5" height="2.5" rx="0.4" transform="rotate(60,26.75,17.25)" />
          <rect x="8"   y="7"  width="1.5" height="3"   rx="0.4" transform="rotate(-20,8.75,8.5)"   />
          <rect x="5.5" y="11" width="1.5" height="2.5" rx="0.4" transform="rotate(-40,6.25,12.25)" />
          <rect x="4.5" y="16" width="1.5" height="2.5" rx="0.4" transform="rotate(-60,5.25,17.25)" />
        </g>
      )}

      {/* ── 5-point STAR (personal achievement) ── */}

      {/* Base fill — darkest */}
      <polygon points={STAR_OUTLINE} fill={c.starDark} />

      {/* Center pentagon — mid tone */}
      <polygon points={p(I[0], I[1], I[2], I[3], I[4])} fill={c.starMid} />

      {/* Top spike — brightest (light hits directly) */}
      <polygon points={p(O[0], I[4], I[0])} fill={c.starShine} opacity="0.9" />

      {/* Top-right spike — second brightest */}
      <polygon points={p(O[1], I[0], I[1])} fill={c.starLight} opacity="0.8" />

      {/* Top-left spike — mid (partially lit) */}
      <polygon points={p(O[4], I[3], I[4])} fill={c.starMid} opacity="0.85" />

      {/* Apex sparkle at top point */}
      <polygon points="16,13 16.8,15.5 15.2,15.5" fill="white" opacity="0.8" />

      {/* Star outline */}
      <polygon
        points={STAR_OUTLINE}
        fill="none"
        stroke={c.frameEdge}
        strokeWidth="0.35"
        opacity="0.5"
      />

      {/* ── CROWN at apex (personal crest) ── */}
      {/* 3-peaked crown: center peak (16,0.5), outer peaks (13,1.5) and (19,1.5) */}

      {/* Crown body */}
      <polygon
        points="16,0.5 17.5,3.5 19,1.5 20,5.5 12,5.5 13,1.5 14.5,3.5"
        fill={c.starMid}
      />

      {/* Center peak highlight */}
      <polygon points="16,0.5 17,2.5 15,2.5" fill={c.starShine} opacity="0.9" />

      {/* Left peak highlight */}
      <polygon points="13,1.5 13.7,3.2 12.5,3.2" fill={c.starLight} opacity="0.65" />

      {/* Right peak highlight */}
      <polygon points="19,1.5 19.5,3.2 18.3,3.2" fill={c.starLight} opacity="0.65" />

      {/* Crown outline */}
      <polygon
        points="16,0.5 17.5,3.5 19,1.5 20,5.5 12,5.5 13,1.5 14.5,3.5"
        fill="none"
        stroke={c.frameEdge}
        strokeWidth="0.4"
        opacity="0.8"
      />
    </svg>
  );
}
