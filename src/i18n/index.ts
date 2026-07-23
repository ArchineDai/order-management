import i18next from "i18next";
import { TOptions } from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";
import { formatCurrencyWithLanguage, resolveLanguageTag } from "./core";
import { resources } from "./resources";

export function initI18n() {
  if (i18next.isInitialized) return i18next;
  const deviceLanguage = getLocales()[0]?.languageTag ?? getLocales()[0]?.languageCode;
  void i18next.use(initReactI18next).init({
    resources,
    lng: resolveLanguageTag(deviceLanguage),
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    },
    compatibilityJSON: "v4"
  });
  return i18next;
}

export function translate(key: string, options?: TOptions): string {
  initI18n();
  return i18next.t(key, options);
}

export function formatCurrency(value: number): string {
  const language = initI18n().language === "zh-Hans" ? "zh-Hans" : "en";
  return formatCurrencyWithLanguage(value, language);
}

initI18n();
