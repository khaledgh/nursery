import type { Locale } from "../index";
import ar from "./ar";
import en, { type LegalContent, type Section } from "./en";
import fr from "./fr";

const content: Record<Locale, LegalContent> = { en, ar, fr };

export function getLegal(locale: Locale): LegalContent {
  return content[locale];
}

export type LegalPage = "privacy" | "support" | "delete-account";

export type { LegalContent, Section };
