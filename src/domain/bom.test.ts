import { describe, expect, it } from "vitest";
import { explodeBomComponents, upsertBomItem } from "./bom";

describe("BOM domain helpers", () => {
  it("creates and updates editable BOM items with multiple components", () => {
    const created = upsertBomItem(
      [],
      {
        id: "bom-1",
        finishedMaterialName: " 控制箱 ",
        finishedSpecModel: " BOX-1 ",
        finishedPurchaseCost: 88.126,
        components: [
          { id: "component-1", materialName: " 轴承 ", specModel: " AB-12 ", quantity: 2 },
          { id: "component-2", materialName: "螺丝", specModel: "M3", quantity: 8 }
        ]
      },
      "2026-07-08T10:00:00.000Z"
    );

    expect(created[0]).toMatchObject({
      id: "bom-1",
      finishedMaterialName: "控制箱",
      finishedSpecModel: "BOX-1",
      finishedPurchaseCost: 88.13,
      createdAt: "2026-07-08T10:00:00.000Z",
      updatedAt: "2026-07-08T10:00:00.000Z"
    });
    expect(created[0].components).toEqual([
      { id: "component-1", materialName: "轴承", specModel: "AB-12", quantity: 2 },
      { id: "component-2", materialName: "螺丝", specModel: "M3", quantity: 8 }
    ]);

    const updated = upsertBomItem(
      created,
      {
        id: "bom-1",
        finishedMaterialName: "控制箱",
        finishedSpecModel: "BOX-1A",
        finishedPurchaseCost: 90,
        components: [{ id: "component-1", materialName: "轴承", specModel: "AB-12", quantity: 3 }]
      },
      "2026-07-09T10:00:00.000Z"
    );

    expect(updated[0]).toMatchObject({
      createdAt: "2026-07-08T10:00:00.000Z",
      updatedAt: "2026-07-09T10:00:00.000Z",
      finishedSpecModel: "BOX-1A"
    });
    expect(updated[0].components).toHaveLength(1);
  });

  it("explodes component quantities for a finished goods quantity and reports finished purchase cost", () => {
    const bomItem = upsertBomItem(
      [],
      {
        id: "bom-1",
        finishedMaterialName: "控制箱",
        finishedSpecModel: "BOX-1",
        finishedPurchaseCost: 88,
        components: [
          { id: "component-1", materialName: "轴承", specModel: "AB-12", quantity: 2 },
          { id: "component-2", materialName: "螺丝", specModel: "M3", quantity: 8 }
        ]
      },
      "2026-07-08T10:00:00.000Z"
    )[0];

    expect(explodeBomComponents(bomItem, 3)).toEqual({
      finishedMaterialName: "控制箱",
      finishedSpecModel: "BOX-1",
      finishedQuantity: 3,
      finishedPurchaseCost: 264,
      components: [
        { id: "component-1", materialName: "轴承", specModel: "AB-12", quantity: 6 },
        { id: "component-2", materialName: "螺丝", specModel: "M3", quantity: 24 }
      ]
    });
  });
});
