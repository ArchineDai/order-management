import { parseOrderOcrText, parsePurchaseOcrText } from "../domain/ocrParser";
import { OrderDraft, PurchaseDraft } from "../domain/types";

declare const require: (moduleName: string) => {
  isSupported?: boolean;
  extractTextFromImage?: (uri: string) => Promise<string[]>;
};

export interface RecognizedOrderDraft {
  rawText: string;
  draft: OrderDraft;
}

export interface RecognizedPurchaseDraft {
  rawText: string;
  draft: PurchaseDraft;
}

export function canRecognizeTextOnDevice(): boolean {
  return loadExtractor()?.isSupported === true;
}

export async function recognizeOrderDraftFromImage(uri: string): Promise<RecognizedOrderDraft> {
  const rawText = await recognizeRawText(uri);
  return {
    rawText,
    draft: parseOrderOcrText(rawText)
  };
}

export async function recognizePurchaseDraftFromImage(uri: string): Promise<RecognizedPurchaseDraft> {
  const rawText = await recognizeRawText(uri);
  return {
    rawText,
    draft: parsePurchaseOcrText(rawText)
  };
}

async function recognizeRawText(uri: string): Promise<string> {
  const extractor = loadExtractor();
  if (!extractor?.isSupported || !extractor.extractTextFromImage) {
    throw new Error("当前运行环境不支持本地 OCR，请使用 iOS/Android 真机或开发构建。");
  }
  const textLines = await extractor.extractTextFromImage(uri);
  return textLines.join("\n").trim();
}

function loadExtractor() {
  try {
    return require("expo-text-extractor");
  } catch {
    return null;
  }
}
