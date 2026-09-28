import ar from "./ar";
import en, { type Dict } from "./en";
import fr from "./fr";

export const locales = ["en", "ar", "fr"] as const;
export type Locale = (typeof locales)[number];

const dicts: Record<Locale, Dict> = { en, ar, fr };

export const localeNames: Record<Locale, string> = { en: "English", ar: "العربية", fr: "Français" };

export function getDict(locale: Locale): Dict {
  return dicts[locale];
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function localePath(locale: Locale): string {
  return locale === "en" ? "/" : `/${locale}/`;
}

export type { Dict };
