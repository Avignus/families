"use client";

import { coverThemeClass, isThemedCover, THEME_IMAGES, type CoverThemeVariant } from "@/lib/cosmetics";

type CosmeticConfig = {
  variant?: string;
};

type CoverThemeProps = {
  config: CosmeticConfig | null;
  children?: React.ReactNode;
  className?: string;
};

export function CoverTheme({ config, children, className = "" }: CoverThemeProps) {
  const variant = (config?.variant ?? "mosaic") as CoverThemeVariant;
  const themed = isThemedCover(variant);

  if (!themed) {
    if (variant === "gradient") {
      return <div className={`cover-theme-gradient w-full h-full ${className}`} />;
    }
    return <>{children}</>;
  }

  const cssClass = coverThemeClass(variant);
  const imagePath = THEME_IMAGES[variant];

  return (
    <div
      className={`${cssClass} w-full h-full ${className}`}
      style={imagePath ? {
        backgroundImage: `url(${imagePath})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    />
  );
}
