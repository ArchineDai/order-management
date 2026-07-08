import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseOrdersFromImportedFile } from "./orderImportService";

describe("order import service", () => {
  it("parses CSV file text into grouped order inputs", () => {
    const orders = parseOrdersFromImportedFile({
      name: "orders.csv",
      content: [
        "客户公司,订单日期,客户PO号,物料名称,规格型号,数量,单位,含税单价",
        "上海启明有限公司,2026-07-07,PO-001,轴承,AB-12,10,个,12.5",
        "上海启明有限公司,2026-07-07,PO-001,螺丝,M3,3,包,8.333"
      ].join("\n"),
      encoding: "text"
    });

    expect(orders).toHaveLength(1);
    expect(orders[0].lines).toHaveLength(2);
  });

  it("parses the first worksheet from an Excel file into grouped order inputs", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["客户公司", "订单日期", "客户PO号", "物料名称", "规格型号", "数量", "单位", "含税单价"],
      ["上海启明有限公司", "2026-07-07", "PO-001", "轴承", "AB-12", 10, "个", 12.5],
      ["上海启明有限公司", "2026-07-07", "PO-001", "螺丝", "M3", 3, "包", 8.333]
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "订单");
    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" }) as string;

    const orders = parseOrdersFromImportedFile({
      name: "orders.xlsx",
      content: base64,
      encoding: "base64"
    });

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      companyName: "上海启明有限公司",
      orderDate: "2026-07-07",
      customerPoNo: "PO-001"
    });
    expect(orders[0].lines).toEqual([
      {
        materialName: "轴承",
        specModel: "AB-12",
        quantity: 10,
        unit: "个",
        taxIncludedUnitPrice: 12.5,
        taxIncludedTotal: 125
      },
      {
        materialName: "螺丝",
        specModel: "M3",
        quantity: 3,
        unit: "包",
        taxIncludedUnitPrice: 8.333,
        taxIncludedTotal: 25
      }
    ]);
  });
});
