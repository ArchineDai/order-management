import { describe, expect, it } from "vitest";
import { parseOrdersFromCsvText } from "./orderImport";

describe("order CSV import", () => {
  it("maps common Chinese headers and merges rows with the same company, date and customer PO", () => {
    const csv = [
      "客户公司,订单日期,客户PO号,物料名称,规格型号,数量,单位,含税单价",
      "上海启明有限公司,2026/07/07,PO-001,轴承,AB-12,10,个,12.5",
      "上海启明有限公司,2026-07-07,PO-001,螺丝,M3,3,包,8.333",
      "杭州星河设备有限公司,2026年7月8日,PO-002,垫片,D-1,2,盒,5"
    ].join("\n");

    const orders = parseOrdersFromCsvText(csv);

    expect(orders).toHaveLength(2);
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

  it("maps common English headers and preserves provided tax totals", () => {
    const csv = [
      "Company Name,Order Date,Customer PO No,Material Name,Spec Model,Quantity,Unit,Tax Included Unit Price,Tax Included Total",
      "Acme Industrial,2026-07-09,PO-EN-1,Bearing,AB-12,4,pcs,11.25,45"
    ].join("\n");

    expect(parseOrdersFromCsvText(csv)).toEqual([
      {
        companyName: "Acme Industrial",
        orderDate: "2026-07-09",
        customerPoNo: "PO-EN-1",
        lines: [
          {
            materialName: "Bearing",
            specModel: "AB-12",
            quantity: 4,
            unit: "pcs",
            taxIncludedUnitPrice: 11.25,
            taxIncludedTotal: 45
          }
        ]
      }
    ]);
  });
});
