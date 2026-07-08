import { BomComponent, BomItem } from "./types";

export interface BomComponentInput {
  id?: string;
  materialName: string;
  specModel: string;
  quantity: number;
}

export interface BomItemInput {
  id?: string;
  finishedMaterialName: string;
  finishedSpecModel: string;
  finishedPurchaseCost: number;
  components: BomComponentInput[];
}

export interface BomExplosion {
  finishedMaterialName: string;
  finishedSpecModel: string;
  finishedQuantity: number;
  finishedPurchaseCost: number;
  components: BomComponent[];
}

export function upsertBomItem(items: BomItem[], input: BomItemInput, now = new Date().toISOString()): BomItem[] {
  const existing = input.id ? items.find((item) => item.id === input.id) : undefined;
  const item = normalizeBomItem(input, existing, now);

  if (!existing) {
    return [...items, item];
  }

  return items.map((candidate) => (candidate.id === item.id ? item : candidate));
}

export function removeBomItem(items: BomItem[], id: string): BomItem[] {
  return items.filter((item) => item.id !== id);
}

export function explodeBomComponents(item: BomItem, finishedQuantity: number): BomExplosion {
  const quantity = roundQuantity(finishedQuantity);
  return {
    finishedMaterialName: item.finishedMaterialName,
    finishedSpecModel: item.finishedSpecModel,
    finishedQuantity: quantity,
    finishedPurchaseCost: roundMoney(item.finishedPurchaseCost * quantity),
    components: item.components.map((component) => ({
      ...component,
      quantity: roundQuantity(component.quantity * quantity)
    }))
  };
}

export function findBomItemByFinishedSpec(items: BomItem[], specModel: string): BomItem | undefined {
  const target = normalize(specModel);
  return items.find((item) => normalize(item.finishedSpecModel) === target);
}

function normalizeBomItem(input: BomItemInput, existing: BomItem | undefined, now: string): BomItem {
  const id = input.id?.trim() || existing?.id || makeId("bom", now);
  return {
    id,
    finishedMaterialName: input.finishedMaterialName.trim(),
    finishedSpecModel: input.finishedSpecModel.trim(),
    finishedPurchaseCost: roundMoney(input.finishedPurchaseCost),
    components: input.components.map((component, index) => normalizeComponent(component, id, index)),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
}

function normalizeComponent(component: BomComponentInput, bomId: string, index: number): BomComponent {
  return {
    id: component.id?.trim() || `${bomId}-component-${index + 1}`,
    materialName: component.materialName.trim(),
    specModel: component.specModel.trim(),
    quantity: roundQuantity(component.quantity)
  };
}

function makeId(prefix: string, now: string): string {
  const time = Date.parse(now);
  return `${prefix}-${Number.isFinite(time) ? time : 0}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function roundMoney(value: number): number {
  return Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value: number): number {
  return Math.round((safeNumber(value) + Number.EPSILON) * 10000) / 10000;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
