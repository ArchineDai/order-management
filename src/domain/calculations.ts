import {
  InventoryRow,
  LineSummary,
  Order,
  OrderLine,
  OrderLineStatus,
  ProfitStatistics,
  ProfitSummary,
  SearchResult
} from "./types";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const quantity = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000;

export function deliveredQuantity(line: OrderLine): number {
  return quantity(line.deliveries.reduce((total, delivery) => total + safeNumber(delivery.quantity), 0));
}

export function purchasedInOrderUnit(line: OrderLine): number {
  return quantity(
    line.purchases.reduce(
      (total, purchase) =>
        total + safeNumber(purchase.purchaseQuantity) * safeRatio(purchase.conversionRatioToOrderUnit),
      0
    )
  );
}

export function purchaseTotal(line: OrderLine): number {
  return money(line.purchases.reduce((total, purchase) => total + safeNumber(purchase.purchaseTotal), 0));
}

export function lineStatus(line: OrderLine): OrderLineStatus {
  const delivered = deliveredQuantity(line);
  if (delivered === 0) return "pending";
  if (delivered > line.quantity) return "over";
  if (delivered === line.quantity) return "complete";
  return "partial";
}

export function summarizeLine(order: Order, line: OrderLine): LineSummary {
  const delivered = deliveredQuantity(line);
  const purchased = purchasedInOrderUnit(line);
  const cost = purchaseTotal(line);
  const sales = safeNumber(line.taxIncludedTotal);
  const profit = money(sales - cost);

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    lineId: line.id,
    companyName: order.companyName,
    orderDate: order.orderDate,
    materialName: line.materialName,
    specModel: line.specModel,
    unit: line.unit,
    orderQuantity: safeNumber(line.quantity),
    deliveredQuantity: delivered,
    backorderQuantity: quantity(safeNumber(line.quantity) - delivered),
    purchasedInOrderUnit: purchased,
    inventoryBalance: quantity(purchased - delivered),
    taxIncludedUnitPrice: money(line.taxIncludedUnitPrice),
    taxIncludedTotal: money(line.taxIncludedTotal),
    purchaseTotal: cost,
    grossProfit: profit,
    grossMarginRate: sales > 0 ? profit / sales : 0,
    status: lineStatus(line)
  };
}

export function summarizeOrders(orders: Order[]): LineSummary[] {
  const inventoryBalances = inventoryBalanceBySpec(orders);
  return orders.flatMap((order) =>
    order.lines.map((line) => ({
      ...summarizeLine(order, line),
      inventoryBalance: inventoryBalances.get(line.specModel) ?? 0
    }))
  );
}

function inventoryBalanceBySpec(orders: Order[]): Map<string, number> {
  const balances = new Map<string, number>();

  for (const order of orders) {
    for (const line of order.lines) {
      const balance = (balances.get(line.specModel) ?? 0) + purchasedInOrderUnit(line) - deliveredQuantity(line);
      balances.set(line.specModel, quantity(balance));
    }
  }

  return balances;
}

export function buildInventoryRows(orders: Order[]): InventoryRow[] {
  const rows = new Map<string, InventoryRow>();

  for (const order of orders) {
    for (const line of order.lines) {
      const current = rows.get(line.specModel) ?? {
        specModel: line.specModel,
        materialNames: [],
        orderedQuantity: 0,
        deliveredQuantity: 0,
        purchasedInOrderUnit: 0,
        inventoryBalance: 0,
        backorderQuantity: 0,
        purchaseSources: []
      };

      current.orderedQuantity = quantity(current.orderedQuantity + safeNumber(line.quantity));
      current.deliveredQuantity = quantity(current.deliveredQuantity + deliveredQuantity(line));
      current.purchasedInOrderUnit = quantity(current.purchasedInOrderUnit + purchasedInOrderUnit(line));
      if (!current.materialNames.includes(line.materialName)) {
        current.materialNames.push(line.materialName);
      }

      for (const purchase of line.purchases) {
        current.purchaseSources.push({
          orderNo: order.orderNo,
          companyName: order.companyName,
          purchaseSpec: purchase.purchaseSpec,
          purchaseDate: purchase.purchaseDate,
          quantityInOrderUnit: quantity(
            safeNumber(purchase.purchaseQuantity) * safeRatio(purchase.conversionRatioToOrderUnit)
          ),
          purchaseUnitPrice: money(purchase.purchaseUnitPrice)
        });
      }

      rows.set(line.specModel, current);
    }
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      inventoryBalance: quantity(row.purchasedInOrderUnit - row.deliveredQuantity),
      backorderQuantity: quantity(row.orderedQuantity - row.deliveredQuantity),
      purchaseSources: row.purchaseSources.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
    }))
    .sort((a, b) => a.specModel.localeCompare(b.specModel, "zh-Hans-CN"));
}

export function detectDuplicateOrder(
  existingOrders: Order[],
  draft: Pick<Order, "companyName" | "orderDate" | "lines">
): Array<{ order: Order; line: OrderLine }> {
  const company = normalize(draft.companyName);

  return existingOrders.flatMap((order) => {
    if (normalize(order.companyName) !== company || order.orderDate !== draft.orderDate) {
      return [];
    }

    return order.lines.flatMap((line) => {
      const duplicateLine = draft.lines.find(
        (candidate) =>
          normalize(candidate.specModel) === normalize(line.specModel) &&
          safeNumber(candidate.quantity) === safeNumber(line.quantity)
      );
      return duplicateLine ? [{ order, line }] : [];
    });
  });
}

export function searchHistory(orders: Order[], keyword: string): SearchResult[] {
  const term = normalize(keyword);
  if (!term) return [];

  return orders
    .flatMap((order) =>
      order.lines
        .filter((line) =>
          [order.orderNo, order.companyName, line.materialName, line.specModel]
            .map(normalize)
            .some((value) => value.includes(term))
        )
        .map((line) => ({
          orderId: order.id,
          lineId: line.id,
          orderNo: order.orderNo,
          companyName: order.companyName,
          orderDate: order.orderDate,
          materialName: line.materialName,
          specModel: line.specModel,
          quantity: line.quantity,
          taxIncludedUnitPrice: line.taxIncludedUnitPrice,
          taxIncludedTotal: line.taxIncludedTotal,
          status: lineStatus(line),
          purchases: [...line.purchases].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))
        }))
    )
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
}

export function calculateProfitSummary(orders: Order[]): ProfitSummary {
  const salesTotal = money(
    orders.reduce((total, order) => total + order.lines.reduce((lineTotal, line) => lineTotal + line.taxIncludedTotal, 0), 0)
  );
  const purchaseCost = money(
    orders.reduce((total, order) => total + order.lines.reduce((lineTotal, line) => lineTotal + purchaseTotal(line), 0), 0)
  );
  const grossProfit = money(salesTotal - purchaseCost);

  return {
    salesTotal,
    purchaseTotal: purchaseCost,
    grossProfit,
    grossMarginRate: salesTotal > 0 ? grossProfit / salesTotal : 0
  };
}

export function calculateProfitStatistics(orders: Order[], referenceDate: string | Date = new Date()): ProfitStatistics {
  const summary = calculateProfitSummary(orders);
  const currentMonth = monthKey(referenceDate);
  const monthlyRows = new Map<string, { orderCount: number; salesTotal: number; purchaseTotal: number }>();
  let currentMonthOrderCount = 0;
  let currentMonthProfit = 0;

  for (const order of orders) {
    const orderMonth = monthKey(order.orderDate);
    const salesTotal = money(order.lines.reduce((total, line) => total + safeNumber(line.taxIncludedTotal), 0));
    const purchaseCost = money(order.lines.reduce((total, line) => total + purchaseTotal(line), 0));
    const profit = money(salesTotal - purchaseCost);

    if (orderMonth) {
      const current = monthlyRows.get(orderMonth) ?? { orderCount: 0, salesTotal: 0, purchaseTotal: 0 };
      current.orderCount += 1;
      current.salesTotal = money(current.salesTotal + salesTotal);
      current.purchaseTotal = money(current.purchaseTotal + purchaseCost);
      monthlyRows.set(orderMonth, current);
    }

    if (orderMonth === currentMonth) {
      currentMonthOrderCount += 1;
      currentMonthProfit = money(currentMonthProfit + profit);
    }
  }

  const monthlyTrend = Array.from(monthlyRows.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({
      month,
      orderCount: row.orderCount,
      salesTotal: money(row.salesTotal),
      purchaseTotal: money(row.purchaseTotal),
      grossProfit: money(row.salesTotal - row.purchaseTotal)
    }));

  return {
    ...summary,
    totalOrderCount: orders.length,
    purchaseCost: summary.purchaseTotal,
    totalProfit: summary.grossProfit,
    currentMonthOrderCount,
    currentMonthProfit,
    monthlySalesTrend: monthlyTrend.map(({ month, salesTotal }) => ({ month, salesTotal })),
    monthlyProfitTrend: monthlyTrend.map(({ month, grossProfit }) => ({ month, grossProfit })),
    monthlyTrend
  };
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function safeRatio(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function monthKey(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 7);
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})[-/.年](\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}`;
}
