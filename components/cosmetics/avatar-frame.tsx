"use client";

import { avatarFrameStyle, type CosmeticConfig } from "@/lib/cosmetics";

const ANIM_CLASS: Record<string, string> = {
  "frame-haunt":  "avatar-frame-haunt",
  "frame-gold":   "avatar-frame-gold",
  "frame-chain":  "avatar-frame-chain",
  "frame-neon":   "avatar-frame-neon",
  "frame-royal":  "avatar-frame-royal",
};

type Props = {
  config: CosmeticConfig | null;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
};

export function AvatarFrame({ config, children, size = "md" }: Props) {
  if (!config) return <>{children}</>;

  const animClass = ANIM_CLASS[config.animClass ?? ""] ?? "";
  const style = avatarFrameStyle(config);
  const rounded = size === "sm" ? "rounded-full" : "rounded-full";

  return (
    <div className={`relative inline-block ${rounded} ${animClass}`} style={style}>
      {children}
    </div>
  );
}
