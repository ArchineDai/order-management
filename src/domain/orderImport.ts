import { NewOrderInput, NewOrderLineInput } from "./orderBuilders";

type OrderImportField =
  | "companyName"
  | "orderDate"
  | "customerPoNo"
  | "materialName"
  | "specModel"
  | "quantity"
  | "unit"
  | "taxIncludedUnitPrice"
  | "taxIncludedTotal";

export interface CsvOrderImportOptions {
  defaultOrderDate?: string;
  defaultUnit?: string;
}

const HEADER_ALIASES: Record<OrderImportField, string[]> = {
  companyName: ["客户公司", "客户", "公司", "公司名称", "购货单位", "买方", "company", "company name", "customer", "customer name"],
  orderDate: ["订单日期", "日期", "下单日期", "order date", "date"],
  customerPoNo: ["客户PO号", "客户采购单号", "采购单号", "订单号", "po", "po no", "po number", "customer po", "customer po no"],
  materialName: ["物料名称", "物料", "品名", "产品名称", "material", "material name", "item", "item name", "product"],
  specModel: ["规格型号", "规格", "型号", "spec", "spec model", "specification", "model"],
  quantity: ["数量", "订单数量", "qty", "quantity"],
  unit: ["单位", "unit"],
  taxIncludedUnitPrice: ["含税单价", "单价", "税价", "unit price", "tax included unit price", "price"],
  taxIncludedTotal: ["价税合计", "含税金额", "总价", "合计", "金额", "amount", "total", "tax included total"]
};

const NORMALIZED_ALIASES = Object.fromEntries(
  Object.entries(HEADER_ALIASES).flatMap(([field, aliases]) =>
    aliases.map((alias) => [normalizeHeader(alias), field as OrderImportField])
  )
);

export function parseOrdersFromCsvText(csvText: string, options: CsvOrderImportOptions = {}): NewOrderInput[] {
  const table = parseCsv(csvText);
  if (table.length < 2) return [];

  const fields = table[0].map((header) => NORMALIZED_ALIASES[normalizeHeader(header)]);
  const orders = new Map<string, NewOrderInput>();

  for (const row of table.slice(1)) {
    if (row.every((cell) => !cell.trim())) continue;

    const value = (field: OrderImportField): string => {
      const index = fields.indexOf(field);
      return index >= 0 ? (row[index] ?? "").trim() : "";
    };

    const companyName = value("companyName");
    const orderDate = normalizeDate(value("orderDate")) || options.defaultOrderDate || "";
    const customerPoNo = value("customerPoNo") || undefined;
    const quantity = parseNumber(value("quantity"));
    const taxIncludedUnitPrice = parseNumber(value("taxIncludedUnitPrice"));
    const explicitTotal = value("taxIncludedTotal");
    const line: NewOrderLineInput = {
      materialName: value("materialName"),
      specModel: value("specModel"),
      quantity,
      unit: value("unit") || options.defaultUnit || "个",
      taxIncludedUnitPrice,
      taxIncludedTotal: explicitTotal ? parseNumber(explicitTotal) : roundMoney(quantity * taxIncludedUnitPrice)
    };

    const key = [normalizeKey(companyName), orderDate, normalizeKey(customerPoNo)].join("|");
    const existing = orders.get(key);
    if (existing) {
      existing.lines = [...(existing.lines ?? []), line];
    } else {
      orders.set(key, {
        companyName,
        orderDate,
        customerPoNo,
        lines: [line]
      });
    }
  }

  return Array.from(orders.values());
}

function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((candidate) => candidate.some((value) => value.trim()));
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./\\()（）:：]/g, "");
}

function normalizeKey(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeDate(value: string): string {
  const match = value.trim().match(/(\d{4})[年/.\-](\d{1,2})[月/.\-](\d{1,2})/);
  if (!match) return value.trim();
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseNumber(value: string): number {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
