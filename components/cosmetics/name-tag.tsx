"use client";

import { nameTagStyle, type CosmeticConfig } from "@/lib/cosmetics";

const ANIM_CLASS: Record<string, string> = {
  "tag-horror": "tag-horror",
  "tag-spin":   "tag-spin",
  "tag-pulse":  "tag-pulse",
  "tag-float":  "tag-float",
  "tag-shield": "tag-shield",
};

type Props = { config: CosmeticConfig | null };

export function NameTag({ config }: Props) {
  if (!config?.icon) return null;
  const animClass = ANIM_CLASS[config.animClass ?? ""] ?? "";
  const style = nameTagStyle(config);

  return (
    <span
      className={`inline-block text-[11px] leading-none select-none ${animClass}`}
      style={style}
      title={config.icon}
    >
      {config.icon}
    </span>
  );
}
