import { DeliveryRecord, Order, PurchaseRecord } from "./types";

let idCounter = 0;

const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

interface SampleOrderOptions {
  companyName?: string;
  orderDate?: string;
  specModel?: string;
  materialName?: string;
  lineQuantity?: number;
  unitPrice?: number;
  total?: number;
  deliveries?: number[];
  purchases?: Array<{ quantity: number; total: number; ratio: number; spec?: string; unitPrice?: number }>;
}

export function createSampleOrder(options: SampleOrderOptions = {}): Order {
  const createdAt = "2026-07-07T09:00:00.000Z";
  const quantity = options.lineQuantity ?? 100;
  const unitPrice = options.unitPrice ?? 12.5;
  const total = options.total ?? quantity * unitPrice;

  return {
    id: nextId("order"),
    orderNo: `ORD-${idCounter.toString().padStart(4, "0")}`,
    companyName: options.companyName ?? "上海启明有限公司",
    orderDate: options.orderDate ?? "2026-07-01",
    lines: [
      {
        id: nextId("line"),
        materialName: options.materialName ?? "轴承",
        specModel: options.specModel ?? "AB-12",
        quantity,
        unit: "个",
        taxIncludedUnitPrice: unitPrice,
        taxIncludedTotal: total,
        deliveries: (options.deliveries ?? []).map<DeliveryRecord>((deliveryQuantity, index) => ({
          id: nextId("delivery"),
          courierCompany: "顺丰",
          trackingNo: `SF${idCounter}${index}`,
          shipDate: "2026-07-03",
          quantity: deliveryQuantity
        })),
        purchases: (options.purchases ?? []).map<PurchaseRecord>((purchase, index) => ({
          id: nextId("purchase"),
          supplierName: index === 0 ? "线上五金供应商" : "本地供应商",
          taobaoOrderNo: `TB${idCounter}${index}`,
          purchaseDate: index === 0 ? "2026-07-02" : "2026-07-04",
          purchaseSpec: purchase.spec ?? "AB-12 单只",
          purchaseQuantity: purchase.quantity,
          purchaseUnit: "箱",
          purchaseUnitPrice: purchase.unitPrice ?? purchase.total / purchase.quantity,
          purchaseTotal: purchase.total,
          invoiceNeeded: "yes",
          conversionRatioToOrderUnit: purchase.ratio
        }))
      }
    ],
    createdAt,
    updatedAt: createdAt
  };
}

export function createSampleOrders(): Order[] {
  return [
    createSampleOrder({
      companyName: "上海启明有限公司",
      orderDate: "2026-07-01",
      lineQuantity: 100,
      unitPrice: 12.5,
      total: 1250,
      deliveries: [100],
      purchases: [{ quantity: 100, total: 750, ratio: 1, spec: "AB-12 单只", unitPrice: 7.5 }]
    }),
    createSampleOrder({
      companyName: "杭州星河设备有限公司",
      orderDate: "2026-07-05",
      lineQuantity: 80,
      unitPrice: 20.625,
      total: 1650,
      deliveries: [20],
      purchases: [{ quantity: 2, total: 500, ratio: 50, spec: "AB-12 整箱", unitPrice: 250 }]
    })
  ];
}
