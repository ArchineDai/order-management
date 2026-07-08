import { describe, expect, it } from "vitest";
import { buildInventoryRows } from "./calculations";
import {
  buildPurchaseRows,
  filterInventoryRowsByTab,
  filterOrdersByStatusTab,
  filterPurchaseRowsByInvoiceTab,
  searchBomItemsByMaterialOrSpec,
  searchInventoryRowsByMaterialOrSpec,
  searchOrdersByMaterialOrSpec,
  searchPurchaseRowsByMaterialOrSpec
} from "./moduleFilters";
import { createSampleOrder } from "./testFixtures";
import { BomItem } from "./types";

describe("module filters", () => {
  it("filters order management tabs by delivery and completion status", () => {
    const undelivered = createSampleOrder({ companyName: "未发客户", orderDate: "2026-07-01", deliveries: [] });
    const partial = createSampleOrder({ companyName: "部分客户", orderDate: "2026-07-02", lineQuantity: 10, deliveries: [4] });
    const delivered = createSampleOrder({ companyName: "已发客户", orderDate: "2026-07-03", lineQuantity: 10, deliveries: [10] });
    const completed = {
      ...createSampleOrder({ companyName: "完成客户", orderDate: "2026-07-04", lineQuantity: 10, deliveries: [10] }),
      completedAt: "2026-07-05T00:00:00.000Z"
    };
    const orders = [undelivered, partial, delivered, completed];

    expect(filterOrdersByStatusTab(orders, "all")).toHaveLength(4);
    expect(filterOrdersByStatusTab(orders, "undelivered").map((order) => order.companyName)).toEqual(["未发客户"]);
    expect(filterOrdersByStatusTab(orders, "partiallyDelivered").map((order) => order.companyName)).toEqual(["部分客户"]);
    expect(filterOrdersByStatusTab(orders, "delivered").map((order) => order.companyName)).toEqual(["已发客户"]);
    expect(filterOrdersByStatusTab(orders, "completed").map((order) => order.companyName)).toEqual(["完成客户"]);
  });

  it("builds purchase rows and filters invoice tabs", () => {
    const invoiced = createSampleOrder({
      companyName: "已票客户",
      purchases: [{ quantity: 1, total: 100, ratio: 1, spec: "AB-12 单只" }]
    });
    const uninvoiced = createSampleOrder({
      companyName: "未票客户",
      purchases: [{ quantity: 1, total: 50, ratio: 1, spec: "M3 单包" }]
    });
    uninvoiced.lines[0].purchases[0].invoiceNeeded = "no";

    const rows = buildPurchaseRows([invoiced, uninvoiced]);

    expect(filterPurchaseRowsByInvoiceTab(rows, "invoiced").map((row) => row.companyName)).toEqual(["已票客户"]);
    expect(filterPurchaseRowsByInvoiceTab(rows, "uninvoiced").map((row) => row.companyName)).toEqual(["未票客户"]);
  });

  it("filters inventory tabs and searches each section by material name or spec model", () => {
    const inStock = createSampleOrder({
      companyName: "库存客户",
      materialName: "轴承",
      specModel: "AB-12",
      lineQuantity: 10,
      deliveries: [5],
      purchases: [{ quantity: 12, total: 60, ratio: 1, spec: "AB-12 单只" }]
    });
    const zeroStock = createSampleOrder({
      companyName: "零库存客户",
      materialName: "垫片",
      specModel: "D-1",
      lineQuantity: 5,
      deliveries: [5],
      purchases: [{ quantity: 5, total: 20, ratio: 1, spec: "D-1 单只" }]
    });
    const backorder = createSampleOrder({
      companyName: "欠货客户",
      materialName: "螺丝",
      specModel: "M3",
      lineQuantity: 8,
      deliveries: [2],
      purchases: [{ quantity: 2, total: 8, ratio: 1, spec: "M3 单包" }]
    });
    const orders = [inStock, zeroStock, backorder];
    const inventoryRows = buildInventoryRows(orders);
    const purchaseRows = buildPurchaseRows(orders);
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

    expect(filterInventoryRowsByTab(inventoryRows, "inStock").map((row) => row.specModel)).toEqual(["AB-12"]);
    expect(filterInventoryRowsByTab(inventoryRows, "zeroStock").map((row) => row.specModel)).toEqual(["D-1"]);
    expect(filterInventoryRowsByTab(inventoryRows, "backorder").map((row) => row.specModel)).toEqual(["AB-12", "M3"]);
    expect(searchOrdersByMaterialOrSpec(orders, "垫片").map((order) => order.companyName)).toEqual(["零库存客户"]);
    expect(searchPurchaseRowsByMaterialOrSpec(purchaseRows, "m3").map((row) => row.purchaseSpec)).toEqual(["M3 单包"]);
    expect(searchInventoryRowsByMaterialOrSpec(inventoryRows, "AB").map((row) => row.specModel)).toEqual(["AB-12"]);
    expect(searchBomItemsByMaterialOrSpec(bomItems, "AB")).toEqual(bomItems);
  });
});
