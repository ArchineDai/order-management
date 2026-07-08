import { BomItem, Order } from "../domain/types";

const STORAGE_KEY = "order-management:v1.1:orders";
const BOM_STORAGE_KEY = "order-management:v1.2:bom-items";

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface OrderRepository {
  load(): Promise<Order[]>;
  save(orders: Order[]): Promise<void>;
  clear(): Promise<void>;
}

export interface BomRepository {
  load(): Promise<BomItem[]>;
  save(items: BomItem[]): Promise<void>;
  clear(): Promise<void>;
}

export function createOrderRepository(storage: KeyValueStorage, key = STORAGE_KEY): OrderRepository {
  return {
    async load() {
      const raw = await storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Order[];
      return Array.isArray(parsed) ? parsed : [];
    },
    async save(orders) {
      await storage.setItem(key, JSON.stringify(orders));
    },
    async clear() {
      await storage.removeItem(key);
    }
  };
}

export function createBomRepository(storage: KeyValueStorage, key = BOM_STORAGE_KEY): BomRepository {
  return {
    async load() {
      const raw = await storage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as BomItem[];
      return Array.isArray(parsed) ? parsed : [];
    },
    async save(items) {
      await storage.setItem(key, JSON.stringify(items));
    },
    async clear() {
      await storage.removeItem(key);
    }
  };
}
