import { BomItem, Order } from "./types";

export type AutocompleteField = "companyName" | "materialName" | "specModel" | "purchaseSpec" | "supplierName" | "purchaseUnit";

export interface AutocompleteSources {
  orders?: Order[];
  bomItems?: BomItem[];
}

interface SuggestionCandidate {
  value: string;
  recency: number;
}

export function getAutocompleteSuggestions(
  sources: AutocompleteSources,
  field: AutocompleteField,
  query = "",
  limit = 10
): string[] {
  const candidates = new Map<string, SuggestionCandidate>();
  const term = normalize(query);

  const add = (value: string | undefined, recencyValue: string | undefined) => {
    const trimmed = (value ?? "").trim();
    if (!trimmed || (term && !normalize(trimmed).includes(term))) return;
    const key = normalize(trimmed);
    const recency = toTime(recencyValue);
    const existing = candidates.get(key);
    if (!existing || recency > existing.recency) {
      candidates.set(key, { value: trimmed, recency });
    }
  };

  for (const order of sources.orders ?? []) {
    const orderRecency = order.orderDate || order.updatedAt || order.createdAt;
    if (field === "companyName") add(order.companyName, orderRecency);

    for (const line of order.lines) {
      if (field === "materialName") add(line.materialName, orderRecency);
      if (field === "specModel") add(line.specModel, orderRecency);

      for (const purchase of line.purchases) {
        const purchaseRecency = latestRecency(purchase.purchaseDate, orderRecency);
        if (field === "purchaseSpec") add(purchase.purchaseSpec, purchaseRecency);
        if (field === "supplierName") add(purchase.supplierName, purchaseRecency);
        if (field === "purchaseUnit") add(purchase.purchaseUnit, purchaseRecency);
      }
    }
  }

  for (const item of sources.bomItems ?? []) {
    const recency = item.updatedAt || item.createdAt;
    if (field === "materialName") add(item.finishedMaterialName, recency);
    if (field === "specModel" || field === "purchaseSpec") add(item.finishedSpecModel, recency);

    for (const component of item.components) {
      if (field === "materialName") add(component.materialName, recency);
      if (field === "specModel" || field === "purchaseSpec") add(component.specModel, recency);
    }
  }

  return Array.from(candidates.values())
    .sort((a, b) => b.recency - a.recency || a.value.localeCompare(b.value, "zh-Hans-CN"))
    .slice(0, limit)
    .map((candidate) => candidate.value);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function toTime(value: string | undefined): number {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function latestRecency(first: string | undefined, second: string | undefined): string | undefined {
  return toTime(first) >= toTime(second) ? first : second;
}
