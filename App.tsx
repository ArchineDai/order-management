import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Camera,
  Download,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  Truck,
  X
} from "lucide-react-native";
import { addDeliveryToLine, addPurchaseToLine, createOrder, removeOrder, validateDeliveryInput, validateOrderInput, validatePurchaseInput } from "./src/domain/orderBuilders";
import { buildInventoryRows, calculateProfitSummary, detectDuplicateOrder, searchHistory, summarizeLine, summarizeOrders } from "./src/domain/calculations";
import { Order, OrderLine, OrderLineStatus } from "./src/domain/types";
import { orderRepository } from "./src/services/nativeStorage";
import { canRecognizeTextOnDevice, recognizeOrderDraftFromImage, recognizePurchaseDraftFromImage } from "./src/services/ocrService";
import { exportOrdersAsCsv } from "./src/services/exportService";

type TabKey = "dashboard" | "orders" | "backorders" | "inventory" | "search" | "profit";

type SelectedLine = {
  order: Order;
  line: OrderLine;
};

type OrderFormState = {
  companyName: string;
  customerPoNo: string;
  orderDate: string;
  materialName: string;
  specModel: string;
  quantity: string;
  unit: string;
  taxIncludedUnitPrice: string;
  taxIncludedTotal: string;
  note: string;
  sourceImageUri?: string;
};

type DeliveryFormState = {
  courierCompany: string;
  trackingNo: string;
  shipDate: string;
  quantity: string;
  note: string;
};

type PurchaseFormState = {
  supplierName: string;
  taobaoOrderNo: string;
  purchaseDate: string;
  purchaseSpec: string;
  purchaseQuantity: string;
  purchaseUnit: string;
  purchaseUnitPrice: string;
  purchaseTotal: string;
  invoiceNeeded: "yes" | "no" | "unknown";
  conversionRatioToOrderUnit: string;
  note: string;
  attachmentUri?: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyOrderForm = (): OrderFormState => ({
  companyName: "",
  customerPoNo: "",
  orderDate: today(),
  materialName: "",
  specModel: "",
  quantity: "",
  unit: "个",
  taxIncludedUnitPrice: "",
  taxIncludedTotal: "",
  note: ""
});

const emptyDeliveryForm = (): DeliveryFormState => ({
  courierCompany: "",
  trackingNo: "",
  shipDate: today(),
  quantity: "",
  note: ""
});

const emptyPurchaseForm = (): PurchaseFormState => ({
  supplierName: "",
  taobaoOrderNo: "",
  purchaseDate: today(),
  purchaseSpec: "",
  purchaseQuantity: "",
  purchaseUnit: "个",
  purchaseUnitPrice: "",
  purchaseTotal: "",
  invoiceNeeded: "unknown",
  conversionRatioToOrderUnit: "1",
  note: ""
});

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "看板" },
  { key: "orders", label: "订单" },
  { key: "backorders", label: "欠货" },
  { key: "inventory", label: "库存" },
  { key: "search", label: "搜索" },
  { key: "profit", label: "利润" }
];

export default function App() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderFormState>(emptyOrderForm);
  const [deliveryForm, setDeliveryForm] = useState<DeliveryFormState>(emptyDeliveryForm);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(emptyPurchaseForm);
  const [selectedLine, setSelectedLine] = useState<SelectedLine | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    orderRepository.load().then(setOrders).catch((error) => {
      Alert.alert("读取失败", error instanceof Error ? error.message : "无法读取本机订单数据");
    });
  }, []);

  const summaries = useMemo(() => summarizeOrders(orders), [orders]);
  const inventoryRows = useMemo(() => buildInventoryRows(orders), [orders]);
  const profit = useMemo(() => calculateProfitSummary(orders), [orders]);
  const searchResults = useMemo(() => searchHistory(orders, searchTerm), [orders, searchTerm]);
  const backorders = summaries.filter((summary) => summary.backorderQuantity > 0 && summary.status !== "over");
  const overDeliveries = summaries.filter((summary) => summary.status === "over");
  const lowInventory = inventoryRows.filter((row) => row.inventoryBalance <= 0 && row.backorderQuantity > 0);

  const saveOrders = async (nextOrders: Order[]) => {
    setOrders(nextOrders);
    await orderRepository.save(nextOrders);
  };

  const submitOrder = async (force = false) => {
    const input = {
      companyName: orderForm.companyName,
      customerPoNo: orderForm.customerPoNo,
      orderDate: orderForm.orderDate,
      materialName: orderForm.materialName,
      specModel: orderForm.specModel,
      quantity: toNumber(orderForm.quantity),
      unit: orderForm.unit,
      taxIncludedUnitPrice: toNumber(orderForm.taxIncludedUnitPrice),
      taxIncludedTotal: toOptionalNumber(orderForm.taxIncludedTotal),
      note: orderForm.note,
      sourceImageUri: orderForm.sourceImageUri
    };
    const errors = validateOrderInput(input);
    if (errors.length) {
      Alert.alert("订单不能保存", errors.join("\n"));
      return;
    }

    const newOrder = createOrder(input);
    const duplicates = detectDuplicateOrder(orders, newOrder);
    if (!force && duplicates.length > 0) {
      Alert.alert("疑似重复订单", "同公司、同日期、同规格、同数量的订单已经存在。是否继续保存？", [
        { text: "取消", style: "cancel" },
        { text: "继续保存", onPress: () => void submitOrder(true) }
      ]);
      return;
    }

    await saveOrders([newOrder, ...orders]);
    setOrderForm(emptyOrderForm());
    setOrderModalOpen(false);
    setActiveTab("orders");
  };

  const submitDelivery = async () => {
    if (!selectedLine) return;
    const input = {
      courierCompany: deliveryForm.courierCompany,
      trackingNo: deliveryForm.trackingNo,
      shipDate: deliveryForm.shipDate,
      quantity: toNumber(deliveryForm.quantity),
      note: deliveryForm.note
    };
    const errors = validateDeliveryInput(input);
    if (errors.length) {
      Alert.alert("送货记录不能保存", errors.join("\n"));
      return;
    }

    await saveOrders(addDeliveryToLine(orders, selectedLine.order.id, selectedLine.line.id, input));
    setDeliveryForm(emptyDeliveryForm());
    setDeliveryModalOpen(false);
    setSelectedLine(null);
  };

  const submitPurchase = async () => {
    if (!selectedLine) return;
    const input = {
      supplierName: purchaseForm.supplierName,
      taobaoOrderNo: purchaseForm.taobaoOrderNo,
      purchaseDate: purchaseForm.purchaseDate,
      purchaseSpec: purchaseForm.purchaseSpec,
      purchaseQuantity: toNumber(purchaseForm.purchaseQuantity),
      purchaseUnit: purchaseForm.purchaseUnit,
      purchaseUnitPrice: toNumber(purchaseForm.purchaseUnitPrice),
      purchaseTotal: toOptionalNumber(purchaseForm.purchaseTotal),
      invoiceNeeded: purchaseForm.invoiceNeeded,
      conversionRatioToOrderUnit: toNumber(purchaseForm.conversionRatioToOrderUnit),
      note: purchaseForm.note,
      attachmentUri: purchaseForm.attachmentUri
    };
    const errors = validatePurchaseInput(input);
    if (errors.length) {
      Alert.alert("买入记录不能保存", errors.join("\n"));
      return;
    }

    await saveOrders(addPurchaseToLine(orders, selectedLine.order.id, selectedLine.line.id, input));
    setPurchaseForm(emptyPurchaseForm());
    setPurchaseModalOpen(false);
    setSelectedLine(null);
  };

  const pickImage = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("没有权限", source === "camera" ? "需要相机权限才能拍照。" : "需要相册权限才能选择图片。");
      return undefined;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: false, mediaTypes: ["images"] });

    if (result.canceled || !result.assets[0]?.uri) return undefined;
    return result.assets[0].uri;
  };

  const attachOrderImage = async (source: "camera" | "library", runOcr: boolean) => {
    const uri = await pickImage(source);
    if (!uri) return;
    setOrderForm((form) => ({ ...form, sourceImageUri: uri }));
    if (!runOcr) return;
    await recognizeOrderImage(uri);
  };

  const attachPurchaseImage = async (source: "camera" | "library", runOcr: boolean) => {
    const uri = await pickImage(source);
    if (!uri) return;
    setPurchaseForm((form) => ({ ...form, attachmentUri: uri }));
    if (!runOcr) return;
    await recognizePurchaseImage(uri);
  };

  const recognizeOrderImage = async (uri: string) => {
    setBusy(true);
    try {
      const { draft } = await recognizeOrderDraftFromImage(uri);
      const line = draft.lines[0];
      setOrderForm((form) => ({
        ...form,
        companyName: draft.companyName || form.companyName,
        customerPoNo: draft.customerPoNo ?? form.customerPoNo,
        orderDate: draft.orderDate || form.orderDate,
        materialName: line.materialName || form.materialName,
        specModel: line.specModel || form.specModel,
        quantity: line.quantity ? String(line.quantity) : form.quantity,
        unit: line.unit || form.unit,
        taxIncludedUnitPrice: line.taxIncludedUnitPrice ? String(line.taxIncludedUnitPrice) : form.taxIncludedUnitPrice,
        taxIncludedTotal: line.taxIncludedTotal ? String(line.taxIncludedTotal) : form.taxIncludedTotal,
        note: draft.rawText ? `OCR 草稿，保存前请校对。\n${draft.rawText}` : form.note
      }));
      Alert.alert("已生成订单草稿", draft.uncertainFields.length ? `仍需确认：${draft.uncertainFields.join("、")}` : "识别字段已填入表单，请保存前核对。");
    } catch (error) {
      Alert.alert("OCR 识别失败", errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const recognizePurchaseImage = async (uri: string) => {
    setBusy(true);
    try {
      const { draft } = await recognizePurchaseDraftFromImage(uri);
      setPurchaseForm((form) => ({
        ...form,
        supplierName: draft.supplierName ?? form.supplierName,
        taobaoOrderNo: draft.taobaoOrderNo ?? form.taobaoOrderNo,
        purchaseDate: draft.purchaseDate || form.purchaseDate,
        purchaseSpec: draft.purchaseSpec || form.purchaseSpec,
        purchaseQuantity: draft.purchaseQuantity ? String(draft.purchaseQuantity) : form.purchaseQuantity,
        purchaseUnit: draft.purchaseUnit || form.purchaseUnit,
        purchaseUnitPrice: draft.purchaseUnitPrice ? String(draft.purchaseUnitPrice) : form.purchaseUnitPrice,
        purchaseTotal: draft.purchaseTotal ? String(draft.purchaseTotal) : form.purchaseTotal,
        invoiceNeeded: draft.invoiceNeeded,
        conversionRatioToOrderUnit: String(draft.conversionRatioToOrderUnit),
        note: draft.rawText ? `OCR 草稿，保存前请校对。\n${draft.rawText}` : form.note
      }));
      Alert.alert("已生成买入草稿", draft.uncertainFields.length ? `仍需确认：${draft.uncertainFields.join("、")}` : "识别字段已填入表单，请保存前核对。");
    } catch (error) {
      Alert.alert("OCR 识别失败", errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const files = await exportOrdersAsCsv(orders);
      Alert.alert("导出完成", `已生成 ${files.length} 个 CSV 文件。`);
    } catch (error) {
      Alert.alert("导出失败", errorMessage(error));
    }
  };

  const renderContent = () => {
    if (activeTab === "dashboard") {
      return (
        <>
          <View style={styles.statsGrid}>
            <StatTile label="订单行" value={summaries.length} tone="green" />
            <StatTile label="欠货" value={backorders.length} tone="red" />
            <StatTile label="库存规格" value={inventoryRows.filter((row) => row.inventoryBalance > 0).length} tone="yellow" />
            <StatTile label="毛利" value={`¥${formatMoney(profit.grossProfit)}`} tone="blue" />
          </View>
          <SectionTitle title="需要处理" />
          {overDeliveries.map((summary) => (
            <Notice key={summary.lineId} text={`${summary.companyName} ${summary.specModel} 已超发 ${Math.abs(summary.backorderQuantity)}`} />
          ))}
          {lowInventory.map((row) => (
            <Notice key={row.specModel} text={`${row.specModel} 有欠货且无可用库存，建议补采购。`} />
          ))}
          {overDeliveries.length === 0 && lowInventory.length === 0 ? <EmptyState text="暂无超发、欠货缺库存提醒。" /> : null}
          <SectionTitle title="最近订单" />
          {orders.slice(0, 3).map((order) => (
            <OrderCard key={order.id} order={order} onDelivery={openDelivery} onPurchase={openPurchase} onDelete={deleteOrder} />
          ))}
        </>
      );
    }

    if (activeTab === "orders") {
      return orders.length ? (
        orders.map((order) => (
          <OrderCard key={order.id} order={order} onDelivery={openDelivery} onPurchase={openPurchase} onDelete={deleteOrder} />
        ))
      ) : (
        <EmptyState text="还没有订单。点击右上角新增第一笔订单。" />
      );
    }

    if (activeTab === "backorders") {
      return backorders.length ? (
        backorders.map((summary) => (
          <View key={summary.lineId} style={styles.card}>
            <Text style={styles.cardTitle}>{summary.companyName}</Text>
            <Text style={styles.meta}>{summary.materialName} / {summary.specModel}</Text>
            <Text style={styles.strong}>欠货 {summary.backorderQuantity} {summary.unit}</Text>
            <Text style={styles.meta}>订单 {summary.orderQuantity}，已送 {summary.deliveredQuantity}</Text>
          </View>
        ))
      ) : (
        <EmptyState text="没有欠货订单。" />
      );
    }

    if (activeTab === "inventory") {
      return inventoryRows.length ? (
        inventoryRows.map((row) => (
          <View key={row.specModel} style={styles.card}>
            <Text style={styles.cardTitle}>{row.specModel}</Text>
            <Text style={styles.meta}>{row.materialNames.join(" / ")}</Text>
            <View style={styles.kvRow}><Text style={styles.meta}>订单</Text><Text style={styles.strong}>{row.orderedQuantity}</Text></View>
            <View style={styles.kvRow}><Text style={styles.meta}>已送</Text><Text style={styles.strong}>{row.deliveredQuantity}</Text></View>
            <View style={styles.kvRow}><Text style={styles.meta}>买入折算</Text><Text style={styles.strong}>{row.purchasedInOrderUnit}</Text></View>
            <View style={styles.kvRow}><Text style={styles.meta}>库存结余</Text><Text style={[styles.strong, row.inventoryBalance <= 0 && styles.dangerText]}>{row.inventoryBalance}</Text></View>
          </View>
        ))
      ) : (
        <EmptyState text="暂无库存数据。新增买入后会自动计算。" />
      );
    }

    if (activeTab === "search") {
      return (
        <>
          <View style={styles.searchBox}>
            <Search color="#21413e" size={18} />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="输入规格型号、物料或公司"
              placeholderTextColor="#7c8b86"
              style={styles.searchInput}
            />
          </View>
          {searchResults.map((result) => (
            <View key={result.lineId} style={styles.card}>
              <Text style={styles.cardTitle}>{result.specModel}</Text>
              <Text style={styles.meta}>{result.companyName} / {result.orderDate}</Text>
              <Text style={styles.strong}>销售单价 ¥{formatMoney(result.taxIncludedUnitPrice)}</Text>
              {result.purchases.map((purchase) => (
                <Text key={purchase.id} style={styles.meta}>
                  买入：{purchase.purchaseSpec} ¥{formatMoney(purchase.purchaseUnitPrice)} / {invoiceText(purchase.invoiceNeeded)}
                </Text>
              ))}
            </View>
          ))}
          {searchTerm && searchResults.length === 0 ? <EmptyState text="没有匹配的历史价格。" /> : null}
        </>
      );
    }

    return (
      <>
        <View style={styles.statsGrid}>
          <StatTile label="销售额" value={`¥${formatMoney(profit.salesTotal)}`} tone="green" />
          <StatTile label="采购成本" value={`¥${formatMoney(profit.purchaseTotal)}`} tone="yellow" />
          <StatTile label="毛利" value={`¥${formatMoney(profit.grossProfit)}`} tone="blue" />
          <StatTile label="毛利率" value={`${Math.round(profit.grossMarginRate * 1000) / 10}%`} tone="red" />
        </View>
        {summaries.map((summary) => (
          <View key={summary.lineId} style={styles.card}>
            <Text style={styles.cardTitle}>{summary.companyName}</Text>
            <Text style={styles.meta}>{summary.specModel} / {summary.orderDate}</Text>
            <Text style={styles.strong}>毛利 ¥{formatMoney(summary.grossProfit)}，毛利率 {Math.round(summary.grossMarginRate * 1000) / 10}%</Text>
          </View>
        ))}
      </>
    );
  };

  const openDelivery = (order: Order, line: OrderLine) => {
    setSelectedLine({ order, line });
    setDeliveryForm(emptyDeliveryForm());
    setDeliveryModalOpen(true);
  };

  const openPurchase = (order: Order, line: OrderLine) => {
    setSelectedLine({ order, line });
    setPurchaseForm((form) => ({
      ...emptyPurchaseForm(),
      purchaseSpec: line.specModel,
      purchaseUnit: line.unit,
      conversionRatioToOrderUnit: form.conversionRatioToOrderUnit || "1"
    }));
    setPurchaseModalOpen(true);
  };

  const deleteOrder = (order: Order) => {
    Alert.alert("删除订单", `确认删除 ${order.orderNo}？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => void saveOrders(removeOrder(orders, order.id)) }
    ]);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#12312f" />
        <View style={styles.header}>
          <View>
            <Text style={styles.appTitle}>订单台账</Text>
            <Text style={styles.appSubtitle}>1.1 iOS / Android 本机应用</Text>
          </View>
          <View style={styles.headerActions}>
            <IconButton icon={<Download color="#f7f8f4" size={19} />} label="导出" onPress={exportCsv} />
            <IconButton icon={<Plus color="#f7f8f4" size={20} />} label="新增" onPress={() => setOrderModalOpen(true)} />
          </View>
        </View>

        <View style={styles.ocrBanner}>
          <ReceiptText color="#21413e" size={18} />
          <Text style={styles.ocrBannerText}>
            本地 OCR：{canRecognizeTextOnDevice() ? "可用，图片只在手机本机识别" : "当前环境不可用，真机开发构建可用"}
          </Text>
        </View>

        <View style={styles.tabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContent}>
            {tabs.map((tab) => (
              <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tab, activeTab === tab.key && styles.activeTab]}>
                <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {renderContent()}
        </ScrollView>

        <OrderModal
          open={orderModalOpen}
          busy={busy}
          form={orderForm}
          onChange={setOrderForm}
          onClose={() => setOrderModalOpen(false)}
          onSubmit={() => void submitOrder()}
          onPick={(source, runOcr) => void attachOrderImage(source, runOcr)}
        />
        <DeliveryModal
          open={deliveryModalOpen}
          form={deliveryForm}
          target={selectedLine}
          onChange={setDeliveryForm}
          onClose={() => setDeliveryModalOpen(false)}
          onSubmit={() => void submitDelivery()}
        />
        <PurchaseModal
          open={purchaseModalOpen}
          busy={busy}
          form={purchaseForm}
          target={selectedLine}
          onChange={setPurchaseForm}
          onClose={() => setPurchaseModalOpen(false)}
          onSubmit={() => void submitPurchase()}
          onPick={(source, runOcr) => void attachPurchaseImage(source, runOcr)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function OrderCard({
  order,
  onDelivery,
  onPurchase,
  onDelete
}: {
  order: Order;
  onDelivery: (order: Order, line: OrderLine) => void;
  onPurchase: (order: Order, line: OrderLine) => void;
  onDelete: (order: Order) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>{order.companyName}</Text>
          <Text style={styles.meta}>{order.orderNo} / {order.orderDate}</Text>
        </View>
        <Pressable onPress={() => onDelete(order)} style={styles.iconOnly}>
          <X color="#a3392b" size={18} />
        </Pressable>
      </View>
      {order.sourceImage ? <Image source={{ uri: order.sourceImage.dataUrl }} style={styles.attachmentPreview} /> : null}
      {order.lines.map((line) => {
        const summary = summarizeLine(order, line);
        return (
          <View key={line.id} style={styles.lineBlock}>
            <View style={styles.lineTop}>
              <View style={styles.flexOne}>
                <Text style={styles.strong}>{line.materialName} / {line.specModel}</Text>
                <Text style={styles.meta}>{line.quantity} {line.unit} × ¥{formatMoney(line.taxIncludedUnitPrice)}</Text>
              </View>
              <StatusPill status={summary.status} />
            </View>
            <View style={styles.metricsRow}>
              <MiniMetric label="已送" value={summary.deliveredQuantity} />
              <MiniMetric label="欠货" value={summary.backorderQuantity} danger={summary.backorderQuantity > 0} />
              <MiniMetric label="库存" value={summary.inventoryBalance} danger={summary.inventoryBalance < 0} />
            </View>
            <View style={styles.actionRow}>
              <SmallButton icon={<Truck color="#12312f" size={16} />} label="送货" onPress={() => onDelivery(order, line)} />
              <SmallButton icon={<PackageCheck color="#12312f" size={16} />} label="买入" onPress={() => onPurchase(order, line)} />
            </View>
            {line.deliveries.length ? <Text style={styles.meta}>送货 {line.deliveries.length} 笔，买入 {line.purchases.length} 笔</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function OrderModal(props: {
  open: boolean;
  busy: boolean;
  form: OrderFormState;
  onChange: (form: OrderFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  onPick: (source: "camera" | "library", runOcr: boolean) => void;
}) {
  const { form, onChange } = props;
  return (
    <FormModal open={props.open} title="新建订单" onClose={props.onClose}>
      <Field label="客户公司" value={form.companyName} onChangeText={(value) => onChange({ ...form, companyName: value })} />
      <Field label="采购单号" value={form.customerPoNo} onChangeText={(value) => onChange({ ...form, customerPoNo: value })} />
      <Field label="订单日期" value={form.orderDate} onChangeText={(value) => onChange({ ...form, orderDate: value })} placeholder="2026-07-07" />
      <Field label="物料名称" value={form.materialName} onChangeText={(value) => onChange({ ...form, materialName: value })} />
      <Field label="规格型号" value={form.specModel} onChangeText={(value) => onChange({ ...form, specModel: value })} />
      <View style={styles.formGrid}>
        <Field label="数量" value={form.quantity} onChangeText={(value) => onChange({ ...form, quantity: value })} keyboardType="numeric" />
        <Field label="单位" value={form.unit} onChangeText={(value) => onChange({ ...form, unit: value })} />
      </View>
      <View style={styles.formGrid}>
        <Field label="含税单价" value={form.taxIncludedUnitPrice} onChangeText={(value) => onChange({ ...form, taxIncludedUnitPrice: value })} keyboardType="numeric" />
        <Field label="价税合计" value={form.taxIncludedTotal} onChangeText={(value) => onChange({ ...form, taxIncludedTotal: value })} keyboardType="numeric" />
      </View>
      <Field label="备注" value={form.note} onChangeText={(value) => onChange({ ...form, note: value })} multiline />
      {form.sourceImageUri ? <Image source={{ uri: form.sourceImageUri }} style={styles.formImage} /> : null}
      <View style={styles.actionRow}>
        <SmallButton icon={<Camera color="#12312f" size={16} />} label="拍照附件" onPress={() => props.onPick("camera", false)} />
        <SmallButton icon={<ReceiptText color="#12312f" size={16} />} label={props.busy ? "识别中" : "拍照识别"} onPress={() => props.onPick("camera", true)} />
      </View>
      <SmallButton icon={<Archive color="#12312f" size={16} />} label="从相册识别采购单" onPress={() => props.onPick("library", true)} />
      <PrimaryButton label="保存订单" onPress={props.onSubmit} />
    </FormModal>
  );
}

function DeliveryModal(props: {
  open: boolean;
  form: DeliveryFormState;
  target: SelectedLine | null;
  onChange: (form: DeliveryFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { form, onChange } = props;
  return (
    <FormModal open={props.open} title="新增送货" onClose={props.onClose}>
      {props.target ? <Text style={styles.formTarget}>{props.target.order.companyName} / {props.target.line.specModel}</Text> : null}
      <Field label="快递公司" value={form.courierCompany} onChangeText={(value) => onChange({ ...form, courierCompany: value })} />
      <Field label="快递单号" value={form.trackingNo} onChangeText={(value) => onChange({ ...form, trackingNo: value })} />
      <Field label="发货日期" value={form.shipDate} onChangeText={(value) => onChange({ ...form, shipDate: value })} placeholder="2026-07-07" />
      <Field label="送货数量" value={form.quantity} onChangeText={(value) => onChange({ ...form, quantity: value })} keyboardType="numeric" />
      <Field label="备注" value={form.note} onChangeText={(value) => onChange({ ...form, note: value })} multiline />
      <PrimaryButton label="保存送货记录" onPress={props.onSubmit} />
    </FormModal>
  );
}

function PurchaseModal(props: {
  open: boolean;
  busy: boolean;
  form: PurchaseFormState;
  target: SelectedLine | null;
  onChange: (form: PurchaseFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  onPick: (source: "camera" | "library", runOcr: boolean) => void;
}) {
  const { form, onChange } = props;
  return (
    <FormModal open={props.open} title="新增买入" onClose={props.onClose}>
      {props.target ? <Text style={styles.formTarget}>{props.target.order.companyName} / {props.target.line.specModel}</Text> : null}
      <Field label="供应商/店铺" value={form.supplierName} onChangeText={(value) => onChange({ ...form, supplierName: value })} />
      <Field label="淘宝订单号" value={form.taobaoOrderNo} onChangeText={(value) => onChange({ ...form, taobaoOrderNo: value })} />
      <Field label="买入日期" value={form.purchaseDate} onChangeText={(value) => onChange({ ...form, purchaseDate: value })} />
      <Field label="买入规格" value={form.purchaseSpec} onChangeText={(value) => onChange({ ...form, purchaseSpec: value })} />
      <View style={styles.formGrid}>
        <Field label="买入数量" value={form.purchaseQuantity} onChangeText={(value) => onChange({ ...form, purchaseQuantity: value })} keyboardType="numeric" />
        <Field label="买入单位" value={form.purchaseUnit} onChangeText={(value) => onChange({ ...form, purchaseUnit: value })} />
      </View>
      <View style={styles.formGrid}>
        <Field label="买入单价" value={form.purchaseUnitPrice} onChangeText={(value) => onChange({ ...form, purchaseUnitPrice: value })} keyboardType="numeric" />
        <Field label="买入总价" value={form.purchaseTotal} onChangeText={(value) => onChange({ ...form, purchaseTotal: value })} keyboardType="numeric" />
      </View>
      <Field label="换算比例" value={form.conversionRatioToOrderUnit} onChangeText={(value) => onChange({ ...form, conversionRatioToOrderUnit: value })} keyboardType="numeric" />
      <View style={styles.segmented}>
        {(["yes", "no", "unknown"] as const).map((value) => (
          <Pressable key={value} onPress={() => onChange({ ...form, invoiceNeeded: value })} style={[styles.segment, form.invoiceNeeded === value && styles.activeSegment]}>
            <Text style={[styles.segmentText, form.invoiceNeeded === value && styles.activeSegmentText]}>{invoiceText(value)}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="备注" value={form.note} onChangeText={(value) => onChange({ ...form, note: value })} multiline />
      {form.attachmentUri ? <Image source={{ uri: form.attachmentUri }} style={styles.formImage} /> : null}
      <View style={styles.actionRow}>
        <SmallButton icon={<Camera color="#12312f" size={16} />} label="拍照截图" onPress={() => props.onPick("camera", false)} />
        <SmallButton icon={<ReceiptText color="#12312f" size={16} />} label={props.busy ? "识别中" : "截图识别"} onPress={() => props.onPick("camera", true)} />
      </View>
      <SmallButton icon={<Archive color="#12312f" size={16} />} label="从相册识别淘宝截图" onPress={() => props.onPick("library", true)} />
      <PrimaryButton label="保存买入记录" onPress={props.onSubmit} />
    </FormModal>
  );
}

function FormModal({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Modal animationType="slide" visible={open} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.iconOnly}><X color="#12312f" size={22} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>{children}</ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8a9692"
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string | number; tone: "green" | "red" | "yellow" | "blue" }) {
  return (
    <View style={[styles.statTile, styles[`stat_${tone}`]]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function MiniMetric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, danger && styles.dangerText]}>{value}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: OrderLineStatus }) {
  const label = status === "pending" ? "待送货" : status === "partial" ? "部分送货" : status === "complete" ? "已送完" : "超发";
  return (
    <View style={[styles.pill, status === "over" && styles.pillDanger, status === "complete" && styles.pillSuccess]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyState}>{text}</Text>;
}

function Notice({ text }: { text: string }) {
  return (
    <View style={styles.notice}>
      <AlertTriangle color="#a3392b" size={18} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.smallButton}>
      {icon}
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

function IconButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton} accessibilityLabel={label}>
      {icon}
    </Pressable>
  );
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  return toNumber(value);
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function invoiceText(value: "yes" | "no" | "unknown") {
  if (value === "yes") return "需采购发票";
  if (value === "no") return "不需要发票";
  return "发票未知";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f7f8f4"
  },
  header: {
    backgroundColor: "#12312f",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  appTitle: {
    color: "#f7f8f4",
    fontSize: 26,
    fontWeight: "800"
  },
  appSubtitle: {
    color: "#d1ddd8",
    marginTop: 4,
    fontSize: 13
  },
  headerActions: {
    flexDirection: "row",
    gap: 10
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#21413e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3e625d"
  },
  ocrBanner: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#e7efe7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#d6dfd9"
  },
  ocrBannerText: {
    flex: 1,
    color: "#21413e",
    fontSize: 13,
    lineHeight: 18
  },
  tabBar: {
    backgroundColor: "#f7f8f4",
    borderBottomWidth: 1,
    borderBottomColor: "#dde2dd"
  },
  tabContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#ecefe9"
  },
  activeTab: {
    backgroundColor: "#e7563f"
  },
  tabText: {
    color: "#41534f",
    fontWeight: "700"
  },
  activeTabText: {
    color: "#fff"
  },
  body: {
    flex: 1
  },
  bodyContent: {
    padding: 14,
    paddingBottom: 28,
    gap: 12
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statTile: {
    width: "48%",
    borderRadius: 8,
    padding: 14,
    minHeight: 92,
    justifyContent: "space-between"
  },
  stat_green: {
    backgroundColor: "#dfece6"
  },
  stat_red: {
    backgroundColor: "#f8dfd8"
  },
  stat_yellow: {
    backgroundColor: "#f7ebc3"
  },
  stat_blue: {
    backgroundColor: "#dce8f5"
  },
  statLabel: {
    color: "#50625e",
    fontSize: 13,
    fontWeight: "700"
  },
  statValue: {
    color: "#12312f",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10
  },
  sectionTitle: {
    color: "#12312f",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e1e5df",
    gap: 10
  },
  cardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  cardTitle: {
    color: "#12312f",
    fontSize: 17,
    fontWeight: "900"
  },
  meta: {
    color: "#687773",
    fontSize: 13,
    lineHeight: 19
  },
  strong: {
    color: "#203935",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21
  },
  dangerText: {
    color: "#a3392b"
  },
  flexOne: {
    flex: 1
  },
  iconOnly: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f4f0ea"
  },
  attachmentPreview: {
    width: "100%",
    height: 148,
    borderRadius: 8,
    backgroundColor: "#eef2ed"
  },
  lineBlock: {
    borderTopWidth: 1,
    borderTopColor: "#ecefe9",
    paddingTop: 10,
    gap: 9
  },
  lineTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8
  },
  miniMetric: {
    flex: 1,
    backgroundColor: "#f4f6f2",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9
  },
  miniLabel: {
    fontSize: 12,
    color: "#71807b"
  },
  miniValue: {
    color: "#12312f",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  smallButton: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#edf1ea",
    borderWidth: 1,
    borderColor: "#d4ddd5",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  smallButtonText: {
    color: "#12312f",
    fontWeight: "800"
  },
  pill: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: "#f7ebc3"
  },
  pillDanger: {
    backgroundColor: "#f8dfd8"
  },
  pillSuccess: {
    backgroundColor: "#dfece6"
  },
  pillText: {
    color: "#12312f",
    fontSize: 12,
    fontWeight: "900"
  },
  notice: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#e7563f",
    flexDirection: "row",
    gap: 9,
    alignItems: "center"
  },
  noticeText: {
    flex: 1,
    color: "#4f403c",
    fontSize: 14,
    lineHeight: 20
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e7e1",
    color: "#687773",
    padding: 18,
    lineHeight: 22
  },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  searchBox: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d9e0d9",
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: "#12312f",
    fontSize: 15
  },
  modalSafe: {
    flex: 1,
    backgroundColor: "#f7f8f4"
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#dfe5dd"
  },
  modalTitle: {
    color: "#12312f",
    fontSize: 20,
    fontWeight: "900"
  },
  modalBody: {
    padding: 16,
    paddingBottom: 36,
    gap: 12
  },
  field: {
    gap: 6,
    flex: 1
  },
  fieldLabel: {
    color: "#4c5d59",
    fontSize: 13,
    fontWeight: "800"
  },
  input: {
    minHeight: 46,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8dfd8",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#12312f",
    fontSize: 15
  },
  multilineInput: {
    minHeight: 92,
    paddingTop: 10,
    textAlignVertical: "top"
  },
  formGrid: {
    flexDirection: "row",
    gap: 10
  },
  formImage: {
    width: "100%",
    height: 170,
    borderRadius: 8,
    backgroundColor: "#eef2ed"
  },
  formTarget: {
    backgroundColor: "#e7efe7",
    color: "#21413e",
    padding: 12,
    borderRadius: 8,
    fontWeight: "800"
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: "#12312f",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#e8ede7",
    borderRadius: 8,
    padding: 4,
    gap: 4
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6
  },
  activeSegment: {
    backgroundColor: "#12312f"
  },
  segmentText: {
    color: "#4c5d59",
    fontWeight: "800",
    fontSize: 12
  },
  activeSegmentText: {
    color: "#fff"
  }
});
