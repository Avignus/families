"use client";

import { coverThemeClass, isThemedCover, THEME_IMAGES, type CoverThemeVariant } from "@/lib/cosmetics";

type CosmeticConfig = {
  variant?: string;
  cssClass?: string;
};

type CoverThemeProps = {
  config: CosmeticConfig | null;
  overlayConfig?: CosmeticConfig | null;
  children?: React.ReactNode;
  className?: string;
};

export function CoverTheme({ config, overlayConfig, children, className = "" }: CoverThemeProps) {
  const variant = (config?.variant ?? "mosaic") as CoverThemeVariant;
  const themed = isThemedCover(variant);

  const overlayClass = overlayConfig?.cssClass ?? null;

  if (!themed) {
    if (variant === "gradient") {
      return (
        <div className={`cover-theme-gradient w-full h-full relative ${className}`}>
          {overlayClass && <div className={overlayClass} />}
        </div>
      );
    }
    // mosaic — render children (game images) with optional overlay
    if (!overlayClass) return <>{children}</>;
    return (
      <div className={`relative w-full h-full ${className}`}>
        {children}
        <div className={overlayClass} />
      </div>
    );
  }

  const cssClass = coverThemeClass(variant);
  const imagePath = THEME_IMAGES[variant];

  return (
    <div
      className={`${cssClass} w-full h-full relative ${className}`}
      style={imagePath ? {
        backgroundImage: `url(${imagePath})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      } : undefined}
    >
      {overlayClass && <div className={overlayClass} />}
    </div>
  );
}
