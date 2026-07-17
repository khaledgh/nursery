import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import sv from "./sv.json";
import ar from "./ar.json";

const RTL_LOCALES = new Set(["ar", "he", "fa", "ur"]);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sv: { translation: sv },
    ar: { translation: ar },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

/** Switches the UI language and flips document direction for RTL. */
export function applyLocale(locale: string) {
  void i18n.changeLanguage(locale);
  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", locale);
}

export default i18n;
