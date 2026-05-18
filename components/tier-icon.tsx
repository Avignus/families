"use client";

import type { FamilyTier } from "@/lib/family-reputation";

type TierConfig = {
  frame: string;       // outermost shield border
  frameEdge: string;   // decorative edge/trim
  body: string;        // inner shield fill
  gemDark: string;     // pavilion / shadow facets
  gemMid: string;      // mid facets
  gemLight: string;    // crown highlight facets
  gemShine: string;    // brightest highlight
  glow?: string;       // drop-shadow color (ouro / elite)
  runes?: boolean;     // elite runic marks
};

const CONFIGS: Record<FamilyTier, TierConfig> = {
  ferro: {
    frame:     "#1e2230",
    frameEdge: "#606878",
    body:      "#2e3345",
    gemDark:   "#383f52",
    gemMid:    "#5a6275",
    gemLight:  "#8898a8",
    gemShine:  "#b8c8d4",
  },
  bronze: {
    frame:     "#1e1008",
    frameEdge: "#a06830",
    body:      "#2e1a0a",
    gemDark:   "#3e1e08",
    gemMid:    "#7a4820",
    gemLight:  "#c07838",
    gemShine:  "#e8a858",
  },
  prata: {
    frame:     "#1e2230",
    frameEdge: "#90a8c0",
    body:      "#2c3848",
    gemDark:   "#485870",
    gemMid:    "#7890a8",
    gemLight:  "#c0d4e8",
    gemShine:  "#f0f8ff",
  },
  ouro: {
    frame:     "#181000",
    frameEdge: "#d09000",
    body:      "#281800",
    gemDark:   "#503800",
    gemMid:    "#b07800",
    gemLight:  "#f0b800",
    gemShine:  "#fff080",
    glow:      "#c09000",
  },
  elite: {
    frame:     "#0c0416",
    frameEdge: "#7020c8",
    body:      "#140828",
    gemDark:   "#220848",
    gemMid:    "#4c10a0",
    gemLight:  "#8830d8",
    gemShine:  "#c868ff",
    glow:      "#6818b8",
    runes:     true,
  },
};

// 32 × 40 viewBox — portrait shield shape
export function TierIcon({ tier, size = 18 }: { tier: FamilyTier; size?: number }) {
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

      {/* ── Inner frame edge trim ── */}
      <path
        d="M16,3.5 L27.5,8.5 L27.5,23 L23.5,30.5 L16,37 L8.5,30.5 L4.5,23 L4.5,8.5 Z"
        fill="none"
        stroke={c.frameEdge}
        strokeWidth="0.4"
        opacity="0.55"
      />

      {/* ── Top shield highlights (metallic rim) ── */}
      <path
        d="M16,0.5 L30.5,6 L27.5,8.5 L16,3.5 L4.5,8.5 L1.5,6 Z"
        fill={c.frameEdge}
        opacity="0.25"
      />

      {/* ── Elite rune marks around inner border ── */}
      {c.runes && (
        <g opacity="0.55" fill={c.frameEdge}>
          {/* top-right arc marks */}
          <rect x="23" y="7"  width="1.5" height="3" rx="0.4" transform="rotate(20,23.75,8.5)" />
          <rect x="25" y="11" width="1.5" height="2.5" rx="0.4" transform="rotate(40,25.75,12.25)" />
          <rect x="26" y="16" width="1.5" height="2.5" rx="0.4" transform="rotate(60,26.75,17.25)" />
          {/* top-left arc marks */}
          <rect x="8"  y="7"  width="1.5" height="3" rx="0.4" transform="rotate(-20,8.75,8.5)" />
          <rect x="5.5" y="11" width="1.5" height="2.5" rx="0.4" transform="rotate(-40,6.25,12.25)" />
          <rect x="4.5" y="16" width="1.5" height="2.5" rx="0.4" transform="rotate(-60,5.25,17.25)" />
        </g>
      )}

      {/* ── Central gem ── */}
      {/* Girdle: widest point at y≈20, top at y≈11, bottom at y≈31 */}

      {/* Pavilion (lower half) base fill */}
      <polygon points="7,20 25,20 16,31" fill={c.gemDark} />

      {/* Pavilion left facet */}
      <polygon points="7,20 16,25 16,31" fill={c.gemMid} opacity="0.7" />

      {/* Pavilion right facet */}
      <polygon points="25,20 16,25 16,31" fill={c.gemDark} opacity="0.85" />

      {/* Crown (upper half) left facet — darker */}
      <polygon points="16,11 7,20 16,16" fill={c.gemMid} />

      {/* Crown right facet — lighter highlight */}
      <polygon points="16,11 25,20 16,16" fill={c.gemLight} />

      {/* Upper-left kite */}
      <polygon points="11,15 7,20 16,16" fill={c.gemMid} opacity="0.75" />

      {/* Upper-right kite — brightest */}
      <polygon points="21,15 25,20 16,16" fill={c.gemShine} opacity="0.85" />

      {/* Table (top flat face) */}
      <polygon points="16,11 20,15 16,14 12,15" fill={c.gemShine} opacity="0.95" />

      {/* Top-right sparkle — Prata gets an extra flare */}
      {tier === "prata" && (
        <>
          <line x1="22" y1="12" x2="26" y2="8"  stroke="white" strokeWidth="0.6" opacity="0.7" />
          <line x1="23" y1="14" x2="27" y2="14" stroke="white" strokeWidth="0.4" opacity="0.5" />
          <line x1="22" y1="16" x2="26" y2="20" stroke="white" strokeWidth="0.4" opacity="0.4" />
        </>
      )}

      {/* Apex sparkle */}
      <polygon points="16,11 17.5,13.5 16,12.5" fill="white" opacity="0.75" />

      {/* Gem outline */}
      <polygon
        points="16,11 25,20 16,31 7,20"
        fill="none"
        stroke={c.frameEdge}
        strokeWidth="0.35"
        opacity="0.5"
      />

      {/* ── Top mini-gem ── */}
      <polygon points="16,0 19,3.5 16,6 13,3.5" fill={c.gemLight} />
      {/* top facet highlight */}
      <polygon points="16,0 19,3.5 16,2.5" fill={c.gemShine} opacity="0.9" />
      {/* bottom facet shadow */}
      <polygon points="16,2.5 19,3.5 16,6 13,3.5" fill={c.gemDark} opacity="0.6" />
      {/* mini-gem border */}
      <polygon
        points="16,0 19,3.5 16,6 13,3.5"
        fill="none"
        stroke={c.frameEdge}
        strokeWidth="0.4"
        opacity="0.7"
      />
    </svg>
  );
}
