import { describe, expect, it } from "vitest";
import { formatCurrencyWithLanguage, resolveLanguageTag, translateWithLanguage } from "./core";

describe("i18n", () => {
  it("uses Simplified Chinese for Chinese system language tags", () => {
    expect(resolveLanguageTag("zh-CN")).toBe("zh-Hans");
    expect(resolveLanguageTag("zh-Hans")).toBe("zh-Hans");
    expect(resolveLanguageTag("zh-TW")).toBe("zh-Hans");
  });

  it("uses English for non-Chinese or missing language tags", () => {
    expect(resolveLanguageTag("en-US")).toBe("en");
    expect(resolveLanguageTag("fr-FR")).toBe("en");
    expect(resolveLanguageTag(undefined)).toBe("en");
  });

  it("translates app name and interpolates dynamic values", () => {
    expect(translateWithLanguage("common.appName", "en")).toBe("Order Ledger");
    expect(translateWithLanguage("common.appName", "zh-Hans")).toBe("订单台账");
    expect(translateWithLanguage("orders.materialNumber", "en", { number: 2 })).toBe("Material 2");
    expect(translateWithLanguage("orders.materialNumber", "zh-Hans", { number: 2 })).toBe("物料 2");
  });

  it("formats the same amount with the language-specific currency symbol", () => {
    expect(formatCurrencyWithLanguage(1234.5, "zh-Hans")).toBe("¥1234.50");
    expect(formatCurrencyWithLanguage(1234.5, "en")).toBe("$1234.50");
  });

  it("does not convert the stored amount", () => {
    expect(formatCurrencyWithLanguage(1, "en")).toBe("$1.00");
  });
});
