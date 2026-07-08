import { describe, expect, it } from "vitest";
import { createBomRepository, createOrderRepository, KeyValueStorage } from "./orderRepository";
import { createSampleOrders } from "../domain/testFixtures";
import { BomItem } from "../domain/types";

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

  it("persists BOM items independently from orders", async () => {
    const storage = createMemoryStorage();
    const orderRepository = createOrderRepository(storage);
    const bomRepository = createBomRepository(storage);
    const bomItems: BomItem[] = [
      {
        id: "bom-1",
        finishedMaterialName: "控制箱",
        finishedSpecModel: "BOX-1",
        finishedPurchaseCost: 88,
        components: [{ id: "component-1", materialName: "轴承", specModel: "AB-12", quantity: 2 }],
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z"
      }
    ];

    await orderRepository.save(createSampleOrders());
    await bomRepository.save(bomItems);

    await expect(bomRepository.load()).resolves.toEqual(bomItems);
    await expect(orderRepository.load()).resolves.toHaveLength(2);
  });
});
