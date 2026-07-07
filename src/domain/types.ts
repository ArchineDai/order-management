export type InvoiceNeeded = "yes" | "no" | "unknown";
export type OrderLineStatus = "pending" | "partial" | "complete" | "over";

export interface Attachment {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

export interface DeliveryRecord {
  id: string;
  courierCompany?: string;
  trackingNo: string;
  shipDate: string;
  quantity: number;
  note?: string;
  attachment?: Attachment;
}

export interface PurchaseRecord {
  id: string;
  supplierName?: string;
  taobaoOrderNo?: string;
  purchaseDate: string;
  purchaseSpec: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseUnitPrice: number;
  purchaseTotal: number;
  invoiceNeeded: InvoiceNeeded;
  conversionRatioToOrderUnit: number;
  note?: string;
  attachment?: Attachment;
}

export interface OrderLine {
  id: string;
  materialName: string;
  specModel: string;
  quantity: number;
  unit: string;
  taxIncludedUnitPrice: number;
  taxIncludedTotal: number;
  deliveries: DeliveryRecord[];
  purchases: PurchaseRecord[];
}

export interface Order {
  id: string;
  orderNo: string;
  companyName: string;
  customerPoNo?: string;
  orderDate: string;
  sourceImage?: Attachment;
  note?: string;
  lines: OrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface LineSummary {
  orderId: string;
  orderNo: string;
  lineId: string;
  companyName: string;
  orderDate: string;
  materialName: string;
  specModel: string;
  unit: string;
  orderQuantity: number;
  deliveredQuantity: number;
  backorderQuantity: number;
  purchasedInOrderUnit: number;
  inventoryBalance: number;
  taxIncludedUnitPrice: number;
  taxIncludedTotal: number;
  purchaseTotal: number;
  grossProfit: number;
  grossMarginRate: number;
  status: OrderLineStatus;
}

export interface InventoryRow {
  specModel: string;
  materialNames: string[];
  orderedQuantity: number;
  deliveredQuantity: number;
  purchasedInOrderUnit: number;
  inventoryBalance: number;
  backorderQuantity: number;
  purchaseSources: Array<{
    orderNo: string;
    companyName: string;
    purchaseSpec: string;
    purchaseDate: string;
    quantityInOrderUnit: number;
    purchaseUnitPrice: number;
  }>;
}

export interface SearchResult {
  orderId: string;
  lineId: string;
  orderNo: string;
  companyName: string;
  orderDate: string;
  materialName: string;
  specModel: string;
  quantity: number;
  taxIncludedUnitPrice: number;
  taxIncludedTotal: number;
  status: OrderLineStatus;
  purchases: PurchaseRecord[];
}

export interface OrderDraftLine {
  materialName: string;
  specModel: string;
  quantity: number;
  unit: string;
  taxIncludedUnitPrice: number;
  taxIncludedTotal: number;
}

export interface OrderDraft {
  companyName: string;
  customerPoNo?: string;
  orderDate: string;
  note?: string;
  lines: OrderDraftLine[];
  uncertainFields: string[];
  rawText?: string;
}

export interface PurchaseDraft {
  supplierName?: string;
  taobaoOrderNo?: string;
  purchaseDate: string;
  purchaseSpec: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseUnitPrice: number;
  purchaseTotal: number;
  invoiceNeeded: InvoiceNeeded;
  conversionRatioToOrderUnit: number;
  uncertainFields: string[];
  rawText?: string;
}

export interface ProfitSummary {
  salesTotal: number;
  purchaseTotal: number;
  grossProfit: number;
  grossMarginRate: number;
}
