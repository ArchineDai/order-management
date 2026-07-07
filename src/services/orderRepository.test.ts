import { describe, expect, it } from "vitest";
import { createOrderRepository, KeyValueStorage } from "./orderRepository";
import { createSampleOrders } from "../domain/testFixtures";

function createMemoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    }
  };
}

describe("order repository", () => {
  it("returns an empty order list before any data is saved", async () => {
    const repository = createOrderRepository(createMemoryStorage());

    await expect(repository.load()).resolves.toEqual([]);
  });

  it("persists and reloads orders from key-value storage", async () => {
    const repository = createOrderRepository(createMemoryStorage());
    const orders = createSampleOrders();

    await repository.save(orders);

    await expect(repository.load()).resolves.toEqual(orders);
  });

  it("clears saved orders", async () => {
    const repository = createOrderRepository(createMemoryStorage());
    await repository.save(createSampleOrders());

    await repository.clear();

    await expect(repository.load()).resolves.toEqual([]);
  });
});
