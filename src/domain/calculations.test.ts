import { describe, expect, it } from "vitest";
import {
  buildInventoryRows,
  calculateProfitStatistics,
  calculateProfitSummary,
  detectDuplicateOrder,
  searchHistory,
  summarizeLine,
  summarizeOrders
} from "./calculations";
import { createSampleOrder, createSampleOrders } from "./testFixtures";

describe("order calculations", () => {
  it("computes delivered quantity, shortage, status, purchased quantity and inventory balance", () => {
    const order = createSampleOrder({
      lineQuantity: 100,
      deliveries: [30, 70],
      purchases: [{ quantity: 60, total: 300, ratio: 2 }]
    });

    const summary = summarizeLine(order, order.lines[0]);

    expect(summary.deliveredQuantity).toBe(100);
    expect(summary.backorderQuantity).toBe(0);
    expect(summary.status).toBe("complete");
    expect(summary.purchasedInOrderUnit).toBe(120);
    expect(summary.inventoryBalance).toBe(20);
  });

  it("marks over-delivery when delivery quantity exceeds the order quantity", () => {
    const order = createSampleOrder({
      lineQuantity: 10,
      deliveries: [12],
      purchases: [{ quantity: 12, total: 120, ratio: 1 }]
    });

    expect(summarizeLine(order, order.lines[0]).status).toBe("over");
  });

  it("groups inventory by order specification and keeps purchase source details", () => {
    const rows = buildInventoryRows(createSampleOrders());

    expect(rows.find((row) => row.specModel === "AB-12")).toMatchObject({
      orderedQuantity: 180,
      deliveredQuantity: 120,
      purchasedInOrderUnit: 200,
      inventoryBalance: 80
    });
  });

  it("uses remaining inventory from an earlier order when a later order delivers the same specification", () => {
    const firstOrder = createSampleOrder({
      specModel: "AB-12",
      lineQuantity: 50,
      deliveries: [20],
      purchases: [{ quantity: 50, total: 500, ratio: 1 }]
    });
    const laterOrder = createSampleOrder({
      specModel: "AB-12",
      lineQuantity: 30,
      deliveries: [30],
      purchases: []
    });

    const laterSummary = summarizeOrders([firstOrder, laterOrder]).find((summary) => summary.orderId === laterOrder.id);

    expect(laterSummary).toMatchObject({
      deliveredQuantity: 30,
      backorderQuantity: 0,
      inventoryBalance: 0
    });
  });

  it("keeps a negative shared balance when deliveries exceed all shared inventory", () => {
    const order = createSampleOrder({
      specModel: "AB-12",
      lineQuantity: 60,
      deliveries: [60],
      purchases: [{ quantity: 50, total: 500, ratio: 1 }]
    });

    expect(summarizeOrders([order])[0].inventoryBalance).toBe(-10);
  });

  it("finds duplicate order lines by company, date, specification and quantity", () => {
    const existing = createSampleOrders();
    const duplicate = createSampleOrder({
      companyName: "上海启明有限公司",
      orderDate: "2026-07-01",
      specModel: "AB-12",
      lineQuantity: 100
    });

    const matches = detectDuplicateOrder(existing, duplicate);

    expect(matches).toHaveLength(1);
    expect(matches[0].line.specModel).toBe("AB-12");
  });

  it("searches sales and purchase history by specification and sorts newest first", () => {
    const results = searchHistory(createSampleOrders(), "AB-12");

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      companyName: "杭州星河设备有限公司",
      specModel: "AB-12",
      orderDate: "2026-07-05"
    });
    expect(results[0].purchases[0]).toMatchObject({
      purchaseSpec: "AB-12 整箱",
      purchaseUnitPrice: 250
    });
  });

  it("calculates gross profit and margin from order totals and purchase totals", () => {
    const summary = calculateProfitSummary(createSampleOrders());

    expect(summary.salesTotal).toBe(2900);
    expect(summary.purchaseTotal).toBe(1250);
    expect(summary.grossProfit).toBe(1650);
    expect(summary.grossMarginRate).toBeCloseTo(1650 / 2900, 5);
  });

  it("calculates total and current-month profit statistics with monthly trends", () => {
    const juneOrder = createSampleOrder({
      companyName: "苏州晨光制造有限公司",
      orderDate: "2026-06-28",
      lineQuantity: 40,
      unitPrice: 30,
      total: 1200,
      purchases: [{ quantity: 40, total: 700, ratio: 1, spec: "CD-20 单只", unitPrice: 17.5 }]
    });

    const statistics = calculateProfitStatistics([...createSampleOrders(), juneOrder], "2026-07-08");

    expect(statistics).toMatchObject({
      totalOrderCount: 3,
      salesTotal: 4100,
      purchaseCost: 1950,
      totalProfit: 2150,
      currentMonthOrderCount: 2,
      currentMonthProfit: 1650
    });
    expect(statistics.monthlySalesTrend).toEqual([
      { month: "2026-06", salesTotal: 1200 },
      { month: "2026-07", salesTotal: 2900 }
    ]);
    expect(statistics.monthlyProfitTrend).toEqual([
      { month: "2026-06", grossProfit: 500 },
      { month: "2026-07", grossProfit: 1650 }
    ]);
  });
});
