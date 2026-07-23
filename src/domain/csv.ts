import { buildInventoryRows, summarizeLine } from "./calculations";
import { Order } from "./types";

export interface CsvExport {
  filename: string;
  content: string;
}

export interface CsvExportBundle {
  orders: CsvExport;
  deliveries: CsvExport;
  purchases: CsvExport;
  inventory: CsvExport;
}

export function buildCsvExports(orders: Order[]): CsvExportBundle {
  return {
    orders: {
      filename: "orders.csv",
      content: toCsv(
        ["订单编号", "客户公司", "订单日期", "物料名称", "规格型号", "订单数量", "单位", "含税单价", "价税合计", "已送数量", "欠货数量", "状态"],
        orders.flatMap((order) =>
          order.lines.map((line) => {
            const summary = summarizeLine(order, line);
            return [
              order.orderNo,
              order.companyName,
              order.orderDate,
              line.materialName,
              line.specModel,
              line.quantity,
              line.unit,
              line.taxIncludedUnitPrice,
              line.taxIncludedTotal,
              summary.deliveredQuantity,
              summary.backorderQuantity,
              summary.status
            ];
          })
        )
      )
    },
    deliveries: {
      filename: "deliveries.csv",
      content: toCsv(
        ["订单编号", "客户公司", "规格型号", "快递公司", "快递单号", "发货日期", "送货数量", "备注"],
        orders.flatMap((order) =>
          order.lines.flatMap((line) =>
            line.deliveries.map((delivery) => [
              order.orderNo,
              order.companyName,
              line.specModel,
              delivery.courierCompany ?? "",
              delivery.trackingNo,
              delivery.shipDate,
              delivery.quantity,
              delivery.note ?? ""
            ])
          )
        )
      )
    },
    purchases: {
      filename: "purchases.csv",
      content: toCsv(
        ["订单编号", "客户公司", "规格型号", "供应商/店铺", "供应商订单号", "买入日期", "买入规格", "买入数量", "买入单位", "买入单价", "买入总价", "是否需要采购发票", "换算比例"],
        orders.flatMap((order) =>
          order.lines.flatMap((line) =>
            line.purchases.map((purchase) => [
              order.orderNo,
              order.companyName,
              line.specModel,
              purchase.supplierName ?? "",
              purchase.taobaoOrderNo ?? "",
              purchase.purchaseDate,
              purchase.purchaseSpec,
              purchase.purchaseQuantity,
              purchase.purchaseUnit,
              purchase.purchaseUnitPrice,
              purchase.purchaseTotal,
              invoiceLabel(purchase.invoiceNeeded),
              purchase.conversionRatioToOrderUnit
            ])
          )
        )
      )
    },
    inventory: {
      filename: "inventory.csv",
      content: toCsv(
        ["规格型号", "物料名称", "订单数量", "已送数量", "买入折算数量", "库存结余", "欠货数量"],
        buildInventoryRows(orders).map((row) => [
          row.specModel,
          row.materialNames.join(" / "),
          row.orderedQuantity,
          row.deliveredQuantity,
          row.purchasedInOrderUnit,
          row.inventoryBalance,
          row.backorderQuantity
        ])
      )
    }
  };
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers.join(","), ...rows.map((row) => row.map(formatCell).join(","))].join("\n");
}

function formatCell(value: string | number): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function invoiceLabel(value: string): string {
  if (value === "yes") return "是";
  if (value === "no") return "否";
  return "未知";
}
