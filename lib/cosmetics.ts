// Cosmetic rendering configuration types and helpers

export type CosmeticConfig = {
  variant?: string;
  animClass?: string;
  primaryColor?: string;
  accentColor?: string;
  borderColor?: string;
  glowColor?: string;
  shadowIntensity?: "low" | "medium" | "high";
  icon?: string;
  color?: string;
  particleColor?: string;
  intensity?: "low" | "medium" | "high";
};

export type CoverThemeVariant =
  | "mosaic"
  | "gradient"
  | "cripta-ancestral"
  | "sala-tesouro"
  | "fortaleza-cla"
  | "cidade-neon"
  | "salao-trono";

// Returns the CSS class to apply to the cover area for a given theme variant
export function coverThemeClass(variant: CoverThemeVariant): string {
  const map: Record<CoverThemeVariant, string> = {
    "mosaic":           "",
    "gradient":         "cover-theme-gradient",
    "cripta-ancestral": "cover-theme-cripta",
    "sala-tesouro":     "cover-theme-tesouro",
    "fortaleza-cla":    "cover-theme-fortaleza",
    "cidade-neon":      "cover-theme-neon",
    "salao-trono":      "cover-theme-trono",
  };
  return map[variant] ?? "";
}

// Returns inline CSS style for avatar frame cosmetic
export function avatarFrameStyle(config: CosmeticConfig): React.CSSProperties {
  const intensity = config.shadowIntensity ?? "medium";
  const spread = intensity === "high" ? "0 0 16px" : intensity === "medium" ? "0 0 10px" : "0 0 6px";
  return {
    boxShadow: `0 0 0 2px ${config.borderColor ?? "#fff"}, ${spread} ${config.glowColor ?? config.borderColor ?? "#fff"}`,
  };
}

// Returns inline CSS style for name tag cosmetic
export function nameTagStyle(config: CosmeticConfig): React.CSSProperties {
  return { color: config.color ?? "#fff" };
}

// Check if a cover theme is a "themed" variant (not mosaic/gradient = needs custom rendering)
export function isThemedCover(variant: string | undefined): boolean {
  return !!variant && variant !== "mosaic" && variant !== "gradient";
}

// Base images for each cover theme variant (overlay animations sit on top via CSS ::before/::after)
export const THEME_IMAGES: Partial<Record<CoverThemeVariant, string>> = {
  "cripta-ancestral": "/images/theme-cripta-ancestral.png",
  "sala-tesouro":     "/images/theme-sala-tesouro.png",
  "fortaleza-cla":    "/images/theme-fortaleza-cla.png",
  "cidade-neon":      "/images/theme-cidade-neon.png",
  "salao-trono":      "/images/theme-salao-trono.png",
};

// Profile background images for cosmetics of type profile_bg
export const PROFILE_BG_IMAGES: Record<string, string> = {
  "bg-mansao-sombria":  "/images/theme-mansao-sombria-perfil.png",
  "bg-sala-tesouro":    "/images/theme-sala-tesouro.png",
  "bg-fortaleza-cla":   "/images/theme-fortaleza-cla.png",
  "bg-salao-trono":     "/images/theme-salao-trono-perfil.png",
};

// Rarity display config
export const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; glow: string }> = {
  padrao:      { label: "Padrão",    color: "text-muted-foreground", bg: "bg-muted/30",        glow: "" },
  comum:       { label: "Comum",     color: "text-zinc-400",         bg: "bg-zinc-500/15",     glow: "" },
  incomum:     { label: "Incomum",   color: "text-emerald-400",      bg: "bg-emerald-500/15",  glow: "shadow-[0_0_8px_rgba(52,211,153,0.4)]" },
  raro:        { label: "Raro",      color: "text-blue-400",         bg: "bg-blue-500/15",     glow: "shadow-[0_0_12px_rgba(96,165,250,0.5)]" },
  lendario:    { label: "Lendário",  color: "text-amber-400",        bg: "bg-amber-500/15",    glow: "shadow-[0_0_16px_rgba(251,191,36,0.6)]" },
};
