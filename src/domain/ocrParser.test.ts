import { describe, expect, it } from "vitest";
import { parseOrderOcrText, parsePurchaseOcrText } from "./ocrParser";

describe("OCR text parser", () => {
  it("creates an editable order draft from recognized purchase order text", () => {
    const draft = parseOrderOcrText(`
      客户：上海启明有限公司
      订单日期：2026年07月01日
      物料：轴承
      规格型号：AB-12
      数量：100
      单位：个
      含税单价：12.50
      价税合计：1250.00
    `);

    expect(draft.companyName).toBe("上海启明有限公司");
    expect(draft.orderDate).toBe("2026-07-01");
    expect(draft.lines[0]).toMatchObject({
      materialName: "轴承",
      specModel: "AB-12",
      quantity: 100,
      unit: "个",
      taxIncludedUnitPrice: 12.5,
      taxIncludedTotal: 1250
    });
    expect(draft.uncertainFields).toEqual([]);
  });

  it("flags missing order fields as fields requiring manual confirmation", () => {
    const draft = parseOrderOcrText("客户：上海启明有限公司\n规格型号：AB-12");

    expect(draft.uncertainFields).toEqual(
      expect.arrayContaining(["orderDate", "materialName", "quantity", "taxIncludedUnitPrice"])
    );
  });

  it("creates an editable purchase draft from recognized Taobao screenshot text", () => {
    const draft = parsePurchaseOcrText(`
      店铺：淘宝五金旗舰店
      淘宝订单号：TB20260701001
      买入日期：2026/07/02
      买入规格：AB-12 整箱
      买入数量：2
      买入单位：箱
      买入单价：250
      买入总价：500
      采购发票：是
    `);

    expect(draft).toMatchObject({
      supplierName: "淘宝五金旗舰店",
      taobaoOrderNo: "TB20260701001",
      purchaseDate: "2026-07-02",
      purchaseSpec: "AB-12 整箱",
      purchaseQuantity: 2,
      purchaseUnit: "箱",
      purchaseUnitPrice: 250,
      purchaseTotal: 500,
      invoiceNeeded: "yes",
      uncertainFields: []
    });
  });
});
