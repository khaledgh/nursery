import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";
import ar from "./ar.json";
import en from "./en.json";
import sv from "./sv.json";

const RTL_LOCALES = new Set(["ar", "he", "fa", "ur"]);

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sv: { translation: sv },
    ar: { translation: ar },
  },
  lng: deviceLocale,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

/**
 * Switches language. Returns true when the layout direction changed —
 * React Native applies forceRTL only after an app restart, so the caller
 * should prompt the user to restart.
 */
export function applyLocale(locale: string): boolean {
  void i18n.changeLanguage(locale);
  const wantRTL = RTL_LOCALES.has(locale);
  if (wantRTL !== I18nManager.isRTL) {
    I18nManager.allowRTL(wantRTL);
    I18nManager.forceRTL(wantRTL);
    return true;
  }
  return false;
}

export default i18n;
