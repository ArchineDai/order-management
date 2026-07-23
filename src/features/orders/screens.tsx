import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Pencil, Trash2 } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  filterInventoryRowsByTab,
  filterOrdersByStatusTab,
  InventoryTab,
  OrderStatusTab,
  searchBomItemsByMaterialOrSpec,
  searchInventoryRowsByMaterialOrSpec,
  searchOrdersByMaterialOrSpec
} from "../../domain/moduleFilters";
import { BomItem, InventoryRow, LineSummary, Order, OrderLine, PurchaseRecord } from "../../domain/types";
import {
  EmptyState,
  ImportStrip,
  Notice,
  OrderCard,
  SearchField,
  SectionTitle,
  SegmentTabs,
  StatTile,
  WorkspaceScreen,
  invoiceText,
  SmallButton,
  styles
} from "./components";
import { formatCurrency } from "../../i18n";
import { useOrderWorkspace } from "./workspace";

type PurchaseStatusTab = "invoiced" | "uninvoiced";
type BomTab = "finished" | "components";

type PurchaseItem = {
  order: Order;
  line: OrderLine;
  purchase: PurchaseRecord;
};

type ComponentBomRow = {
  id: string;
  bomId: string;
  materialName: string;
  finishedMaterialName: string;
  finishedSpec: string;
  componentSpec: string;
  quantity: number;
};

export function HomeScreen() {
  const workspace = useOrderWorkspace();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const searchedOrders = useMemo(() => searchOrdersByMaterialOrSpec(workspace.orders, search), [workspace.orders, search]);
  const visibleOrders = search.trim() ? searchedOrders : workspace.orders.slice(0, 3);

  return (
    <WorkspaceScreen title={t("home.title")} subtitle={t("home.subtitle")} onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <ImportStrip
        title={t("home.importTitle")}
        description={t("home.importDescription")}
        actionLabel={t("home.importAction")}
        onPress={workspace.openImportEntry}
      />
      <SearchField value={search} onChangeText={setSearch} />
      <View style={styles.statsGrid}>
        <StatTile label={t("home.orderLines")} value={workspace.summaries.length} tone="green" />
        <StatTile label={t("home.backorders")} value={workspace.backorders.length} tone="red" />
        <StatTile label={t("home.inventorySpecs")} value={workspace.inventoryRows.filter((row) => row.inventoryBalance > 0).length} tone="yellow" />
        <StatTile label={t("home.grossProfit")} value={formatCurrency(workspace.profit.grossProfit)} tone="blue" />
      </View>
      {!search.trim() ? (
        <>
          <SectionTitle title={t("home.needsAttention")} />
          {workspace.overDeliveries.map((summary) => (
            <Notice
              key={summary.lineId}
              text={t("home.overDeliveryNotice", {
                company: summary.companyName,
                spec: summary.specModel,
                quantity: Math.abs(summary.backorderQuantity)
              })}
            />
          ))}
          {workspace.lowInventory.map((row) => (
            <Notice key={row.specModel} text={t("home.lowInventoryNotice", { spec: row.specModel })} />
          ))}
          {workspace.overDeliveries.length === 0 && workspace.lowInventory.length === 0 ? <EmptyState text={t("home.noNotices")} /> : null}
        </>
      ) : null}
      <SectionTitle title={search.trim() ? t("home.searchResults") : t("home.recentOrders")} />
      {visibleOrders.length ? visibleOrders.map((order) => <OrderCard key={order.id} order={order} {...orderCardActions(workspace)} />) : <EmptyState text={t("home.noSearchResults")} />}
    </WorkspaceScreen>
  );
}

export function OrderManagementScreen() {
  const workspace = useOrderWorkspace();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<OrderStatusTab>("all");
  const searchedOrders = useMemo(() => searchOrdersByMaterialOrSpec(workspace.orders, search), [workspace.orders, search]);
  const options = useMemo(
    () =>
      ([
        { key: "all", label: t("orders.all") },
        { key: "undelivered", label: t("orders.undelivered") },
        { key: "partiallyDelivered", label: t("orders.partiallyDelivered") },
        { key: "delivered", label: t("orders.delivered") },
        { key: "completed", label: t("orders.completed") }
      ] as const).map((option) => ({
        ...option,
        count: filterOrdersByStatusTab(searchedOrders, option.key).length
      })),
    [searchedOrders, t]
  );
  const visibleOrders = filterOrdersByStatusTab(searchedOrders, active);

  return (
    <WorkspaceScreen title={t("orders.title")} subtitle={t("orders.subtitle")} onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <SearchField value={search} onChangeText={setSearch} />
      <SegmentTabs options={options} active={active} onChange={setActive} />
      {visibleOrders.length ? (
        visibleOrders.map((order) => <OrderCard key={order.id} order={order} {...orderCardActions(workspace)} />)
      ) : (
        <EmptyState text={t("orders.empty")} />
      )}
    </WorkspaceScreen>
  );
}

export function PurchaseManagementScreen() {
  const workspace = useOrderWorkspace();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<PurchaseStatusTab>("uninvoiced");
  const purchaseItems = useMemo(() => flattenPurchases(workspace.orders), [workspace.orders]);
  const searchedItems = useMemo(() => purchaseItems.filter((item) => itemMatchesSearch(item, search)), [purchaseItems, search]);
  const options = [
    { key: "invoiced" as const, label: t("purchases.invoiced"), count: searchedItems.filter((item) => item.purchase.invoiceNeeded === "yes").length },
    { key: "uninvoiced" as const, label: t("purchases.uninvoiced"), count: searchedItems.filter((item) => item.purchase.invoiceNeeded !== "yes").length }
  ];
  const visibleItems = searchedItems.filter((item) =>
    active === "invoiced" ? item.purchase.invoiceNeeded === "yes" : item.purchase.invoiceNeeded !== "yes"
  );

  return (
    <WorkspaceScreen title={t("purchases.title")} subtitle={t("purchases.subtitle")} onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <ImportStrip
        title={t("purchases.importTitle")}
        description={t("purchases.importDescription")}
        actionLabel={t("purchases.importAction")}
        onPress={() => Alert.alert(t("purchases.alertTitle"), t("purchases.alertMessage"))}
      />
      <SearchField value={search} onChangeText={setSearch} />
      <SegmentTabs options={options} active={active} onChange={setActive} />
      {visibleItems.length ? (
        visibleItems.map((item) => (
          <PurchaseRecordCard
            key={item.purchase.id}
            item={item}
            onPress={() => workspace.openEditPurchase(item.order, item.line, item.purchase.id)}
          />
        ))
      ) : (
        <EmptyState text={t("purchases.empty")} />
      )}
    </WorkspaceScreen>
  );
}

export function InventoryManagementScreen() {
  const workspace = useOrderWorkspace();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<InventoryTab>("backorder");
  const searchedRows = useMemo(() => searchInventoryRowsByMaterialOrSpec(workspace.inventoryRows, search), [workspace.inventoryRows, search]);
  const options = [
    { key: "zeroStock" as const, label: t("inventory.zeroStock"), count: filterInventoryRowsByTab(searchedRows, "zeroStock").length },
    { key: "inStock" as const, label: t("inventory.inStock"), count: filterInventoryRowsByTab(searchedRows, "inStock").length },
    { key: "backorder" as const, label: t("inventory.backorder"), count: filterInventoryRowsByTab(searchedRows, "backorder").length }
  ];
  const visibleRows = filterInventoryRowsByTab(searchedRows, active);

  return (
    <WorkspaceScreen title={t("inventory.title")} subtitle={t("inventory.subtitle")} onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <SearchField value={search} onChangeText={setSearch} />
      <SegmentTabs options={options} active={active} onChange={setActive} />
      {visibleRows.length ? visibleRows.map((row) => <InventoryCard key={row.specModel} row={row} />) : <EmptyState text={t("inventory.empty")} />}
    </WorkspaceScreen>
  );
}

export function BomScreen() {
  const workspace = useOrderWorkspace();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<BomTab>("finished");
  const finishedRows = useMemo(() => searchBomItemsByMaterialOrSpec(workspace.bomItems, search), [workspace.bomItems, search]);
  const searchedComponents = useMemo(() => buildComponentBomRows(finishedRows), [finishedRows]);
  const options = [
    { key: "finished" as const, label: t("bom.finished"), count: finishedRows.length },
    { key: "components" as const, label: t("bom.components"), count: searchedComponents.length }
  ];

  return (
    <WorkspaceScreen title={t("bom.title")} subtitle={t("bom.subtitle")} onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <ImportStrip
        title={t("bom.importTitle")}
        description={t("bom.importDescription")}
        actionLabel={t("bom.importAction")}
        onPress={workspace.openNewBom}
      />
      <SearchField value={search} onChangeText={setSearch} />
      <SegmentTabs options={options} active={active} onChange={setActive} />
      {active === "finished" ? (
        finishedRows.length ? (
          finishedRows.map((item) => (
            <BomItemCard
              key={item.id}
              item={item}
              onEdit={() => workspace.openEditBom(item)}
              onDelete={() => workspace.deleteBom(item)}
            />
          ))
        ) : (
          <EmptyState text={t("bom.emptyFinished")} />
        )
      ) : searchedComponents.length ? (
        searchedComponents.map((row) => <ComponentBomCard key={row.id} row={row} />)
      ) : (
        <EmptyState text={t("bom.emptyComponents")} />
      )}
    </WorkspaceScreen>
  );
}

export function MeScreen() {
  const workspace = useOrderWorkspace();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const visibleSummaries = useMemo(() => workspace.summaries.filter((summary) => summaryMatchesSearch(summary, search)), [workspace.summaries, search]);

  return (
    <WorkspaceScreen title={t("me.title")} subtitle={t("me.subtitle")} onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <SearchField value={search} onChangeText={setSearch} />
      <View style={styles.statsGrid}>
        <StatTile label={t("me.totalOrders")} value={workspace.profit.totalOrderCount} tone="green" />
        <StatTile label={t("me.salesTotal")} value={formatCurrency(workspace.profit.salesTotal)} tone="green" />
        <StatTile label={t("me.purchaseCost")} value={formatCurrency(workspace.profit.purchaseCost)} tone="yellow" />
        <StatTile label={t("me.totalProfit")} value={formatCurrency(workspace.profit.totalProfit)} tone="blue" />
        <StatTile label={t("me.currentMonthOrders")} value={workspace.profit.currentMonthOrderCount} tone="yellow" />
        <StatTile label={t("me.currentMonthProfit")} value={formatCurrency(workspace.profit.currentMonthProfit)} tone="red" />
      </View>
      <TrendCard
        title={t("me.monthlySalesTrend")}
        rows={workspace.profit.monthlySalesTrend.map((point) => ({ month: point.month, value: point.salesTotal }))}
      />
      <TrendCard
        title={t("me.monthlyProfitTrend")}
        rows={workspace.profit.monthlyProfitTrend.map((point) => ({ month: point.month, value: point.grossProfit }))}
      />
      <SectionTitle title={t("me.orderProfit")} />
      {visibleSummaries.length ? (
        visibleSummaries.map((summary) => (
          <View key={summary.lineId} style={styles.card}>
            <Text style={styles.cardTitle}>{summary.companyName}</Text>
            <Text style={styles.meta}>
              {summary.materialName} / {summary.specModel} / {summary.orderDate}
            </Text>
            <Text style={styles.strong}>
              {t("me.grossProfitAndMargin", {
                profit: formatCurrency(summary.grossProfit),
                margin: Math.round(summary.grossMarginRate * 1000) / 10
              })}
            </Text>
            <View style={styles.kvRow}>
              <Text style={styles.meta}>{t("me.salesTotal")}</Text>
              <Text style={styles.strong}>{formatCurrency(summary.taxIncludedTotal)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.meta}>{t("me.purchaseCost")}</Text>
              <Text style={styles.strong}>{formatCurrency(summary.purchaseTotal)}</Text>
            </View>
          </View>
        ))
      ) : (
        <EmptyState text={t("me.emptyProfit")} />
      )}
    </WorkspaceScreen>
  );
}

function PurchaseRecordCard({ item, onPress }: { item: PurchaseItem; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>{item.purchase.supplierName || item.order.companyName}</Text>
          <Text style={styles.meta}>
            {item.line.materialName} / {item.line.specModel}
          </Text>
        </View>
        <View style={styles.inlineEdit}>
          <Pencil color="#21413e" size={15} />
        </View>
      </View>
      <Text style={styles.strong}>
        {item.purchase.purchaseSpec} / {item.purchase.purchaseQuantity} {item.purchase.purchaseUnit}
      </Text>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("purchases.purchaseDate")}</Text>
        <Text style={styles.strong}>{item.purchase.purchaseDate}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("purchases.purchaseAmount")}</Text>
        <Text style={styles.strong}>{formatCurrency(item.purchase.purchaseTotal)}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("purchases.invoiceStatus")}</Text>
        <Text style={styles.strong}>{invoiceText(item.purchase.invoiceNeeded)}</Text>
      </View>
    </Pressable>
  );
}

function InventoryCard({ row }: { row: InventoryRow }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{row.specModel}</Text>
      <Text style={styles.meta}>{row.materialNames.join(" / ")}</Text>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("inventory.order")}</Text>
        <Text style={styles.strong}>{row.orderedQuantity}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("inventory.delivered")}</Text>
        <Text style={styles.strong}>{row.deliveredQuantity}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("inventory.purchasedConverted")}</Text>
        <Text style={styles.strong}>{row.purchasedInOrderUnit}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("inventory.balance")}</Text>
        <Text style={[styles.strong, row.inventoryBalance <= 0 && styles.dangerText]}>{row.inventoryBalance}</Text>
      </View>
      {row.purchaseSources.slice(0, 3).map((source) => (
        <Text key={`${source.orderNo}-${source.purchaseSpec}-${source.purchaseDate}`} style={styles.meta}>
          {t("inventory.source", {
            date: source.purchaseDate,
            company: source.companyName,
            spec: source.purchaseSpec,
            quantity: source.quantityInOrderUnit
          })}
        </Text>
      ))}
    </View>
  );
}

function BomItemCard({ item, onEdit, onDelete }: { item: BomItem; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>{item.finishedSpecModel}</Text>
          <Text style={styles.meta}>{t("bom.finishedLabel", { name: item.finishedMaterialName })}</Text>
        </View>
        <Pressable onPress={onEdit} style={styles.inlineEdit}>
          <Pencil color="#21413e" size={15} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.inlineEdit}>
          <Trash2 color="#a3392b" size={15} />
        </Pressable>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("bom.finishedPurchaseCost")}</Text>
        <Text style={styles.strong}>{formatCurrency(item.finishedPurchaseCost)}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("bom.componentCount")}</Text>
        <Text style={styles.strong}>{item.components.length}</Text>
      </View>
      {item.components.slice(0, 3).map((component) => (
        <Text key={component.id} style={styles.meta}>
          {component.materialName} / {component.specModel} x {component.quantity}
        </Text>
      ))}
    </View>
  );
}

function ComponentBomCard({ row }: { row: ComponentBomRow }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{row.componentSpec}</Text>
      <Text style={styles.meta}>
        {t("bom.componentDescription", {
          material: row.materialName,
          finished: row.finishedMaterialName,
          spec: row.finishedSpec
        })}
      </Text>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>{t("bom.perFinishedQuantity")}</Text>
        <Text style={styles.strong}>{row.quantity}</Text>
      </View>
    </View>
  );
}

function TrendCard({ title, rows }: { title: string; rows: Array<{ month: string; value: number }> }) {
  const { t } = useTranslation();
  const maxValue = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {rows.length ? (
        rows.map((row) => (
          <View key={row.month} style={{ gap: 5 }}>
            <View style={styles.kvRow}>
              <Text style={styles.meta}>{row.month}</Text>
              <Text style={styles.strong}>{formatCurrency(row.value)}</Text>
            </View>
            <View style={{ height: 8, borderRadius: 6, backgroundColor: "#edf1ea", overflow: "hidden" }}>
              <View
                style={{
                  width: `${Math.min(100, Math.round((Math.abs(row.value) / maxValue) * 100))}%`,
                  height: 8,
                  backgroundColor: row.value >= 0 ? "#e7563f" : "#a3392b"
                }}
              />
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.meta}>{t("me.noTrendData")}</Text>
      )}
    </View>
  );
}

function orderCardActions(workspace: ReturnType<typeof useOrderWorkspace>) {
  return {
    onEditOrder: workspace.openEditOrder,
    onDelivery: workspace.openDelivery,
    onEditDelivery: workspace.openEditDelivery,
    onPurchase: workspace.openPurchase,
    onEditPurchase: workspace.openEditPurchase,
    onDelete: workspace.deleteOrder,
    onComplete: workspace.completeOrder,
    onReopen: workspace.reopenCompletedOrder
  };
}

function flattenPurchases(orders: Order[]): PurchaseItem[] {
  return orders.flatMap((order) =>
    order.lines.flatMap((line) =>
      line.purchases.map((purchase) => ({
        order,
        line,
        purchase
      }))
    )
  );
}

function itemMatchesSearch(item: PurchaseItem, search: string): boolean {
  const term = normalize(search);
  if (!term) return true;
  return [item.line.materialName, item.line.specModel, item.purchase.purchaseSpec]
    .map(normalize)
    .some((value) => value.includes(term));
}

function summaryMatchesSearch(summary: LineSummary, search: string): boolean {
  const term = normalize(search);
  if (!term) return true;
  return normalize(summary.materialName).includes(term) || normalize(summary.specModel).includes(term);
}

function buildComponentBomRows(items: BomItem[]): ComponentBomRow[] {
  return items.flatMap((item) =>
    item.components.map((component) => ({
      id: component.id,
      bomId: item.id,
      materialName: component.materialName,
      finishedMaterialName: item.finishedMaterialName,
      finishedSpec: item.finishedSpecModel,
      componentSpec: component.specModel,
      quantity: component.quantity
    }))
  );
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
