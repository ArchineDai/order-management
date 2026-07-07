import { InvoiceNeeded, OrderDraft, OrderDraftLine, PurchaseDraft } from "./types";

export function parseOrderOcrText(rawText: string): OrderDraft {
  const text = normalizeWhitespace(rawText);
  const quantity = parseNumber(extract(text, ["数量", "订单数量"]));
  const unitPrice = parseNumber(extract(text, ["含税单价", "单价"]));
  const total = parseNumber(extract(text, ["价税合计", "合计", "总价"]));
  const line: OrderDraftLine = {
    materialName: extract(text, ["物料名称", "物料", "品名"]) ?? "",
    specModel: extract(text, ["规格型号", "规格", "型号"]) ?? "",
    quantity,
    unit: extract(text, ["单位"]) ?? "个",
    taxIncludedUnitPrice: unitPrice,
    taxIncludedTotal: total || roundMoney(quantity * unitPrice)
  };

  const draft: OrderDraft = {
    companyName: extract(text, ["客户公司", "客户", "公司", "购货单位", "买方"]) ?? "",
    customerPoNo: extract(text, ["采购单号", "订单号", "PO"]),
    orderDate: normalizeDate(extract(text, ["订单日期", "日期", "下单日期"]) ?? ""),
    lines: [line],
    uncertainFields: [],
    rawText
  };

  draft.uncertainFields = missingOrderFields(draft);
  return draft;
}

export function parsePurchaseOcrText(rawText: string): PurchaseDraft {
  const text = normalizeWhitespace(rawText);
  const quantity = parseNumber(extract(text, ["买入数量", "数量"]));
  const unitPrice = parseNumber(extract(text, ["买入单价", "单价"]));
  const total = parseNumber(extract(text, ["买入总价", "总价", "合计", "实付款"]));

  const draft: PurchaseDraft = {
    supplierName: extract(text, ["供应商", "店铺", "卖家"]),
    taobaoOrderNo: extract(text, ["淘宝订单号", "订单号"]),
    purchaseDate: normalizeDate(extract(text, ["买入日期", "下单日期", "日期"]) ?? ""),
    purchaseSpec: extract(text, ["买入规格", "规格型号", "规格"]) ?? "",
    purchaseQuantity: quantity,
    purchaseUnit: extract(text, ["买入单位", "单位"]) ?? "个",
    purchaseUnitPrice: unitPrice,
    purchaseTotal: total || roundMoney(quantity * unitPrice),
    invoiceNeeded: parseInvoiceNeeded(extract(text, ["采购发票", "是否需要采购发票", "发票"])),
    conversionRatioToOrderUnit: 1,
    uncertainFields: [],
    rawText
  };

  draft.uncertainFields = missingPurchaseFields(draft);
  return draft;
}

function extract(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:：]?\\s*([^\\n\\r]+)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[，,。;；]+$/, "");
    }
  }
  return undefined;
}

function parseNumber(value?: string): number {
  if (!value) return 0;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function normalizeDate(value: string): string {
  const match = value.match(/(\d{4})[年\/\-.](\d{1,2})[月\/\-.](\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseInvoiceNeeded(value?: string): InvoiceNeeded {
  if (!value) return "unknown";
  if (/是|需要|有|yes/i.test(value)) return "yes";
  if (/否|不|无|no/i.test(value)) return "no";
  return "unknown";
}

function missingOrderFields(draft: OrderDraft): string[] {
  const line = draft.lines[0];
  return [
    !draft.companyName && "companyName",
    !draft.orderDate && "orderDate",
    !line.materialName && "materialName",
    !line.specModel && "specModel",
    !line.quantity && "quantity",
    !line.taxIncludedUnitPrice && "taxIncludedUnitPrice"
  ].filter(Boolean) as string[];
}

function missingPurchaseFields(draft: PurchaseDraft): string[] {
  return [
    !draft.purchaseDate && "purchaseDate",
    !draft.purchaseSpec && "purchaseSpec",
    !draft.purchaseQuantity && "purchaseQuantity",
    !draft.purchaseUnitPrice && "purchaseUnitPrice",
    !draft.purchaseTotal && "purchaseTotal",
    draft.invoiceNeeded === "unknown" && "invoiceNeeded"
  ].filter(Boolean) as string[];
}

function normalizeWhitespace(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
