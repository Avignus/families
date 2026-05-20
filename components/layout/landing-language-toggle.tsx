"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";

export function LandingLanguageToggle() {
  const { lang, setLang } = useLanguage();
  const router = useRouter();

  function switchTo(next: "pt" | "en") {
    if (next === lang) return;
    setLang(next);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => switchTo("pt")}
        title="Português"
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          lang === "pt"
            ? "text-foreground bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
        }`}
      >
        <span className="text-sm">🇧🇷</span> PT
      </button>
      <span className="text-muted-foreground/40 text-xs">|</span>
      <button
        onClick={() => switchTo("en")}
        title="English"
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
          lang === "en"
            ? "text-foreground bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
        }`}
      >
        <span className="text-sm">🇺🇸</span> EN
      </button>
    </div>
  );
}
