"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { type Language, translations } from "./translations";

type TranslationShape = (typeof translations)[Language];

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationShape;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("pt");

  useEffect(() => {
    const stored = localStorage.getItem("lang") as Language | null;
    if (stored === "en" || stored === "pt") setLangState(stored);
  }, []);

  function setLang(l: Language) {
    setLangState(l);
    localStorage.setItem("lang", l);
    document.cookie = `lang=${l};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
