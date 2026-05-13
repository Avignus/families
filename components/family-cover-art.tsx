/**
 * Generates a deterministic identicon-style SVG cover from a family ID.
 * 5×5 symmetrical grid (mirrored horizontally, like GitHub identicons)
 * with a gradient background — no external requests, no inappropriate content.
 */

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

type Props = {
  familyId: string;
  className?: string;
};

export function FamilyCoverArt({ familyId, className = "" }: Props) {
  const rand = seeded(hash(familyId));

  const hue1 = Math.floor(rand() * 360);
  const hue2 = (hue1 + 130 + Math.floor(rand() * 100)) % 360;
  const bg1 = `hsl(${hue1} 40% 10%)`;
  const bg2 = `hsl(${hue2} 50% 16%)`;
  const cellColor = `hsl(${hue1} 70% 62%)`;
  const accentColor = `hsl(${hue2} 80% 68%)`;

  // 5×5 grid, columns 0-2 generated, col 3=col1, col4=col0 (mirror)
  const COLS = 5;
  const ROWS = 5;
  const CELL = 20; // each cell is 20×20 in viewBox units (100×100 total)

  const cells: boolean[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: 3 }, () => rand() > 0.45)
  );

  const rects: JSX.Element[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const mirrored = c < 3 ? cells[r][c] : cells[r][4 - c];
      if (!mirrored) continue;
      const accent = rand() > 0.75;
      rects.push(
        <rect
          key={`${r}-${c}`}
          x={c * CELL + 1}
          y={r * CELL + 1}
          width={CELL - 2}
          height={CELL - 2}
          rx={3}
          fill={accent ? accentColor : cellColor}
          opacity={0.85 + rand() * 0.15}
        />
      );
    }
  }

  const gradId = `g-${familyId.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      viewBox="0 0 100 100"
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
      <rect width="100" height="100" fill={`url(#${gradId})`} />
      {rects}
    </svg>
  );
}
