import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { Pencil, Trash2 } from "lucide-react-native";
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
  formatMoney,
  invoiceText,
  SmallButton,
  styles
} from "./components";
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
  const [search, setSearch] = useState("");
  const searchedOrders = useMemo(() => searchOrdersByMaterialOrSpec(workspace.orders, search), [workspace.orders, search]);
  const visibleOrders = search.trim() ? searchedOrders : workspace.orders.slice(0, 3);

  return (
    <WorkspaceScreen title="首页" subtitle="订单、采购、库存和利润总览" onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <ImportStrip
        title="导入业务资料"
        description="面向订单、买入凭证和明细文件的统一入口。"
        actionLabel="导入订单"
        onPress={workspace.openImportEntry}
      />
      <SearchField value={search} onChangeText={setSearch} />
      <View style={styles.statsGrid}>
        <StatTile label="订单行" value={workspace.summaries.length} tone="green" />
        <StatTile label="欠货" value={workspace.backorders.length} tone="red" />
        <StatTile label="库存规格" value={workspace.inventoryRows.filter((row) => row.inventoryBalance > 0).length} tone="yellow" />
        <StatTile label="毛利" value={`¥${formatMoney(workspace.profit.grossProfit)}`} tone="blue" />
      </View>
      {!search.trim() ? (
        <>
          <SectionTitle title="需要处理" />
          {workspace.overDeliveries.map((summary) => (
            <Notice key={summary.lineId} text={`${summary.companyName} ${summary.specModel} 已超发 ${Math.abs(summary.backorderQuantity)}`} />
          ))}
          {workspace.lowInventory.map((row) => (
            <Notice key={row.specModel} text={`${row.specModel} 有欠货且无可用库存，建议补采购。`} />
          ))}
          {workspace.overDeliveries.length === 0 && workspace.lowInventory.length === 0 ? <EmptyState text="暂无超发、欠货缺库存提醒。" /> : null}
        </>
      ) : null}
      <SectionTitle title={search.trim() ? "搜索结果" : "最近订单"} />
      {visibleOrders.length ? visibleOrders.map((order) => <OrderCard key={order.id} order={order} {...orderCardActions(workspace)} />) : <EmptyState text="没有匹配的物料或规格型号。" />}
    </WorkspaceScreen>
  );
}

export function OrderManagementScreen() {
  const workspace = useOrderWorkspace();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<OrderStatusTab>("all");
  const searchedOrders = useMemo(() => searchOrdersByMaterialOrSpec(workspace.orders, search), [workspace.orders, search]);
  const options = useMemo(
    () =>
      ([
        { key: "all", label: "全部" },
        { key: "undelivered", label: "未发货" },
        { key: "partiallyDelivered", label: "部分发货" },
        { key: "delivered", label: "已发货" },
        { key: "completed", label: "已完成" }
      ] as const).map((option) => ({
        ...option,
        count: filterOrdersByStatusTab(searchedOrders, option.key).length
      })),
    [searchedOrders]
  );
  const visibleOrders = filterOrdersByStatusTab(searchedOrders, active);

  return (
    <WorkspaceScreen title="订单管理" subtitle="按发货状态管理客户订单" onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <SearchField value={search} onChangeText={setSearch} />
      <SegmentTabs options={options} active={active} onChange={setActive} />
      {visibleOrders.length ? (
        visibleOrders.map((order) => <OrderCard key={order.id} order={order} {...orderCardActions(workspace)} />)
      ) : (
        <EmptyState text="当前条件下没有订单。" />
      )}
    </WorkspaceScreen>
  );
}

export function PurchaseManagementScreen() {
  const workspace = useOrderWorkspace();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<PurchaseStatusTab>("uninvoiced");
  const purchaseItems = useMemo(() => flattenPurchases(workspace.orders), [workspace.orders]);
  const searchedItems = useMemo(() => purchaseItems.filter((item) => itemMatchesSearch(item, search)), [purchaseItems, search]);
  const options = [
    { key: "invoiced" as const, label: "已开票", count: searchedItems.filter((item) => item.purchase.invoiceNeeded === "yes").length },
    { key: "uninvoiced" as const, label: "未开票", count: searchedItems.filter((item) => item.purchase.invoiceNeeded !== "yes").length }
  ];
  const visibleItems = searchedItems.filter((item) =>
    active === "invoiced" ? item.purchase.invoiceNeeded === "yes" : item.purchase.invoiceNeeded !== "yes"
  );

  return (
    <WorkspaceScreen title="采购管理" subtitle="按发票状态打开买入记录" onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <ImportStrip
        title="导入买入资料"
        description="买入记录挂在对应订单物料下，选择记录可直接打开编辑。"
        actionLabel="查看订单"
        onPress={() => Alert.alert("买入资料", "请在订单管理中打开对应物料的买入入口。")}
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
        <EmptyState text="当前条件下没有买入记录。" />
      )}
    </WorkspaceScreen>
  );
}

export function InventoryManagementScreen() {
  const workspace = useOrderWorkspace();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<InventoryTab>("backorder");
  const searchedRows = useMemo(() => searchInventoryRowsByMaterialOrSpec(workspace.inventoryRows, search), [workspace.inventoryRows, search]);
  const options = [
    { key: "zeroStock" as const, label: "0库存", count: filterInventoryRowsByTab(searchedRows, "zeroStock").length },
    { key: "inStock" as const, label: "有库存", count: filterInventoryRowsByTab(searchedRows, "inStock").length },
    { key: "backorder" as const, label: "欠货", count: filterInventoryRowsByTab(searchedRows, "backorder").length }
  ];
  const visibleRows = filterInventoryRowsByTab(searchedRows, active);

  return (
    <WorkspaceScreen title="库存管理" subtitle="按规格跟踪库存、欠货和买入来源" onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <SearchField value={search} onChangeText={setSearch} />
      <SegmentTabs options={options} active={active} onChange={setActive} />
      {visibleRows.length ? visibleRows.map((row) => <InventoryCard key={row.specModel} row={row} />) : <EmptyState text="当前条件下没有库存记录。" />}
    </WorkspaceScreen>
  );
}

export function BomScreen() {
  const workspace = useOrderWorkspace();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<BomTab>("finished");
  const finishedRows = useMemo(() => searchBomItemsByMaterialOrSpec(workspace.bomItems, search), [workspace.bomItems, search]);
  const searchedComponents = useMemo(() => buildComponentBomRows(finishedRows), [finishedRows]);
  const options = [
    { key: "finished" as const, label: "成品", count: finishedRows.length },
    { key: "components" as const, label: "组件", count: searchedComponents.length }
  ];

  return (
    <WorkspaceScreen title="BOM清单" subtitle="成品与组件用量的独立模块" onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <ImportStrip
        title="维护BOM清单"
        description="记录成品由哪些下级零部件组成，并维护成品采购成本。"
        actionLabel="新增BOM"
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
          <EmptyState text="当前条件下没有成品规格。" />
        )
      ) : searchedComponents.length ? (
        searchedComponents.map((row) => <ComponentBomCard key={row.id} row={row} />)
      ) : (
        <EmptyState text="当前条件下没有组件记录。" />
      )}
    </WorkspaceScreen>
  );
}

export function MeScreen() {
  const workspace = useOrderWorkspace();
  const [search, setSearch] = useState("");
  const visibleSummaries = useMemo(() => workspace.summaries.filter((summary) => summaryMatchesSearch(summary, search)), [workspace.summaries, search]);

  return (
    <WorkspaceScreen title="我的" subtitle="订单利润统计" onExport={workspace.exportCsv} onNewOrder={workspace.openNewOrder}>
      <SearchField value={search} onChangeText={setSearch} />
      <View style={styles.statsGrid}>
        <StatTile label="总订单量" value={workspace.profit.totalOrderCount} tone="green" />
        <StatTile label="销售额" value={`¥${formatMoney(workspace.profit.salesTotal)}`} tone="green" />
        <StatTile label="采购成本" value={`¥${formatMoney(workspace.profit.purchaseCost)}`} tone="yellow" />
        <StatTile label="总利润" value={`¥${formatMoney(workspace.profit.totalProfit)}`} tone="blue" />
        <StatTile label="本月订单量" value={workspace.profit.currentMonthOrderCount} tone="yellow" />
        <StatTile label="本月利润" value={`¥${formatMoney(workspace.profit.currentMonthProfit)}`} tone="red" />
      </View>
      <TrendCard
        title="每月销售额趋势"
        rows={workspace.profit.monthlySalesTrend.map((point) => ({ month: point.month, value: point.salesTotal }))}
      />
      <TrendCard
        title="每月利润趋势"
        rows={workspace.profit.monthlyProfitTrend.map((point) => ({ month: point.month, value: point.grossProfit }))}
      />
      <SectionTitle title="订单利润" />
      {visibleSummaries.length ? (
        visibleSummaries.map((summary) => (
          <View key={summary.lineId} style={styles.card}>
            <Text style={styles.cardTitle}>{summary.companyName}</Text>
            <Text style={styles.meta}>
              {summary.materialName} / {summary.specModel} / {summary.orderDate}
            </Text>
            <Text style={styles.strong}>
              毛利 ¥{formatMoney(summary.grossProfit)}，毛利率 {Math.round(summary.grossMarginRate * 1000) / 10}%
            </Text>
            <View style={styles.kvRow}>
              <Text style={styles.meta}>销售额</Text>
              <Text style={styles.strong}>¥{formatMoney(summary.taxIncludedTotal)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.meta}>采购成本</Text>
              <Text style={styles.strong}>¥{formatMoney(summary.purchaseTotal)}</Text>
            </View>
          </View>
        ))
      ) : (
        <EmptyState text="当前条件下没有利润记录。" />
      )}
    </WorkspaceScreen>
  );
}

function PurchaseRecordCard({ item, onPress }: { item: PurchaseItem; onPress: () => void }) {
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
        <Text style={styles.meta}>买入日期</Text>
        <Text style={styles.strong}>{item.purchase.purchaseDate}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>买入金额</Text>
        <Text style={styles.strong}>¥{formatMoney(item.purchase.purchaseTotal)}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>发票状态</Text>
        <Text style={styles.strong}>{invoiceText(item.purchase.invoiceNeeded)}</Text>
      </View>
    </Pressable>
  );
}

function InventoryCard({ row }: { row: InventoryRow }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{row.specModel}</Text>
      <Text style={styles.meta}>{row.materialNames.join(" / ")}</Text>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>订单</Text>
        <Text style={styles.strong}>{row.orderedQuantity}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>已送</Text>
        <Text style={styles.strong}>{row.deliveredQuantity}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>买入折算</Text>
        <Text style={styles.strong}>{row.purchasedInOrderUnit}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>库存结余</Text>
        <Text style={[styles.strong, row.inventoryBalance <= 0 && styles.dangerText]}>{row.inventoryBalance}</Text>
      </View>
      {row.purchaseSources.slice(0, 3).map((source) => (
        <Text key={`${source.orderNo}-${source.purchaseSpec}-${source.purchaseDate}`} style={styles.meta}>
          来源 {source.purchaseDate} / {source.companyName} / {source.purchaseSpec} / {source.quantityInOrderUnit}
        </Text>
      ))}
    </View>
  );
}

function BomItemCard({ item, onEdit, onDelete }: { item: BomItem; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>{item.finishedSpecModel}</Text>
          <Text style={styles.meta}>成品 / {item.finishedMaterialName}</Text>
        </View>
        <Pressable onPress={onEdit} style={styles.inlineEdit}>
          <Pencil color="#21413e" size={15} />
        </Pressable>
        <Pressable onPress={onDelete} style={styles.inlineEdit}>
          <Trash2 color="#a3392b" size={15} />
        </Pressable>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>成品采购成本</Text>
        <Text style={styles.strong}>¥{formatMoney(item.finishedPurchaseCost)}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>零部件数量</Text>
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
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{row.componentSpec}</Text>
      <Text style={styles.meta}>
        组件 / {row.materialName} / 对应成品 {row.finishedMaterialName} {row.finishedSpec}
      </Text>
      <View style={styles.kvRow}>
        <Text style={styles.meta}>单个成品用量</Text>
        <Text style={styles.strong}>{row.quantity}</Text>
      </View>
    </View>
  );
}

function TrendCard({ title, rows }: { title: string; rows: Array<{ month: string; value: number }> }) {
  const maxValue = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {rows.length ? (
        rows.map((row) => (
          <View key={row.month} style={{ gap: 5 }}>
            <View style={styles.kvRow}>
              <Text style={styles.meta}>{row.month}</Text>
              <Text style={styles.strong}>¥{formatMoney(row.value)}</Text>
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
        <Text style={styles.meta}>暂无趋势数据</Text>
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
