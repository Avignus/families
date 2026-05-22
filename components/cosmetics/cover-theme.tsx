"use client";

import { coverThemeClass, isThemedCover, type CoverThemeVariant } from "@/lib/cosmetics";

type CosmeticConfig = {
  variant?: string;
  primaryColor?: string;
  accentColor?: string;
};

type CoverThemeProps = {
  config: CosmeticConfig | null;
  children?: React.ReactNode; // fallback (game mosaic images)
  className?: string;
};

export function CoverTheme({ config, children, className = "" }: CoverThemeProps) {
  const variant = (config?.variant ?? "mosaic") as CoverThemeVariant;
  const themed = isThemedCover(variant);

  if (!themed) {
    // Mosaic or gradient — render children (game images) or gradient
    if (variant === "gradient") {
      return (
        <div className={`cover-theme-gradient w-full h-full ${className}`} />
      );
    }
    return <>{children}</>;
  }

  const cls = coverThemeClass(variant);

  return (
    <div className={`${cls} w-full h-full ${className}`} />
  );
}
