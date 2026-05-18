import { getFamilyTier, FAMILY_TIER_LABELS, FAMILY_TIER_COLORS } from "@/lib/family-reputation";

type Props = {
  score: number;
  showScore?: boolean;
  size?: "sm" | "md";
};

export function FamilyTierBadge({ score, showScore = false, size = "sm" }: Props) {
  const tier = getFamilyTier(score);
  const label = FAMILY_TIER_LABELS[tier];
  const color = FAMILY_TIER_COLORS[tier];

  const padding = size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const fontSize = size === "md" ? "text-xs" : "text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${padding} ${fontSize}`}
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      {label}
      {showScore && <span className="opacity-70">· {score}</span>}
    </span>
  );
}
