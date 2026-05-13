/**
 * Generates a deterministic gaming-themed banner SVG.
 * Wide viewBox (400×120) with pixel-art symbols on a gradient background.
 * Scales cleanly to any container size.
 */

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// Pixel-art gaming symbol paths (all 0-10 units, centered at 5,5)
const SYMBOLS = [
  // Star (4-point)
  "M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z",
  // Diamond
  "M5 0 L10 5 L5 10 L0 5 Z",
  // Heart (simplified pixel)
  "M5 9 L1 4 Q1 1 4 2 Q5 3 5 3 Q5 3 6 2 Q9 1 9 4 Z",
  // Cross / health pack
  "M3 0 L7 0 L7 3 L10 3 L10 7 L7 7 L7 10 L3 10 L3 7 L0 7 L0 3 L3 3 Z",
  // Lightning bolt
  "M7 0 L3 5 L6 5 L3 10 L7 5 L4 5 Z",
  // Shield
  "M5 0 L10 2 L10 6 Q10 9 5 11 Q0 9 0 6 L0 2 Z",
  // Sword (simple)
  "M5 0 L6 6 L8 8 L7 9 L5 7 L3 9 L2 8 L4 6 Z",
  // Controller D-pad (simplified)
  "M3 0 L7 0 L7 3 L10 3 L10 7 L7 7 L7 10 L3 10 L3 7 L0 7 L0 3 L3 3 Z",
];

type Props = {
  familyId: string;
  className?: string;
};

export function FamilyCoverArt({ familyId, className = "" }: Props) {
  const rand = seeded(hash(familyId));

  const hue1 = Math.floor(rand() * 360);
  const hue2 = (hue1 + 120 + Math.floor(rand() * 120)) % 360;
  const hue3 = (hue1 + 240) % 360;

  const bg1 = `hsl(${hue1} 45% 8%)`;
  const bg2 = `hsl(${hue2} 35% 13%)`;
  const c1 = `hsl(${hue1} 75% 60%)`;
  const c2 = `hsl(${hue2} 80% 65%)`;
  const c3 = `hsl(${hue3} 70% 58%)`;
  const colors = [c1, c2, c3];

  const W = 400;
  const H = 120;
  const SYMBOL_SIZE = 12;
  const COLS = Math.ceil(W / 36);
  const ROWS = Math.ceil(H / 36);
  const gradId = `grd-${familyId.replace(/\W/g, "").slice(0, 8)}`;

  const items: React.ReactNode[] = [];
  for (let r = 0; r < ROWS + 1; r++) {
    for (let c = 0; c < COLS + 1; c++) {
      if (rand() > 0.55) continue;
      const x = c * 36 + rand() * 12 - 6;
      const y = r * 36 + rand() * 12 - 6;
      const symbolIdx = Math.floor(rand() * SYMBOLS.length);
      const color = colors[Math.floor(rand() * colors.length)];
      const opacity = 0.12 + rand() * 0.25;
      const scale = 0.7 + rand() * 0.6;
      items.push(
        <path
          key={`${r}-${c}`}
          d={SYMBOLS[symbolIdx]}
          fill={color}
          opacity={opacity}
          transform={`translate(${x - (SYMBOL_SIZE * scale) / 2},${y - (SYMBOL_SIZE * scale) / 2}) scale(${(SYMBOL_SIZE * scale) / 10})`}
        />
      );
    }
  }

  // A few larger accent symbols in the center area
  for (let i = 0; i < 3; i++) {
    const x = 80 + rand() * 240;
    const y = 20 + rand() * 80;
    const symbolIdx = Math.floor(rand() * SYMBOLS.length);
    const color = colors[Math.floor(rand() * colors.length)];
    const size = 18 + rand() * 16;
    items.push(
      <path
        key={`accent-${i}`}
        d={SYMBOLS[symbolIdx]}
        fill={color}
        opacity={0.35 + rand() * 0.2}
        transform={`translate(${x - size / 2},${y - size / 2}) scale(${size / 10})`}
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-full h-full ${className}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bg1} />
          <stop offset="100%" stopColor={bg2} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${gradId})`} />
      {items}
    </svg>
  );
}
