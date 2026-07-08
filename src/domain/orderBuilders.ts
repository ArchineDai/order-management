import { DeliveryRecord, Order, OrderDraft, OrderDraftLine, PurchaseDraft, PurchaseRecord } from "./types";

export interface NewOrderLineInput {
  id?: string;
  materialName: string;
  specModel: string;
  quantity: number;
  unit: string;
  taxIncludedUnitPrice: number;
  taxIncludedTotal?: number;
}

export interface NewOrderInput {
  companyName: string;
  customerPoNo?: string;
  orderDate: string;
  lines?: NewOrderLineInput[];
  materialName?: string;
  specModel?: string;
  quantity?: number;
  unit?: string;
  taxIncludedUnitPrice?: number;
  taxIncludedTotal?: number;
  note?: string;
  sourceImageUri?: string;
}

export interface DeliveryLineInput {
  lineId: string;
  quantity: number;
}

export interface NewDeliveryInput {
  courierCompany?: string;
  trackingNo: string;
  shipDate: string;
  quantity?: number;
  lines?: DeliveryLineInput[];
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
  const lines = normalizeOrderLines(input);

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
    lines: lines.map((line) => buildOrderLine(line)),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createOrderFromDraft(draft: OrderDraft): NewOrderInput {
  return {
    companyName: draft.companyName,
    customerPoNo: draft.customerPoNo,
    orderDate: draft.orderDate,
    lines: draft.lines.map(draftLineToInput),
    note: draft.rawText ? `导入草稿，需人工校对。\n${draft.rawText}` : undefined
  };
}

export function updateOrder(orders: Order[], orderId: string, input: NewOrderInput): Order[] {
  const now = new Date().toISOString();
  const nextLines = normalizeOrderLines(input);

  return orders.map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      companyName: input.companyName.trim(),
      customerPoNo: input.customerPoNo?.trim() || undefined,
      orderDate: input.orderDate,
      note: input.note?.trim() || undefined,
      sourceImage: input.sourceImageUri
        ? order.sourceImage
          ? { ...order.sourceImage, dataUrl: input.sourceImageUri }
          : {
              id: makeId("att"),
              name: "采购单图片",
              dataUrl: input.sourceImageUri,
              createdAt: now
            }
        : order.sourceImage,
      lines: nextLines.map((line) => {
        const existing = line.id ? order.lines.find((candidate) => candidate.id === line.id) : undefined;
        const built = buildOrderLine(line, existing);
        return built;
      }),
      updatedAt: now
    };
  });
}

export function addDeliveryToLine(orders: Order[], orderId: string, lineId: string, input: NewDeliveryInput): Order[] {
  const delivery: DeliveryRecord = {
    id: makeId("delivery"),
    courierCompany: input.courierCompany?.trim() || undefined,
    trackingNo: input.trackingNo.trim(),
    shipDate: input.shipDate,
    quantity: input.quantity ?? 0,
    note: input.note?.trim() || undefined
  };

  return updateLine(orders, orderId, lineId, (line) => ({
    ...line,
    deliveries: [...line.deliveries, delivery]
  }));
}

export function addDeliveryToOrder(orders: Order[], orderId: string, input: NewDeliveryInput): Order[] {
  const deliveryGroupId = makeId("delivery");
  const lines = (input.lines ?? []).filter((line) => line.quantity > 0);
  return updateOrderLines(orders, orderId, (line) => {
    const target = lines.find((candidate) => candidate.lineId === line.id);
    if (!target) return line;
    const delivery: DeliveryRecord = {
      id: deliveryGroupId,
      courierCompany: input.courierCompany?.trim() || undefined,
      trackingNo: input.trackingNo.trim(),
      shipDate: input.shipDate,
      quantity: target.quantity,
      note: input.note?.trim() || undefined
    };
    return {
      ...line,
      deliveries: [...line.deliveries, delivery]
    };
  });
}

export function addPurchaseToLine(orders: Order[], orderId: string, lineId: string, input: NewPurchaseInput): Order[] {
  const purchase = buildPurchaseRecord(input);

  return updateLine(orders, orderId, lineId, (line) => ({
    ...line,
    purchases: [...line.purchases, purchase]
  }));
}

export function updateDeliveryRecord(
  orders: Order[],
  orderId: string,
  lineId: string,
  deliveryId: string,
  input: NewDeliveryInput
): Order[] {
  return updateLine(orders, orderId, lineId, (line) => ({
    ...line,
    deliveries: line.deliveries.map((delivery) =>
      delivery.id === deliveryId
        ? {
            ...delivery,
            courierCompany: input.courierCompany?.trim() || undefined,
            trackingNo: input.trackingNo.trim(),
            shipDate: input.shipDate,
            quantity: input.quantity ?? delivery.quantity,
            note: input.note?.trim() || undefined
          }
        : delivery
    )
  }));
}

export function updatePurchaseRecord(
  orders: Order[],
  orderId: string,
  lineId: string,
  purchaseId: string,
  input: NewPurchaseInput
): Order[] {
  return updateLine(orders, orderId, lineId, (line) => ({
    ...line,
    purchases: line.purchases.map((purchase) =>
      purchase.id === purchaseId
        ? {
            ...buildPurchaseRecord(input, purchase),
            id: purchase.id,
            attachment: input.attachmentUri
              ? {
                  id: purchase.attachment?.id ?? makeId("att"),
                  name: purchase.attachment?.name ?? "淘宝截图",
                  dataUrl: input.attachmentUri,
                  createdAt: purchase.attachment?.createdAt ?? new Date().toISOString()
                }
              : purchase.attachment
          }
        : purchase
    )
  }));
}

export function removeOrder(orders: Order[], orderId: string): Order[] {
  return orders.filter((order) => order.id !== orderId);
}

export function markOrderCompleted(orders: Order[], orderId: string, completedAt = new Date().toISOString()): Order[] {
  return orders.map((order) =>
    order.id === orderId
      ? {
          ...order,
          completedAt,
          updatedAt: completedAt
        }
      : order
  );
}

export function reopenOrder(orders: Order[], orderId: string, reopenedAt = new Date().toISOString()): Order[] {
  return orders.map((order) => {
    if (order.id !== orderId) return order;
    const { completedAt, ...openOrder } = order;
    return {
      ...openOrder,
      updatedAt: reopenedAt
    };
  });
}

export function validateOrderInput(input: NewOrderInput): string[] {
  const errors = [
    !input.companyName.trim() && "客户公司不能为空",
    !input.orderDate && "订单日期不能为空"
  ].filter(Boolean) as string[];
  const lines = normalizeOrderLines(input);
  if (!lines.length) {
    errors.push("至少需要 1 行物料");
    return errors;
  }

  for (const [index, line] of lines.entries()) {
    const prefix = lines.length > 1 ? `第 ${index + 1} 行` : "";
    if (!line.materialName.trim()) errors.push(`${prefix}物料名称不能为空`);
    if (!line.specModel.trim()) errors.push(`${prefix}规格型号不能为空`);
    if (line.quantity <= 0) errors.push(`${prefix}订单数量必须大于 0`);
    if (line.taxIncludedUnitPrice <= 0) errors.push(`${prefix}含税单价必须大于 0`);
  }

  return errors;
}

export function validateDeliveryInput(input: NewDeliveryInput): string[] {
  const errors = [
    !input.trackingNo.trim() && "快递单号不能为空",
    !input.shipDate && "发货日期不能为空"
  ].filter(Boolean) as string[];
  if (input.lines?.length) {
    if (!input.lines.some((line) => line.quantity > 0)) {
      errors.push("至少填写 1 行送货数量");
    }
  } else if ((input.quantity ?? 0) <= 0) {
    errors.push("送货数量必须大于 0");
  }
  return errors;
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

function updateOrderLines(orders: Order[], orderId: string, updater: (line: Order["lines"][number]) => Order["lines"][number]): Order[] {
  const now = new Date().toISOString();
  return orders.map((order) => {
    if (order.id !== orderId) return order;
    return {
      ...order,
      updatedAt: now,
      lines: order.lines.map(updater)
    };
  });
}

function normalizeOrderLines(input: NewOrderInput): NewOrderLineInput[] {
  if (input.lines?.length) return input.lines;
  return [
    {
      materialName: input.materialName ?? "",
      specModel: input.specModel ?? "",
      quantity: input.quantity ?? 0,
      unit: input.unit ?? "个",
      taxIncludedUnitPrice: input.taxIncludedUnitPrice ?? 0,
      taxIncludedTotal: input.taxIncludedTotal
    }
  ];
}

function buildOrderLine(input: NewOrderLineInput, existing?: Order["lines"][number]): Order["lines"][number] {
  return {
    id: input.id ?? existing?.id ?? makeId("line"),
    materialName: input.materialName.trim(),
    specModel: input.specModel.trim(),
    quantity: input.quantity,
    unit: input.unit.trim() || "个",
    taxIncludedUnitPrice: input.taxIncludedUnitPrice,
    taxIncludedTotal: input.taxIncludedTotal ?? roundMoney(input.quantity * input.taxIncludedUnitPrice),
    deliveries: existing?.deliveries ?? [],
    purchases: existing?.purchases ?? []
  };
}

function buildPurchaseRecord(input: NewPurchaseInput, existing?: PurchaseRecord): PurchaseRecord {
  return {
    id: existing?.id ?? makeId("purchase"),
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
          id: existing?.attachment?.id ?? makeId("att"),
          name: existing?.attachment?.name ?? "淘宝截图",
          dataUrl: input.attachmentUri,
          createdAt: existing?.attachment?.createdAt ?? new Date().toISOString()
        }
      : existing?.attachment
  };
}

function draftLineToInput(line: OrderDraftLine): NewOrderLineInput {
  return {
    materialName: line.materialName,
    specModel: line.specModel,
    quantity: line.quantity,
    unit: line.unit,
    taxIncludedUnitPrice: line.taxIncludedUnitPrice,
    taxIncludedTotal: line.taxIncludedTotal
  };
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
