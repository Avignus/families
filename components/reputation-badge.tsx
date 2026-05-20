import { getTier, TIER_LABELS, TIER_COLORS } from "@/lib/reputation";
import { UserTierIcon } from "@/components/user-tier-icon";

type Props = {
  score: number;
  showScore?: boolean;
  size?: "sm" | "md";
};

export function ReputationBadge({ score, showScore = false, size = "sm" }: Props) {
  const tier = getTier(score);
  const label = TIER_LABELS[tier];
  const color = TIER_COLORS[tier];

  const padding = size === "md" ? "px-2 py-0.5" : "px-1.5 py-0.5";
  const fontSize = size === "md" ? "text-xs" : "text-[10px]";
  const iconSize = size === "md" ? 20 : 14;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${padding} ${fontSize}`}
      style={{ backgroundColor: `${color}28`, color, border: `1px solid ${color}80` }}
    >
      <UserTierIcon tier={tier} size={iconSize} />
      {label}
      {showScore && score > 0 && <span className="opacity-70">· {score}</span>}
    </span>
  );
}
