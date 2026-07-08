import { deliveredQuantity } from "./calculations";
import { BomItem, InventoryRow, InvoiceNeeded, Order, PurchaseRecord } from "./types";

export type OrderStatusTab = "all" | "undelivered" | "partiallyDelivered" | "delivered" | "completed";
export type PurchaseInvoiceTab = "all" | "invoiced" | "uninvoiced";
export type InventoryTab = "all" | "zeroStock" | "inStock" | "backorder";

export interface PurchaseManagementRow {
  orderId: string;
  orderNo: string;
  lineId: string;
  purchaseId: string;
  companyName: string;
  orderDate: string;
  materialName: string;
  specModel: string;
  purchaseSpec: string;
  purchaseDate: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseUnitPrice: number;
  purchaseTotal: number;
  invoiceNeeded: InvoiceNeeded;
}

export function filterOrdersByStatusTab(orders: Order[], tab: OrderStatusTab): Order[] {
  if (tab === "all") return orders;
  return orders.filter((order) => {
    if (tab === "completed") return Boolean(order.completedAt);
    if (order.completedAt) return false;
    if (tab === "undelivered") return isUndelivered(order);
    if (tab === "delivered") return isDelivered(order);
    return !isUndelivered(order) && !isDelivered(order);
  });
}

export function buildPurchaseRows(orders: Order[]): PurchaseManagementRow[] {
  return orders.flatMap((order) =>
    order.lines.flatMap((line) =>
      line.purchases.map((purchase) => ({
        orderId: order.id,
        orderNo: order.orderNo,
        lineId: line.id,
        purchaseId: purchase.id,
        companyName: order.companyName,
        orderDate: order.orderDate,
        materialName: line.materialName,
        specModel: line.specModel,
        purchaseSpec: purchase.purchaseSpec,
        purchaseDate: purchase.purchaseDate,
        purchaseQuantity: purchase.purchaseQuantity,
        purchaseUnit: purchase.purchaseUnit,
        purchaseUnitPrice: purchase.purchaseUnitPrice,
        purchaseTotal: purchase.purchaseTotal,
        invoiceNeeded: purchase.invoiceNeeded
      }))
    )
  );
}

export function filterPurchaseRowsByInvoiceTab(
  rows: PurchaseManagementRow[],
  tab: PurchaseInvoiceTab
): PurchaseManagementRow[] {
  if (tab === "all") return rows;
  return rows.filter((row) => (tab === "invoiced" ? row.invoiceNeeded === "yes" : row.invoiceNeeded !== "yes"));
}

export function filterInventoryRowsByTab(rows: InventoryRow[], tab: InventoryTab): InventoryRow[] {
  if (tab === "all") return rows;
  if (tab === "inStock") return rows.filter((row) => row.inventoryBalance > 0);
  if (tab === "backorder") return rows.filter((row) => row.backorderQuantity > 0 || row.inventoryBalance < 0);
  return rows.filter((row) => row.inventoryBalance === 0 && row.backorderQuantity <= 0);
}

export function searchOrdersByMaterialOrSpec(orders: Order[], keyword: string): Order[] {
  const term = normalize(keyword);
  if (!term) return orders;
  return orders.filter((order) =>
    order.lines.some((line) => matches(term, line.materialName, line.specModel))
  );
}

export function searchPurchaseRowsByMaterialOrSpec(rows: PurchaseManagementRow[], keyword: string): PurchaseManagementRow[] {
  const term = normalize(keyword);
  if (!term) return rows;
  return rows.filter((row) => matches(term, row.materialName, row.specModel, row.purchaseSpec));
}

export function searchInventoryRowsByMaterialOrSpec(rows: InventoryRow[], keyword: string): InventoryRow[] {
  const term = normalize(keyword);
  if (!term) return rows;
  return rows.filter((row) => matches(term, row.specModel, ...row.materialNames));
}

export function searchBomItemsByMaterialOrSpec(items: BomItem[], keyword: string): BomItem[] {
  const term = normalize(keyword);
  if (!term) return items;
  return items.filter((item) =>
    matches(term, item.finishedMaterialName, item.finishedSpecModel) ||
    item.components.some((component) => matches(term, component.materialName, component.specModel))
  );
}

function isUndelivered(order: Order): boolean {
  return order.lines.every((line) => deliveredQuantity(line) === 0);
}

function isDelivered(order: Order): boolean {
  return order.lines.length > 0 && order.lines.every((line) => deliveredQuantity(line) >= line.quantity);
}

function matches(term: string, ...values: string[]): boolean {
  return values.some((value) => normalize(value).includes(term));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
