import { getFamilyTier, FAMILY_TIER_LABELS, FAMILY_TIER_COLORS } from "@/lib/family-reputation";
import { TierIcon } from "@/components/tier-icon";

type Props = {
  score: number;
  showScore?: boolean;
  size?: "sm" | "md";
};

export function FamilyTierBadge({ score, showScore = false, size = "sm" }: Props) {
  const tier = getFamilyTier(score);
  const label = FAMILY_TIER_LABELS[tier];
  const color = FAMILY_TIER_COLORS[tier];

  const padding = size === "md" ? "px-2 py-0.5" : "px-1.5 py-0.5";
  const fontSize = size === "md" ? "text-xs" : "text-[10px]";
  const iconSize = size === "md" ? 16 : 12;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${padding} ${fontSize}`}
      style={{ backgroundColor: `${color}28`, color, border: `1px solid ${color}80` }}
    >
      <TierIcon tier={tier} size={iconSize} />
      {label}
      {showScore && <span className="opacity-70">· {score}</span>}
    </span>
  );
}
