import { cookies } from "next/headers";
import { type Language, translations } from "./translations";

export function getServerTranslations() {
  const lang = (cookies().get("lang")?.value ?? "en") as Language;
  return { t: translations[lang], lang };
}
