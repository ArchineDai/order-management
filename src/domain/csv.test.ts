import { describe, expect, it } from "vitest";
import { buildCsvExports } from "./csv";
import { createSampleOrders } from "./testFixtures";

describe("CSV export", () => {
  it("exports orders, deliveries, purchases and inventory as separate CSV payloads", () => {
    const exports = buildCsvExports(createSampleOrders());

    expect(exports.orders.filename).toBe("orders.csv");
    expect(exports.orders.content).toContain("订单编号,客户公司,订单日期,物料名称,规格型号");
    expect(exports.deliveries.content).toContain("快递单号,发货日期,送货数量");
    expect(exports.purchases.content).toContain("买入规格,买入数量,买入单位,买入单价,买入总价,是否需要采购发票");
    expect(exports.inventory.content).toContain("规格型号,物料名称,订单数量,已送数量,买入折算数量,库存结余,欠货数量");
  });

  it("escapes commas, quotes and line breaks for Excel-compatible CSV", () => {
    const exports = buildCsvExports(createSampleOrders());

    expect(exports.orders.content).toContain("\"上海启明有限公司\"");
    expect(exports.orders.content).not.toContain("undefined");
  });
});
