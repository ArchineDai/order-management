import { DeliveryRecord, Order, OrderDraft, PurchaseDraft, PurchaseRecord } from "./types";

export interface NewOrderInput {
  companyName: string;
  customerPoNo?: string;
  orderDate: string;
  materialName: string;
  specModel: string;
  quantity: number;
  unit: string;
  taxIncludedUnitPrice: number;
  taxIncludedTotal?: number;
  note?: string;
  sourceImageUri?: string;
}

export interface NewDeliveryInput {
  courierCompany?: string;
  trackingNo: string;
  shipDate: string;
  quantity: number;
  note?: string;
}

export interface NewPurchaseInput {
  supplierName?: string;
  taobaoOrderNo?: string;
  purchaseDate: string;
  purchaseSpec: string;
  purchaseQuantity: number;
  purchaseUnit: string;
  purchaseUnitPrice: number;
  purchaseTotal?: number;
  invoiceNeeded: "yes" | "no" | "unknown";
  conversionRatioToOrderUnit: number;
  note?: string;
  attachmentUri?: string;
}

export function createOrder(input: NewOrderInput, now = new Date()): Order {
  const timestamp = now.toISOString();
  const orderId = makeId("order");
  const lineId = makeId("line");
  const total = input.taxIncludedTotal ?? roundMoney(input.quantity * input.taxIncludedUnitPrice);

  return {
    id: orderId,
    orderNo: makeOrderNo(now),
    companyName: input.companyName.trim(),
    customerPoNo: input.customerPoNo?.trim() || undefined,
    orderDate: input.orderDate,
    note: input.note?.trim() || undefined,
    sourceImage: input.sourceImageUri
      ? {
          id: makeId("att"),
          name: "采购单图片",
          dataUrl: input.sourceImageUri,
          createdAt: timestamp
        }
      : undefined,
    lines: [
      {
        id: lineId,
        materialName: input.materialName.trim(),
        specModel: input.specModel.trim(),
        quantity: input.quantity,
        unit: input.unit.trim() || "个",
        taxIncludedUnitPrice: input.taxIncludedUnitPrice,
        taxIncludedTotal: total,
        deliveries: [],
        purchases: []
      }
    ],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createOrderFromDraft(draft: OrderDraft): NewOrderInput {
  const line = draft.lines[0];
  return {
    companyName: draft.companyName,
    customerPoNo: draft.customerPoNo,
    orderDate: draft.orderDate,
    materialName: line.materialName,
    specModel: line.specModel,
    quantity: line.quantity,
    unit: line.unit,
    taxIncludedUnitPrice: line.taxIncludedUnitPrice,
    taxIncludedTotal: line.taxIncludedTotal,
    note: draft.rawText ? `OCR 草稿，需人工校对。\n${draft.rawText}` : undefined
  };
}

export function addDeliveryToLine(orders: Order[], orderId: string, lineId: string, input: NewDeliveryInput): Order[] {
  const delivery: DeliveryRecord = {
    id: makeId("delivery"),
    courierCompany: input.courierCompany?.trim() || undefined,
    trackingNo: input.trackingNo.trim(),
    shipDate: input.shipDate,
    quantity: input.quantity,
    note: input.note?.trim() || undefined
  };

  return updateLine(orders, orderId, lineId, (line) => ({
    ...line,
    deliveries: [...line.deliveries, delivery]
  }));
}

export function addPurchaseToLine(orders: Order[], orderId: string, lineId: string, input: NewPurchaseInput): Order[] {
  const purchase: PurchaseRecord = {
    id: makeId("purchase"),
    supplierName: input.supplierName?.trim() || undefined,
    taobaoOrderNo: input.taobaoOrderNo?.trim() || undefined,
    purchaseDate: input.purchaseDate,
    purchaseSpec: input.purchaseSpec.trim(),
    purchaseQuantity: input.purchaseQuantity,
    purchaseUnit: input.purchaseUnit.trim() || "个",
    purchaseUnitPrice: input.purchaseUnitPrice,
    purchaseTotal: input.purchaseTotal ?? roundMoney(input.purchaseQuantity * input.purchaseUnitPrice),
    invoiceNeeded: input.invoiceNeeded,
    conversionRatioToOrderUnit: input.conversionRatioToOrderUnit,
    note: input.note?.trim() || undefined,
    attachment: input.attachmentUri
      ? {
          id: makeId("att"),
          name: "淘宝截图",
          dataUrl: input.attachmentUri,
          createdAt: new Date().toISOString()
        }
      : undefined
  };

  return updateLine(orders, orderId, lineId, (line) => ({
    ...line,
    purchases: [...line.purchases, purchase]
  }));
}

export function removeOrder(orders: Order[], orderId: string): Order[] {
  return orders.filter((order) => order.id !== orderId);
}

export function validateOrderInput(input: NewOrderInput): string[] {
  return [
    !input.companyName.trim() && "客户公司不能为空",
    !input.orderDate && "订单日期不能为空",
    !input.materialName.trim() && "物料名称不能为空",
    !input.specModel.trim() && "规格型号不能为空",
    input.quantity <= 0 && "订单数量必须大于 0",
    input.taxIncludedUnitPrice <= 0 && "含税单价必须大于 0"
  ].filter(Boolean) as string[];
}

export function validateDeliveryInput(input: NewDeliveryInput): string[] {
  return [
    !input.trackingNo.trim() && "快递单号不能为空",
    !input.shipDate && "发货日期不能为空",
    input.quantity <= 0 && "送货数量必须大于 0"
  ].filter(Boolean) as string[];
}

export function validatePurchaseInput(input: NewPurchaseInput): string[] {
  return [
    !input.purchaseDate && "买入日期不能为空",
    !input.purchaseSpec.trim() && "买入规格不能为空",
    input.purchaseQuantity <= 0 && "买入数量必须大于 0",
    input.purchaseUnitPrice <= 0 && "买入单价必须大于 0",
    input.conversionRatioToOrderUnit <= 0 && "换算比例必须大于 0"
  ].filter(Boolean) as string[];
}

function updateLine(
  orders: Order[],
  orderId: string,
  lineId: string,
  updater: (line: Order["lines"][number]) => Order["lines"][number]
): Order[] {
  const now = new Date().toISOString();
  return orders.map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      updatedAt: now,
      lines: order.lines.map((line) => (line.id === lineId ? updater(line) : line))
    };
  });
}

function makeOrderNo(now: Date): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  return `ORD-${date}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
