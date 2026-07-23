import i18next from "i18next";
import { resources, SupportedLanguage } from "./resources";

export function resolveLanguageTag(languageTag?: string): SupportedLanguage {
  return languageTag?.toLowerCase().startsWith("zh") ? "zh-Hans" : "en";
}

export function formatCurrencyWithLanguage(value: number, language: SupportedLanguage): string {
  const symbol = language === "zh-Hans" ? "¥" : "$";
  return `${symbol}${value.toFixed(2)}`;
}

export function translateWithLanguage(key: string, language: SupportedLanguage, options: Record<string, unknown> = {}): string {
  const instance = i18next.createInstance();
  void instance.init({
    resources,
    lng: language,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    },
    compatibilityJSON: "v4",
    initAsync: false
  });
  return instance.t(key, options);
}
