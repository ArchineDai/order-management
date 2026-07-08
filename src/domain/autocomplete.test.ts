import { describe, expect, it } from "vitest";
import { getAutocompleteSuggestions } from "./autocomplete";
import { createSampleOrder } from "./testFixtures";
import { BomItem } from "./types";

describe("autocomplete", () => {
  it("deduplicates suggestions and sorts them by most recent historical usage", () => {
    const older = createSampleOrder({
      companyName: "上海启明有限公司",
      orderDate: "2026-07-01",
      materialName: "轴承",
      specModel: "AB-12",
      purchases: [{ quantity: 10, total: 50, ratio: 1, spec: "AB-12 单只" }]
    });
    const newer = createSampleOrder({
      companyName: "上海启明有限公司",
      orderDate: "2026-07-05",
      materialName: "轴承",
      specModel: "AB-12",
      purchases: [{ quantity: 2, total: 100, ratio: 50, spec: "AB-12 整箱" }]
    });
    const other = createSampleOrder({
      companyName: "杭州星河设备有限公司",
      orderDate: "2026-07-03",
      materialName: "垫片",
      specModel: "D-1"
    });

    expect(getAutocompleteSuggestions({ orders: [older, newer, other] }, "companyName")).toEqual([
      "上海启明有限公司",
      "杭州星河设备有限公司"
    ]);
    expect(getAutocompleteSuggestions({ orders: [older, newer, other] }, "purchaseSpec", "AB")).toEqual([
      "AB-12 整箱",
      "AB-12 单只"
    ]);
  });

  it("uses BOM finished goods and component parts as suggestion sources", () => {
    const bomItems: BomItem[] = [
      {
        id: "bom-1",
        finishedMaterialName: "控制箱",
        finishedSpecModel: "BOX-1",
        finishedPurchaseCost: 88,
        components: [
          { id: "component-1", materialName: "轴承", specModel: "AB-12", quantity: 2 },
          { id: "component-2", materialName: "螺丝", specModel: "M3", quantity: 8 }
        ],
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-06T00:00:00.000Z"
      }
    ];

    expect(getAutocompleteSuggestions({ bomItems }, "materialName", "轴")).toEqual(["轴承"]);
    expect(getAutocompleteSuggestions({ bomItems }, "specModel", "box")).toEqual(["BOX-1"]);
  });
});
