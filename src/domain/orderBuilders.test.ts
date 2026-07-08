import { describe, expect, it } from "vitest";
import {
  addDeliveryToOrder,
  addPurchaseToLine,
  createOrder,
  updateDeliveryRecord,
  markOrderCompleted,
  reopenOrder,
  updateOrder,
  updatePurchaseRecord,
  validateDeliveryInput,
  validateOrderInput
} from "./orderBuilders";

describe("order builders", () => {
  it("creates an order with multiple material lines and calculates missing tax totals", () => {
    const order = createOrder(
      {
        companyName: "上海启明有限公司",
        orderDate: "2026-07-07",
        customerPoNo: "PO-001",
        lines: [
          {
            materialName: "轴承",
            specModel: "AB-12",
            quantity: 10,
            unit: "个",
            taxIncludedUnitPrice: 12.5
          },
          {
            materialName: "螺丝",
            specModel: "M3",
            quantity: 3,
            unit: "包",
            taxIncludedUnitPrice: 8.333
          }
        ]
      },
      new Date("2026-07-07T08:00:00.000Z")
    );

    expect(order.lines).toHaveLength(2);
    expect(order.lines[0].taxIncludedTotal).toBe(125);
    expect(order.lines[1].taxIncludedTotal).toBe(25);
  });

  it("updates order header and line errors without removing delivery and purchase records", () => {
    const order = createOrder({
      companyName: "旧客户",
      orderDate: "2026-07-07",
      materialName: "轴承",
      specModel: "AB-12",
      quantity: 10,
      unit: "个",
      taxIncludedUnitPrice: 12
    });
    const withDelivery = addDeliveryToOrder([order], order.id, {
      trackingNo: "SF1",
      shipDate: "2026-07-08",
      lines: [{ lineId: order.lines[0].id, quantity: 2 }]
    });
    const withPurchase = addPurchaseToLine(withDelivery, order.id, order.lines[0].id, {
      purchaseDate: "2026-07-08",
      purchaseSpec: "AB-12",
      purchaseQuantity: 10,
      purchaseUnit: "个",
      purchaseUnitPrice: 5,
      invoiceNeeded: "yes",
      conversionRatioToOrderUnit: 1
    });

    const updated = updateOrder(withPurchase, order.id, {
      companyName: "新客户",
      orderDate: "2026-07-09",
      lines: [
        {
          id: order.lines[0].id,
          materialName: "轴承修正",
          specModel: "AB-12A",
          quantity: 12,
          unit: "个",
          taxIncludedUnitPrice: 13
        }
      ]
    });

    expect(updated[0].companyName).toBe("新客户");
    expect(updated[0].lines[0]).toMatchObject({
      materialName: "轴承修正",
      specModel: "AB-12A",
      quantity: 12,
      taxIncludedTotal: 156
    });
    expect(updated[0].lines[0].deliveries).toHaveLength(1);
    expect(updated[0].lines[0].purchases).toHaveLength(1);
  });

  it("adds one delivery document to multiple order lines and can correct a line delivery later", () => {
    const order = createOrder({
      companyName: "上海启明有限公司",
      orderDate: "2026-07-07",
      lines: [
        { materialName: "轴承", specModel: "AB-12", quantity: 10, unit: "个", taxIncludedUnitPrice: 12 },
        { materialName: "螺丝", specModel: "M3", quantity: 5, unit: "包", taxIncludedUnitPrice: 8 }
      ]
    });

    const withDelivery = addDeliveryToOrder([order], order.id, {
      courierCompany: "顺丰",
      trackingNo: "SF123",
      shipDate: "2026-07-08",
      lines: [
        { lineId: order.lines[0].id, quantity: 6 },
        { lineId: order.lines[1].id, quantity: 2 }
      ]
    });
    const deliveryId = withDelivery[0].lines[0].deliveries[0].id;
    const corrected = updateDeliveryRecord(withDelivery, order.id, order.lines[0].id, deliveryId, {
      trackingNo: "SF123",
      shipDate: "2026-07-08",
      quantity: 7
    });

    expect(withDelivery[0].lines[0].deliveries[0]).toMatchObject({ trackingNo: "SF123", quantity: 6 });
    expect(withDelivery[0].lines[1].deliveries[0]).toMatchObject({ trackingNo: "SF123", quantity: 2 });
    expect(corrected[0].lines[0].deliveries[0].quantity).toBe(7);
  });

  it("updates purchase errors including invoice yes/no after saving", () => {
    const order = createOrder({
      companyName: "上海启明有限公司",
      orderDate: "2026-07-07",
      materialName: "轴承",
      specModel: "AB-12",
      quantity: 10,
      unit: "个",
      taxIncludedUnitPrice: 12
    });
    const withPurchase = addPurchaseToLine([order], order.id, order.lines[0].id, {
      purchaseDate: "2026-07-08",
      purchaseSpec: "AB-12",
      purchaseQuantity: 10,
      purchaseUnit: "个",
      purchaseUnitPrice: 5,
      invoiceNeeded: "no",
      conversionRatioToOrderUnit: 1
    });
    const purchaseId = withPurchase[0].lines[0].purchases[0].id;

    const corrected = updatePurchaseRecord(withPurchase, order.id, order.lines[0].id, purchaseId, {
      purchaseDate: "2026-07-09",
      purchaseSpec: "AB-12 修正",
      purchaseQuantity: 12,
      purchaseUnit: "个",
      purchaseUnitPrice: 4.5,
      invoiceNeeded: "yes",
      conversionRatioToOrderUnit: 1
    });

    expect(corrected[0].lines[0].purchases[0]).toMatchObject({
      purchaseDate: "2026-07-09",
      purchaseSpec: "AB-12 修正",
      purchaseQuantity: 12,
      purchaseTotal: 54,
      invoiceNeeded: "yes"
    });
  });

  it("validates multiple order and delivery lines", () => {
    expect(
      validateOrderInput({
        companyName: "上海启明有限公司",
        orderDate: "2026-07-07",
        lines: [
          { materialName: "轴承", specModel: "AB-12", quantity: 1, unit: "个", taxIncludedUnitPrice: 12 },
          { materialName: "", specModel: "M3", quantity: 0, unit: "包", taxIncludedUnitPrice: 8 }
        ]
      })
    ).toEqual(["第 2 行物料名称不能为空", "第 2 行订单数量必须大于 0"]);

    expect(
      validateDeliveryInput({
        trackingNo: "SF123",
        shipDate: "2026-07-08",
        lines: [
          { lineId: "line-1", quantity: 0 },
          { lineId: "line-2", quantity: 3 }
        ]
      })
    ).toEqual([]);
  });

  it("marks an order completed and can reopen it without changing order lines", () => {
    const order = createOrder({
      companyName: "上海启明有限公司",
      orderDate: "2026-07-07",
      materialName: "轴承",
      specModel: "AB-12",
      quantity: 10,
      unit: "个",
      taxIncludedUnitPrice: 12
    });

    const completed = markOrderCompleted([order], order.id, "2026-07-09T10:00:00.000Z");

    expect(completed[0].completedAt).toBe("2026-07-09T10:00:00.000Z");
    expect(completed[0].lines).toEqual(order.lines);

    const reopened = reopenOrder(completed, order.id);

    expect(reopened[0].completedAt).toBeUndefined();
    expect(reopened[0].lines).toEqual(order.lines);
  });
});
