"use client";

import type { ReputationTier } from "@/lib/reputation";

// Coordinate system: (0,0) = avatar center, avatar radius = 14
// overflow: visible so the frame extends beyond the SVG bounds

type C = {
  ring:  string; // bright outer ring
  body:  string; // bracket fill (dark)
  bevel: string; // metallic highlight on bracket edge
  gem:   string; // inset gem color
  glow?: string;
};

const COLORS: Record<ReputationTier, C> = {
  bronze: {
    ring:  "#c07838",
    body:  "#6a3c10",
    bevel: "#e8a860",
    gem:   "#d09050",
  },
  prata: {
    ring:  "#a0b8d0",
    body:  "#3a5070",
    bevel: "#e0f0ff",
    gem:   "#c0d8f0",
  },
  ouro: {
    ring:  "#d0a000",
    body:  "#5a3a00",
    bevel: "#ffd840",
    gem:   "#40c8b0",   // teal gem accent (like LoL gold)
    glow:  "#b08000",
  },
  elite: {
    ring:  "#8040d0",
    body:  "#220848",
    bevel: "#c080ff",
    gem:   "#a060e8",
    glow:  "#6018b8",
  },
  lendario: {
    ring:  "#e03060",
    body:  "#500018",
    bevel: "#ff80a0",
    gem:   "#ff40a0",
    glow:  "#d80040",
  },
};

// ── Shared gem shape (rotated square / diamond) ────────────────
function Gem({ cx, cy, r, fill, stroke }: {
  cx: number; cy: number; r: number; fill: string; stroke: string;
}) {
  return (
    <polygon
      points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
      fill={fill}
      stroke={stroke}
      strokeWidth="0.4"
    />
  );
}

// ── BRONZE: simple angular armor bracket ───────────────────────
function BronzeFrame({ c }: { c: C }) {
  return (
    <g>
      {/* Left bracket */}
      <path d="M-11,-5 L-19,-4 L-22,0 L-19,4 L-11,5 Z" fill={c.body} />
      <path d="M-11,-5 L-19,-4 L-19,0 L-11,0 Z" fill={c.bevel} opacity="0.35" />
      <path d="M-11,-5 L-19,-4 L-22,0 L-19,4 L-11,5 Z"
        fill="none" stroke={c.ring} strokeWidth="0.9" strokeLinejoin="round" />
      <Gem cx={-16} cy={0} r={2.2} fill={c.gem} stroke={c.ring} />

      {/* Right bracket */}
      <path d="M11,-5 L19,-4 L22,0 L19,4 L11,5 Z" fill={c.body} />
      <path d="M11,-5 L19,-4 L19,0 L11,0 Z" fill={c.bevel} opacity="0.35" />
      <path d="M11,-5 L19,-4 L22,0 L19,4 L11,5 Z"
        fill="none" stroke={c.ring} strokeWidth="0.9" strokeLinejoin="round" />
      <Gem cx={16} cy={0} r={2.2} fill={c.gem} stroke={c.ring} />

      {/* Top spike */}
      <path d="M-2,-14 L0,-19 L2,-14"
        fill={c.body} stroke={c.ring} strokeWidth="0.8" strokeLinejoin="round" />

      {/* Bottom V */}
      <path d="M-2,14 L0,18 L2,14"
        fill="none" stroke={c.ring} strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

// ── PRATA: refined bracket with wider spread + bevel cuts ──────
function PrataFrame({ c }: { c: C }) {
  return (
    <g>
      {/* Left bracket — wider, with beveled outer corners */}
      <path d="M-11,-6 L-21,-5 L-25,-2 L-25,2 L-21,5 L-11,6 Z" fill={c.body} />
      <path d="M-11,-6 L-21,-5 L-21,0 L-11,0 Z" fill={c.bevel} opacity="0.3" />
      <path d="M-11,-6 L-21,-5 L-25,-2 L-25,2 L-21,5 L-11,6 Z"
        fill="none" stroke={c.ring} strokeWidth="0.9" strokeLinejoin="round" />
      <Gem cx={-18} cy={0} r={2.5} fill={c.gem} stroke={c.ring} />

      {/* Right bracket */}
      <path d="M11,-6 L21,-5 L25,-2 L25,2 L21,5 L11,6 Z" fill={c.body} />
      <path d="M11,-6 L21,-5 L21,0 L11,0 Z" fill={c.bevel} opacity="0.3" />
      <path d="M11,-6 L21,-5 L25,-2 L25,2 L21,5 L11,6 Z"
        fill="none" stroke={c.ring} strokeWidth="0.9" strokeLinejoin="round" />
      <Gem cx={18} cy={0} r={2.5} fill={c.gem} stroke={c.ring} />

      {/* Top diamond ornament */}
      <path d="M-3,-14 L0,-20 L3,-14" fill={c.body} stroke={c.ring} strokeWidth="0.8" strokeLinejoin="round" />
      <Gem cx={0} cy={-14} r={2} fill={c.gem} stroke={c.ring} />

      {/* Bottom spike */}
      <path d="M-2,14 L0,19 L2,14"
        fill={c.body} stroke={c.ring} strokeWidth="0.8" strokeLinejoin="round" />
    </g>
  );
}

// ── OURO: wide bracket with teal gem + wing fins + crown ───────
function OuroFrame({ c }: { c: C }) {
  return (
    <g>
      {/* Left main bracket */}
      <path d="M-11,-7 L-24,-6 L-28,-2 L-28,2 L-24,6 L-11,7 Z" fill={c.body} />
      <path d="M-11,-7 L-24,-6 L-24,0 L-11,0 Z" fill={c.bevel} opacity="0.28" />
      {/* Left upper fin (small wing above bracket) */}
      <path d="M-15,-7 L-22,-11 L-24,-6 L-15,-6 Z" fill={c.body} />
      <path d="M-15,-7 L-22,-11 L-24,-6" fill="none" stroke={c.ring} strokeWidth="0.7" strokeLinejoin="round" />
      {/* Left lower fin */}
      <path d="M-15,7 L-22,11 L-24,6 L-15,6 Z" fill={c.body} />
      <path d="M-15,7 L-22,11 L-24,6" fill="none" stroke={c.ring} strokeWidth="0.7" strokeLinejoin="round" />
      {/* Bracket outline */}
      <path d="M-11,-7 L-24,-6 L-28,-2 L-28,2 L-24,6 L-11,7"
        fill="none" stroke={c.ring} strokeWidth="1" strokeLinejoin="round" />
      {/* Large teal gem */}
      <Gem cx={-20} cy={0} r={3.2} fill={c.gem} stroke={c.ring} />
      {/* Gem highlight */}
      <polygon points="-20,-3.2 -16.8,0 -20,-1.2" fill="white" opacity="0.5" />

      {/* Right main bracket */}
      <path d="M11,-7 L24,-6 L28,-2 L28,2 L24,6 L11,7 Z" fill={c.body} />
      <path d="M11,-7 L24,-6 L24,0 L11,0 Z" fill={c.bevel} opacity="0.28" />
      <path d="M15,-7 L22,-11 L24,-6 L15,-6 Z" fill={c.body} />
      <path d="M15,-7 L22,-11 L24,-6" fill="none" stroke={c.ring} strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M15,7 L22,11 L24,6 L15,6 Z" fill={c.body} />
      <path d="M15,7 L22,11 L24,6" fill="none" stroke={c.ring} strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M11,-7 L24,-6 L28,-2 L28,2 L24,6 L11,7"
        fill="none" stroke={c.ring} strokeWidth="1" strokeLinejoin="round" />
      <Gem cx={20} cy={0} r={3.2} fill={c.gem} stroke={c.ring} />
      <polygon points="20,-3.2 23.2,0 20,-1.2" fill="white" opacity="0.5" />

      {/* Top crown gem */}
      <path d="M-3,-14 L0,-21 L3,-14" fill={c.body} stroke={c.ring} strokeWidth="0.85" strokeLinejoin="round" />
      <Gem cx={0} cy={-14} r={2.8} fill={c.gem} stroke={c.ring} />
      <polygon points="0,-14 2.8,0 0,-12" fill="white" opacity="0.45" />

      {/* Bottom spike */}
      <path d="M-3,14 L0,20 L3,14"
        fill={c.body} stroke={c.ring} strokeWidth="0.85" strokeLinejoin="round" />
    </g>
  );
}

// ── ELITE: large bracket with 2 gems + multi-spike top ─────────
function EliteFrame({ c }: { c: C }) {
  return (
    <g>
      {/* Left bracket — two sections */}
      {/* Outer panel */}
      <path d="M-11,-8 L-27,-7 L-33,-3 L-33,3 L-27,7 L-11,8 Z" fill={c.body} />
      <path d="M-11,-8 L-27,-7 L-27,0 L-11,0 Z" fill={c.bevel} opacity="0.22" />
      {/* Left upper wing */}
      <path d="M-14,-8 L-24,-13 L-27,-7 L-14,-7 Z" fill={c.body} />
      <path d="M-14,-8 L-24,-13 L-27,-7" fill="none" stroke={c.ring} strokeWidth="0.7" strokeLinejoin="round" />
      {/* Left lower wing */}
      <path d="M-14,8 L-24,13 L-27,7 L-14,7 Z" fill={c.body} />
      <path d="M-14,8 L-24,13 L-27,7" fill="none" stroke={c.ring} strokeWidth="0.7" strokeLinejoin="round" />
      {/* Main outline */}
      <path d="M-11,-8 L-27,-7 L-33,-3 L-33,3 L-27,7 L-11,8"
        fill="none" stroke={c.ring} strokeWidth="1.1" strokeLinejoin="round" />
      {/* Two gems: inner and outer */}
      <Gem cx={-17} cy={0} r={2.8} fill={c.gem} stroke={c.ring} />
      <Gem cx={-26} cy={0} r={2.2} fill={c.bevel} stroke={c.ring} />
      <polygon points="-17,-2.8 -14.2,0 -17,-1" fill="white" opacity="0.55" />

      {/* Right bracket */}
      <path d="M11,-8 L27,-7 L33,-3 L33,3 L27,7 L11,8 Z" fill={c.body} />
      <path d="M11,-8 L27,-7 L27,0 L11,0 Z" fill={c.bevel} opacity="0.22" />
      <path d="M14,-8 L24,-13 L27,-7 L14,-7 Z" fill={c.body} />
      <path d="M14,-8 L24,-13 L27,-7" fill="none" stroke={c.ring} strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M14,8 L24,13 L27,7 L14,7 Z" fill={c.body} />
      <path d="M14,8 L24,13 L27,7" fill="none" stroke={c.ring} strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M11,-8 L27,-7 L33,-3 L33,3 L27,7 L11,8"
        fill="none" stroke={c.ring} strokeWidth="1.1" strokeLinejoin="round" />
      <Gem cx={17} cy={0} r={2.8} fill={c.gem} stroke={c.ring} />
      <Gem cx={26} cy={0} r={2.2} fill={c.bevel} stroke={c.ring} />
      <polygon points="17,-2.8 19.8,0 17,-1" fill="white" opacity="0.55" />

      {/* Top: triple spike crown */}
      <path d="M-6,-14 L-8,-20 L-4,-18 L0,-23 L4,-18 L8,-20 L6,-14 Z"
        fill={c.body} stroke={c.ring} strokeWidth="0.8" strokeLinejoin="round" />
      <polygon points="-4,-18 0,-23 4,-18 0,-20" fill={c.bevel} opacity="0.5" />
      <Gem cx={0} cy={-14} r={2.5} fill={c.gem} stroke={c.ring} />

      {/* Bottom: double spike */}
      <path d="M-4,14 L-2,19 L0,22 L2,19 L4,14"
        fill={c.body} stroke={c.ring} strokeWidth="0.85" strokeLinejoin="round" />
    </g>
  );
}

// ── LENDÁRIO: massive multi-gem frame + crown + anchor ─────────
function LendarioFrame({ c }: { c: C }) {
  return (
    <g>
      {/* Left bracket — three sections, full spread */}
      <path d="M-11,-9 L-30,-8 L-38,-3 L-38,3 L-30,8 L-11,9 Z" fill={c.body} />
      <path d="M-11,-9 L-30,-8 L-30,0 L-11,0 Z" fill={c.bevel} opacity="0.2" />
      {/* Left upper wing (large) */}
      <path d="M-14,-9 L-28,-16 L-32,-8 L-14,-8 Z" fill={c.body} />
      <path d="M-14,-9 L-28,-16 L-32,-8" fill="none" stroke={c.ring} strokeWidth="0.8" strokeLinejoin="round" />
      {/* Left lower wing (large) */}
      <path d="M-14,9 L-28,16 L-32,8 L-14,8 Z" fill={c.body} />
      <path d="M-14,9 L-28,16 L-32,8" fill="none" stroke={c.ring} strokeWidth="0.8" strokeLinejoin="round" />
      {/* Main outline */}
      <path d="M-11,-9 L-30,-8 L-38,-3 L-38,3 L-30,8 L-11,9"
        fill="none" stroke={c.ring} strokeWidth="1.3" strokeLinejoin="round" />
      {/* Three gems: inner, mid, outer */}
      <Gem cx={-16} cy={0} r={3}   fill={c.gem}   stroke={c.ring} />
      <Gem cx={-24} cy={0} r={3}   fill={c.gem}   stroke={c.ring} />
      <Gem cx={-33} cy={0} r={2.2} fill={c.bevel} stroke={c.ring} />
      <polygon points="-16,-3 -13,0 -16,-1.2" fill="white" opacity="0.6" />
      <polygon points="-24,-3 -21,0 -24,-1.2" fill="white" opacity="0.6" />

      {/* Right bracket */}
      <path d="M11,-9 L30,-8 L38,-3 L38,3 L30,8 L11,9 Z" fill={c.body} />
      <path d="M11,-9 L30,-8 L30,0 L11,0 Z" fill={c.bevel} opacity="0.2" />
      <path d="M14,-9 L28,-16 L32,-8 L14,-8 Z" fill={c.body} />
      <path d="M14,-9 L28,-16 L32,-8" fill="none" stroke={c.ring} strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M14,9 L28,16 L32,8 L14,8 Z" fill={c.body} />
      <path d="M14,9 L28,16 L32,8" fill="none" stroke={c.ring} strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M11,-9 L30,-8 L38,-3 L38,3 L30,8 L11,9"
        fill="none" stroke={c.ring} strokeWidth="1.3" strokeLinejoin="round" />
      <Gem cx={16} cy={0} r={3}   fill={c.gem}   stroke={c.ring} />
      <Gem cx={24} cy={0} r={3}   fill={c.gem}   stroke={c.ring} />
      <Gem cx={33} cy={0} r={2.2} fill={c.bevel} stroke={c.ring} />
      <polygon points="16,-3 19,0 16,-1.2" fill="white" opacity="0.6" />
      <polygon points="24,-3 27,0 24,-1.2" fill="white" opacity="0.6" />

      {/* Top: 5-point crown */}
      <path d="M-8,-14 L-11,-22 L-5,-19 L0,-25 L5,-19 L11,-22 L8,-14 Z"
        fill={c.body} stroke={c.ring} strokeWidth="0.9" strokeLinejoin="round" />
      <polygon points="-5,-19 0,-25 5,-19 0,-22" fill={c.bevel} opacity="0.5" />
      <Gem cx={0}  cy={-14} r={3}   fill={c.gem}   stroke={c.ring} />
      <Gem cx={-7} cy={-15} r={1.8} fill={c.bevel} stroke={c.ring} />
      <Gem cx={ 7} cy={-15} r={1.8} fill={c.bevel} stroke={c.ring} />
      <polygon points="0,-14 3,0 0,-11.5" fill="white" opacity="0.5" />

      {/* Bottom: decorative anchor */}
      <path d="M-5,14 L-7,20 L0,24 L7,20 L5,14"
        fill={c.body} stroke={c.ring} strokeWidth="0.9" strokeLinejoin="round" />
      <Gem cx={0} cy={19} r={2} fill={c.gem} stroke={c.ring} />
    </g>
  );
}

export function TierAvatarFrame({ tier }: { tier: ReputationTier }) {
  const c = COLORS[tier];
  const ringWidth = tier === "lendario" ? 2.8 : tier === "elite" ? 2.4 : tier === "ouro" ? 2.2 : 1.8;

  return (
    <svg
      width={28}
      height={28}
      viewBox="-14 -14 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        overflow: "visible",
        pointerEvents: "none",
        filter: c.glow ? `drop-shadow(0 0 4px ${c.glow}aa)` : undefined,
      }}
    >
      {/* Wings/brackets drawn first (behind ring) */}
      {tier === "bronze"   && <BronzeFrame   c={c} />}
      {tier === "prata"    && <PrataFrame    c={c} />}
      {tier === "ouro"     && <OuroFrame     c={c} />}
      {tier === "elite"    && <EliteFrame    c={c} />}
      {tier === "lendario" && <LendarioFrame c={c} />}

      {/* Ring on top — the bright circular border around the avatar */}
      <circle cx={0} cy={0} r={14.5} stroke={c.ring} strokeWidth={ringWidth} />
      {/* Inner ring highlight */}
      <circle cx={0} cy={0} r={14.5} stroke={c.bevel} strokeWidth={ringWidth * 0.3} opacity="0.4" />
    </svg>
  );
}
