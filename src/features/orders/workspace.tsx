import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Archive, Camera, Plus, X } from "lucide-react-native";
import {
  addDeliveryToOrder,
  addPurchaseToLine,
  createOrder,
  markOrderCompleted,
  removeOrder,
  reopenOrder,
  updateDeliveryRecord,
  updateOrder,
  updatePurchaseRecord,
  validateDeliveryInput,
  validateOrderInput,
  validatePurchaseInput
} from "../../domain/orderBuilders";
import {
  buildInventoryRows,
  calculateProfitStatistics,
  detectDuplicateOrder,
  summarizeOrders
} from "../../domain/calculations";
import { getAutocompleteSuggestions } from "../../domain/autocomplete";
import { removeBomItem, upsertBomItem } from "../../domain/bom";
import { BomItem, InventoryRow, LineSummary, Order, OrderLine, ProfitStatistics } from "../../domain/types";
import { exportOrdersAsCsv } from "../../services/exportService";
import { parseOrdersFromImportedFile } from "../../services/orderImportService";
import { bomRepository, orderRepository } from "../../services/nativeStorage";
import {
  Field,
  FormModal,
  ImportStrip,
  PrimaryButton,
  SectionTitle,
  SmallButton,
  colors,
  invoiceText,
  styles
} from "./components";

type SelectedLine = {
  order: Order;
  line: OrderLine;
};

type SelectedOrder = {
  order: Order;
  line?: OrderLine;
};

type EditingDelivery = {
  order: Order;
  line: OrderLine;
  deliveryId: string;
};

type EditingPurchase = {
  order: Order;
  line: OrderLine;
  purchaseId: string;
};

type OrderLineFormState = {
  id?: string;
  materialName: string;
  specModel: string;
  quantity: string;
  unit: string;
  taxIncludedUnitPrice: string;
  taxIncludedTotal: string;
};

type OrderFormState = {
  companyName: string;
  customerPoNo: string;
  orderDate: string;
  lines: OrderLineFormState[];
  note: string;
  sourceImageUri?: string;
};

type DeliveryLineFormState = {
  lineId: string;
  materialName: string;
  specModel: string;
  unit: string;
  quantity: string;
};

type DeliveryFormState = {
  courierCompany: string;
  trackingNo: string;
  shipDate: string;
  lines: DeliveryLineFormState[];
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

type BomComponentFormState = {
  id?: string;
  materialName: string;
  specModel: string;
  quantity: string;
};

type BomFormState = {
  id?: string;
  finishedMaterialName: string;
  finishedSpecModel: string;
  finishedPurchaseCost: string;
  components: BomComponentFormState[];
};

type WorkspaceContextValue = {
  orders: Order[];
  bomItems: BomItem[];
  summaries: LineSummary[];
  inventoryRows: InventoryRow[];
  profit: ProfitStatistics;
  backorders: LineSummary[];
  overDeliveries: LineSummary[];
  lowInventory: InventoryRow[];
  openNewOrder: () => void;
  openEditOrder: (order: Order) => void;
  openDelivery: (order: Order, line?: OrderLine) => void;
  openEditDelivery: (order: Order, line: OrderLine, deliveryId: string) => void;
  openPurchase: (order: Order, line: OrderLine) => void;
  openEditPurchase: (order: Order, line: OrderLine, purchaseId: string) => void;
  deleteOrder: (order: Order) => void;
  completeOrder: (order: Order) => void;
  reopenCompletedOrder: (order: Order) => void;
  openNewBom: () => void;
  openEditBom: (item: BomItem) => void;
  deleteBom: (item: BomItem) => void;
  exportCsv: () => Promise<void>;
  openImportEntry: () => Promise<void>;
};

const OrderWorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const today = () => new Date().toISOString().slice(0, 10);

const emptyOrderLineForm = (): OrderLineFormState => ({
  materialName: "",
  specModel: "",
  quantity: "",
  unit: "个",
  taxIncludedUnitPrice: "",
  taxIncludedTotal: ""
});

const emptyOrderForm = (): OrderFormState => ({
  companyName: "",
  customerPoNo: "",
  orderDate: today(),
  lines: [emptyOrderLineForm()],
  note: ""
});

const emptyDeliveryForm = (order?: Order, preferredLine?: OrderLine): DeliveryFormState => ({
  courierCompany: "",
  trackingNo: "",
  shipDate: today(),
  lines:
    order?.lines.map((line) => ({
      lineId: line.id,
      materialName: line.materialName,
      specModel: line.specModel,
      unit: line.unit,
      quantity: preferredLine?.id === line.id ? "" : ""
    })) ?? [],
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
  invoiceNeeded: "no",
  conversionRatioToOrderUnit: "1",
  note: ""
});

const emptyBomComponentForm = (): BomComponentFormState => ({
  materialName: "",
  specModel: "",
  quantity: ""
});

const emptyBomForm = (): BomFormState => ({
  finishedMaterialName: "",
  finishedSpecModel: "",
  finishedPurchaseCost: "",
  components: [emptyBomComponentForm()]
});

export function OrderWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderFormState>(emptyOrderForm);
  const [deliveryForm, setDeliveryForm] = useState<DeliveryFormState>(emptyDeliveryForm);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(emptyPurchaseForm);
  const [bomForm, setBomForm] = useState<BomFormState>(emptyBomForm);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrder | null>(null);
  const [selectedLine, setSelectedLine] = useState<SelectedLine | null>(null);
  const [editingDelivery, setEditingDelivery] = useState<EditingDelivery | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<EditingPurchase | null>(null);

  useEffect(() => {
    orderRepository.load().then(setOrders).catch((error) => {
      Alert.alert("读取失败", errorMessage(error));
    });
    bomRepository.load().then(setBomItems).catch((error) => {
      Alert.alert("BOM 读取失败", errorMessage(error));
    });
  }, []);

  const summaries = useMemo(() => summarizeOrders(orders), [orders]);
  const inventoryRows = useMemo(() => buildInventoryRows(orders), [orders]);
  const profit = useMemo(() => calculateProfitStatistics(orders), [orders]);
  const backorders = useMemo(
    () => summaries.filter((summary) => summary.backorderQuantity > 0 && summary.status !== "over"),
    [summaries]
  );
  const overDeliveries = useMemo(() => summaries.filter((summary) => summary.status === "over"), [summaries]);
  const lowInventory = useMemo(
    () => inventoryRows.filter((row) => row.inventoryBalance <= 0 && row.backorderQuantity > 0),
    [inventoryRows]
  );

  const saveOrders = async (nextOrders: Order[]) => {
    setOrders(nextOrders);
    await orderRepository.save(nextOrders);
  };

  const saveBomItems = async (nextItems: BomItem[]) => {
    setBomItems(nextItems);
    await bomRepository.save(nextItems);
  };

  const submitOrder = async (force = false) => {
    const input = {
      companyName: orderForm.companyName,
      customerPoNo: orderForm.customerPoNo,
      orderDate: orderForm.orderDate,
      lines: orderForm.lines.map((line) => ({
        id: line.id,
        materialName: line.materialName,
        specModel: line.specModel,
        quantity: toNumber(line.quantity),
        unit: line.unit,
        taxIncludedUnitPrice: toNumber(line.taxIncludedUnitPrice),
        taxIncludedTotal: toOptionalNumber(line.taxIncludedTotal)
      })),
      note: orderForm.note,
      sourceImageUri: orderForm.sourceImageUri
    };
    const errors = validateOrderInput(input);
    if (errors.length) {
      Alert.alert("订单不能保存", errors.join("\n"));
      return;
    }

    if (editingOrderId) {
      await saveOrders(updateOrder(orders, editingOrderId, input));
      setOrderForm(emptyOrderForm());
      setEditingOrderId(null);
      setOrderModalOpen(false);
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
  };

  const submitDelivery = async () => {
    if (!selectedOrder && !editingDelivery) return;
    const input = {
      courierCompany: deliveryForm.courierCompany,
      trackingNo: deliveryForm.trackingNo,
      shipDate: deliveryForm.shipDate,
      quantity: deliveryForm.lines.length === 1 ? toNumber(deliveryForm.lines[0].quantity) : undefined,
      lines: deliveryForm.lines.map((line) => ({
        lineId: line.lineId,
        quantity: toNumber(line.quantity)
      })),
      note: deliveryForm.note
    };
    const errors = validateDeliveryInput(input);
    if (errors.length) {
      Alert.alert("送货记录不能保存", errors.join("\n"));
      return;
    }

    if (editingDelivery) {
      await saveOrders(
        updateDeliveryRecord(orders, editingDelivery.order.id, editingDelivery.line.id, editingDelivery.deliveryId, input)
      );
    } else if (selectedOrder) {
      await saveOrders(addDeliveryToOrder(orders, selectedOrder.order.id, input));
    }
    setDeliveryForm(emptyDeliveryForm());
    setDeliveryModalOpen(false);
    setSelectedOrder(null);
    setSelectedLine(null);
    setEditingDelivery(null);
  };

  const submitPurchase = async () => {
    if (!selectedLine && !editingPurchase) return;
    const target = editingPurchase ?? selectedLine;
    if (!target) return;
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

    if (editingPurchase) {
      await saveOrders(updatePurchaseRecord(orders, target.order.id, target.line.id, editingPurchase.purchaseId, input));
    } else {
      await saveOrders(addPurchaseToLine(orders, target.order.id, target.line.id, input));
    }
    setPurchaseForm(emptyPurchaseForm());
    setPurchaseModalOpen(false);
    setSelectedLine(null);
    setEditingPurchase(null);
  };

  const pickImage = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("没有权限", source === "camera" ? "需要相机权限才能拍照。" : "需要相册权限才能选择附件。");
      return undefined;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: false, mediaTypes: ["images"] });

    if (result.canceled || !result.assets[0]?.uri) return undefined;
    return result.assets[0].uri;
  };

  const attachOrderImage = async (source: "camera" | "library") => {
    const uri = await pickImage(source);
    if (!uri) return;
    setOrderForm((form) => ({ ...form, sourceImageUri: uri }));
  };

  const attachPurchaseImage = async (source: "camera" | "library") => {
    const uri = await pickImage(source);
    if (!uri) return;
    setPurchaseForm((form) => ({ ...form, attachmentUri: uri }));
  };

  const exportCsv = async () => {
    try {
      const files = await exportOrdersAsCsv(orders);
      Alert.alert("导出完成", `已生成 ${files.length} 个 CSV 文件。`);
    } catch (error) {
      Alert.alert("导出失败", errorMessage(error));
    }
  };

  const importOrdersFromDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ],
        copyToCacheDirectory: true,
        multiple: false
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const isExcel = /\.(xlsx|xls)$/i.test(asset.name ?? "");
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: isExcel ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8
      });
      const importedInputs = parseOrdersFromImportedFile(
        {
          name: asset.name ?? "orders.csv",
          content,
          encoding: isExcel ? "base64" : "text"
        },
        { defaultOrderDate: today(), defaultUnit: "个" }
      );
      if (!importedInputs.length) {
        Alert.alert("导入失败", "文件中没有可导入的订单行。");
        return;
      }

      const errors = importedInputs.flatMap((input, index) =>
        validateOrderInput(input).map((message) => `第 ${index + 1} 个订单：${message}`)
      );
      if (errors.length) {
        Alert.alert("导入失败", errors.slice(0, 6).join("\n"));
        return;
      }

      const importedOrders = importedInputs.map((input) => createOrder(input));
      const importedLineCount = importedOrders.reduce((total, order) => total + order.lines.length, 0);
      await saveOrders([...importedOrders, ...orders]);
      Alert.alert("导入完成", `已生成 ${importedOrders.length} 个订单，${importedLineCount} 行物料。`);
    } catch (error) {
      Alert.alert("导入失败", errorMessage(error));
    }
  };

  const openNewOrder = () => {
    setEditingOrderId(null);
    setOrderForm(emptyOrderForm());
    setOrderModalOpen(true);
  };

  const openImportEntry = async () => {
    await importOrdersFromDocument();
  };

  const openEditOrder = (order: Order) => {
    setEditingOrderId(order.id);
    setOrderForm(orderToForm(order));
    setOrderModalOpen(true);
  };

  const openDelivery = (order: Order, line?: OrderLine) => {
    setSelectedOrder({ order, line });
    setSelectedLine(line ? { order, line } : null);
    setEditingDelivery(null);
    setDeliveryForm(emptyDeliveryForm(order, line));
    setDeliveryModalOpen(true);
  };

  const openEditDelivery = (order: Order, line: OrderLine, deliveryId: string) => {
    const delivery = line.deliveries.find((candidate) => candidate.id === deliveryId);
    if (!delivery) return;
    setSelectedOrder(null);
    setSelectedLine({ order, line });
    setEditingDelivery({ order, line, deliveryId });
    setDeliveryForm({
      courierCompany: delivery.courierCompany ?? "",
      trackingNo: delivery.trackingNo,
      shipDate: delivery.shipDate,
      lines: [
        {
          lineId: line.id,
          materialName: line.materialName,
          specModel: line.specModel,
          unit: line.unit,
          quantity: String(delivery.quantity)
        }
      ],
      note: delivery.note ?? ""
    });
    setDeliveryModalOpen(true);
  };

  const openPurchase = (order: Order, line: OrderLine) => {
    setEditingPurchase(null);
    setSelectedLine({ order, line });
    setPurchaseForm((form) => ({
      ...emptyPurchaseForm(),
      purchaseSpec: line.specModel,
      purchaseUnit: line.unit,
      conversionRatioToOrderUnit: form.conversionRatioToOrderUnit || "1"
    }));
    setPurchaseModalOpen(true);
  };

  const openEditPurchase = (order: Order, line: OrderLine, purchaseId: string) => {
    const purchase = line.purchases.find((candidate) => candidate.id === purchaseId);
    if (!purchase) return;
    setSelectedLine({ order, line });
    setEditingPurchase({ order, line, purchaseId });
    setPurchaseForm({
      supplierName: purchase.supplierName ?? "",
      taobaoOrderNo: purchase.taobaoOrderNo ?? "",
      purchaseDate: purchase.purchaseDate,
      purchaseSpec: purchase.purchaseSpec,
      purchaseQuantity: String(purchase.purchaseQuantity),
      purchaseUnit: purchase.purchaseUnit,
      purchaseUnitPrice: String(purchase.purchaseUnitPrice),
      purchaseTotal: String(purchase.purchaseTotal),
      invoiceNeeded: purchase.invoiceNeeded === "unknown" ? "no" : purchase.invoiceNeeded,
      conversionRatioToOrderUnit: String(purchase.conversionRatioToOrderUnit),
      note: purchase.note ?? "",
      attachmentUri: purchase.attachment?.dataUrl
    });
    setPurchaseModalOpen(true);
  };

  const deleteOrder = (order: Order) => {
    Alert.alert("删除订单", `确认删除 ${order.orderNo}？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => void saveOrders(removeOrder(orders, order.id)) }
    ]);
  };

  const completeOrder = (order: Order) => {
    Alert.alert("标记完成", `确认将 ${order.orderNo} 标记为已完成？`, [
      { text: "取消", style: "cancel" },
      { text: "完成", onPress: () => void saveOrders(markOrderCompleted(orders, order.id)) }
    ]);
  };

  const reopenCompletedOrder = (order: Order) => {
    void saveOrders(reopenOrder(orders, order.id));
  };

  const openNewBom = () => {
    setEditingBomId(null);
    setBomForm(emptyBomForm());
    setBomModalOpen(true);
  };

  const openEditBom = (item: BomItem) => {
    setEditingBomId(item.id);
    setBomForm(bomItemToForm(item));
    setBomModalOpen(true);
  };

  const deleteBom = (item: BomItem) => {
    Alert.alert("删除 BOM", `确认删除 ${item.finishedMaterialName} / ${item.finishedSpecModel}？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => void saveBomItems(removeBomItem(bomItems, item.id)) }
    ]);
  };

  const submitBom = async () => {
    const components = bomForm.components.map((component) => ({
      id: component.id,
      materialName: component.materialName,
      specModel: component.specModel,
      quantity: toNumber(component.quantity)
    }));
    const errors = [
      !bomForm.finishedMaterialName.trim() && "成品物料名称不能为空",
      !bomForm.finishedSpecModel.trim() && "成品规格型号不能为空",
      toNumber(bomForm.finishedPurchaseCost) < 0 && "成品采购成本不能小于 0",
      !components.length && "至少需要 1 个零部件",
      ...components.flatMap((component, index) => {
        const prefix = components.length > 1 ? `第 ${index + 1} 个零部件` : "零部件";
        return [
          !component.materialName.trim() && `${prefix}名称不能为空`,
          !component.specModel.trim() && `${prefix}规格型号不能为空`,
          component.quantity <= 0 && `${prefix}数量必须大于 0`
        ].filter(Boolean) as string[];
      })
    ].filter(Boolean) as string[];
    if (errors.length) {
      Alert.alert("BOM 不能保存", errors.join("\n"));
      return;
    }

    await saveBomItems(
      upsertBomItem(bomItems, {
        id: editingBomId ?? bomForm.id,
        finishedMaterialName: bomForm.finishedMaterialName,
        finishedSpecModel: bomForm.finishedSpecModel,
        finishedPurchaseCost: toNumber(bomForm.finishedPurchaseCost),
        components
      })
    );
    setBomForm(emptyBomForm());
    setEditingBomId(null);
    setBomModalOpen(false);
  };

  const value: WorkspaceContextValue = {
    orders,
    bomItems,
    summaries,
    inventoryRows,
    profit,
    backorders,
    overDeliveries,
    lowInventory,
    openNewOrder,
    openEditOrder,
    openDelivery,
    openEditDelivery,
    openPurchase,
    openEditPurchase,
    deleteOrder,
    completeOrder,
    reopenCompletedOrder,
    openNewBom,
    openEditBom,
    deleteBom,
    exportCsv,
    openImportEntry
  };

  return (
    <OrderWorkspaceContext.Provider value={value}>
      {children}
      <OrderModal
        open={orderModalOpen}
        form={orderForm}
        orders={orders}
        bomItems={bomItems}
        onChange={setOrderForm}
        editing={Boolean(editingOrderId)}
        onClose={() => {
          setOrderModalOpen(false);
          setEditingOrderId(null);
        }}
        onSubmit={() => void submitOrder()}
        onPick={(source) => void attachOrderImage(source)}
      />
      <DeliveryModal
        open={deliveryModalOpen}
        form={deliveryForm}
        target={selectedOrder ?? (selectedLine ? { order: selectedLine.order, line: selectedLine.line } : null)}
        editing={Boolean(editingDelivery)}
        onChange={setDeliveryForm}
        onClose={() => {
          setDeliveryModalOpen(false);
          setSelectedOrder(null);
          setSelectedLine(null);
          setEditingDelivery(null);
        }}
        onSubmit={() => void submitDelivery()}
      />
      <PurchaseModal
        open={purchaseModalOpen}
        form={purchaseForm}
        orders={orders}
        bomItems={bomItems}
        target={selectedLine}
        editing={Boolean(editingPurchase)}
        onChange={setPurchaseForm}
        onClose={() => {
          setPurchaseModalOpen(false);
          setSelectedLine(null);
          setEditingPurchase(null);
        }}
        onSubmit={() => void submitPurchase()}
        onPick={(source) => void attachPurchaseImage(source)}
      />
      <BomModal
        open={bomModalOpen}
        form={bomForm}
        orders={orders}
        bomItems={bomItems}
        editing={Boolean(editingBomId)}
        onChange={setBomForm}
        onClose={() => {
          setBomModalOpen(false);
          setEditingBomId(null);
        }}
        onSubmit={() => void submitBom()}
      />
    </OrderWorkspaceContext.Provider>
  );
}

export function useOrderWorkspace() {
  const context = useContext(OrderWorkspaceContext);
  if (!context) {
    throw new Error("useOrderWorkspace must be used inside OrderWorkspaceProvider");
  }
  return context;
}

function OrderModal(props: {
  open: boolean;
  editing: boolean;
  form: OrderFormState;
  orders: Order[];
  bomItems: BomItem[];
  onChange: (form: OrderFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  onPick: (source: "camera" | "library") => void;
}) {
  const { form, onChange } = props;
  const suggestions = (field: Parameters<typeof getAutocompleteSuggestions>[1], query: string) =>
    getAutocompleteSuggestions({ orders: props.orders, bomItems: props.bomItems }, field, query);
  return (
    <FormModal open={props.open} title={props.editing ? "编辑订单" : "新建订单"} onClose={props.onClose}>
      <ImportStrip
        title="导入订单资料"
        description="选择订单附件后可先进入台账表单，后续解析结果将落到这些字段。"
        actionLabel="选择附件"
        onPress={() => props.onPick("library")}
      />
      <Field
        label="客户公司"
        value={form.companyName}
        onChangeText={(value) => onChange({ ...form, companyName: value })}
        suggestions={suggestions("companyName", form.companyName)}
      />
      <Field label="采购单号" value={form.customerPoNo} onChangeText={(value) => onChange({ ...form, customerPoNo: value })} />
      <Field label="订单日期" value={form.orderDate} onChangeText={(value) => onChange({ ...form, orderDate: value })} placeholder="2026-07-07" />
      <SectionTitle title="物料明细" />
      {form.lines.map((line, index) => (
        <View key={line.id ?? index} style={styles.subCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.strong}>物料 {index + 1}</Text>
            {form.lines.length > 1 ? (
              <Pressable
                onPress={() => onChange({ ...form, lines: form.lines.filter((_, lineIndex) => lineIndex !== index) })}
                style={styles.iconOnly}
              >
                <X color="#a3392b" size={16} />
              </Pressable>
            ) : null}
          </View>
          <Field
            label="物料名称"
            value={line.materialName}
            onChangeText={(value) => onChange(updateOrderFormLine(form, index, { materialName: value }))}
            suggestions={suggestions("materialName", line.materialName)}
          />
          <Field
            label="规格型号"
            value={line.specModel}
            onChangeText={(value) => onChange(updateOrderFormLine(form, index, { specModel: value }))}
            suggestions={suggestions("specModel", line.specModel)}
          />
          <View style={styles.formGrid}>
            <Field label="数量" value={line.quantity} onChangeText={(value) => onChange(updateOrderLineWithAutoTotal(form, index, { quantity: value }))} keyboardType="numeric" />
            <Field
              label="单位"
              value={line.unit}
              onChangeText={(value) => onChange(updateOrderFormLine(form, index, { unit: value }))}
              suggestions={suggestions("purchaseUnit", line.unit)}
            />
          </View>
          <View style={styles.formGrid}>
            <Field label="含税单价" value={line.taxIncludedUnitPrice} onChangeText={(value) => onChange(updateOrderLineWithAutoTotal(form, index, { taxIncludedUnitPrice: value }))} keyboardType="numeric" />
            <Field label="价税合计" value={line.taxIncludedTotal} onChangeText={(value) => onChange(updateOrderFormLine(form, index, { taxIncludedTotal: value }))} keyboardType="numeric" />
          </View>
        </View>
      ))}
      <SmallButton icon={<Plus color={colors.ink} size={16} />} label="增加物料" onPress={() => onChange({ ...form, lines: [...form.lines, emptyOrderLineForm()] })} />
      <Field label="备注" value={form.note} onChangeText={(value) => onChange({ ...form, note: value })} multiline />
      {form.sourceImageUri ? <Image source={{ uri: form.sourceImageUri }} style={styles.formImage} /> : null}
      <View style={styles.actionRow}>
        <SmallButton icon={<Camera color={colors.ink} size={16} />} label="拍照附件" onPress={() => props.onPick("camera")} />
        <SmallButton icon={<Archive color={colors.ink} size={16} />} label="选择附件" onPress={() => props.onPick("library")} />
      </View>
      <PrimaryButton label={props.editing ? "保存修改" : "保存订单"} onPress={props.onSubmit} />
    </FormModal>
  );
}

function DeliveryModal(props: {
  open: boolean;
  form: DeliveryFormState;
  target: SelectedOrder | null;
  editing: boolean;
  onChange: (form: DeliveryFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { form, onChange } = props;
  return (
    <FormModal open={props.open} title={props.editing ? "编辑送货" : "新增送货"} onClose={props.onClose}>
      {props.target ? (
        <Text style={styles.formTarget}>
          {props.target.order.companyName}
          {props.target.line ? ` / ${props.target.line.specModel}` : " / 多物料送货单"}
        </Text>
      ) : null}
      <Field label="快递公司" value={form.courierCompany} onChangeText={(value) => onChange({ ...form, courierCompany: value })} />
      <Field label="快递单号" value={form.trackingNo} onChangeText={(value) => onChange({ ...form, trackingNo: value })} />
      <Field label="发货日期" value={form.shipDate} onChangeText={(value) => onChange({ ...form, shipDate: value })} placeholder="2026-07-07" />
      <SectionTitle title="送货明细" />
      {form.lines.map((line, index) => (
        <View key={line.lineId} style={styles.subCard}>
          <Text style={styles.strong}>
            {line.materialName} / {line.specModel}
          </Text>
          <Field
            label={`送货数量（${line.unit}）`}
            value={line.quantity}
            onChangeText={(value) =>
              onChange({
                ...form,
                lines: form.lines.map((candidate, lineIndex) =>
                  lineIndex === index ? { ...candidate, quantity: value } : candidate
                )
              })
            }
            keyboardType="numeric"
          />
        </View>
      ))}
      <Field label="备注" value={form.note} onChangeText={(value) => onChange({ ...form, note: value })} multiline />
      <PrimaryButton label={props.editing ? "保存修改" : "保存送货记录"} onPress={props.onSubmit} />
    </FormModal>
  );
}

function PurchaseModal(props: {
  open: boolean;
  form: PurchaseFormState;
  orders: Order[];
  bomItems: BomItem[];
  target: SelectedLine | null;
  editing: boolean;
  onChange: (form: PurchaseFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  onPick: (source: "camera" | "library") => void;
}) {
  const { form, onChange } = props;
  const suggestions = (field: Parameters<typeof getAutocompleteSuggestions>[1], query: string) =>
    getAutocompleteSuggestions({ orders: props.orders, bomItems: props.bomItems }, field, query);
  return (
    <FormModal open={props.open} title={props.editing ? "编辑买入" : "新增买入"} onClose={props.onClose}>
      {props.target ? <Text style={styles.formTarget}>{props.target.order.companyName} / {props.target.line.specModel}</Text> : null}
      <ImportStrip
        title="导入买入资料"
        description="选择供应商订单或付款凭证附件，明细字段可继续手工校正。"
        actionLabel="选择凭证"
        onPress={() => props.onPick("library")}
      />
      <Field
        label="供应商/店铺"
        value={form.supplierName}
        onChangeText={(value) => onChange({ ...form, supplierName: value })}
        suggestions={suggestions("supplierName", form.supplierName)}
      />
      <Field label="淘宝订单号" value={form.taobaoOrderNo} onChangeText={(value) => onChange({ ...form, taobaoOrderNo: value })} />
      <Field label="买入日期" value={form.purchaseDate} onChangeText={(value) => onChange({ ...form, purchaseDate: value })} />
      <Field
        label="买入规格"
        value={form.purchaseSpec}
        onChangeText={(value) => onChange({ ...form, purchaseSpec: value })}
        suggestions={suggestions("purchaseSpec", form.purchaseSpec)}
      />
      <View style={styles.formGrid}>
        <Field label="买入数量" value={form.purchaseQuantity} onChangeText={(value) => onChange(updatePurchaseWithAutoTotal(form, { purchaseQuantity: value }))} keyboardType="numeric" />
        <Field
          label="买入单位"
          value={form.purchaseUnit}
          onChangeText={(value) => onChange({ ...form, purchaseUnit: value })}
          suggestions={suggestions("purchaseUnit", form.purchaseUnit)}
        />
      </View>
      <View style={styles.formGrid}>
        <Field label="买入单价" value={form.purchaseUnitPrice} onChangeText={(value) => onChange(updatePurchaseWithAutoTotal(form, { purchaseUnitPrice: value }))} keyboardType="numeric" />
        <Field label="买入总价" value={form.purchaseTotal} onChangeText={(value) => onChange({ ...form, purchaseTotal: value })} keyboardType="numeric" />
      </View>
      <Field label="换算比例" value={form.conversionRatioToOrderUnit} onChangeText={(value) => onChange({ ...form, conversionRatioToOrderUnit: value })} keyboardType="numeric" />
      <View style={styles.segmented}>
        {(["yes", "no"] as const).map((value) => (
          <Pressable key={value} onPress={() => onChange({ ...form, invoiceNeeded: value })} style={[styles.segment, form.invoiceNeeded === value && styles.activeSegment]}>
            <Text style={[styles.segmentText, form.invoiceNeeded === value && styles.activeSegmentText]}>{invoiceText(value)}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="备注" value={form.note} onChangeText={(value) => onChange({ ...form, note: value })} multiline />
      {form.attachmentUri ? <Image source={{ uri: form.attachmentUri }} style={styles.formImage} /> : null}
      <View style={styles.actionRow}>
        <SmallButton icon={<Camera color={colors.ink} size={16} />} label="拍照凭证" onPress={() => props.onPick("camera")} />
        <SmallButton icon={<Archive color={colors.ink} size={16} />} label="选择凭证" onPress={() => props.onPick("library")} />
      </View>
      <PrimaryButton label={props.editing ? "保存修改" : "保存买入记录"} onPress={props.onSubmit} />
    </FormModal>
  );
}

function BomModal(props: {
  open: boolean;
  form: BomFormState;
  orders: Order[];
  bomItems: BomItem[];
  editing: boolean;
  onChange: (form: BomFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { form, onChange } = props;
  const suggestions = (field: Parameters<typeof getAutocompleteSuggestions>[1], query: string) =>
    getAutocompleteSuggestions({ orders: props.orders, bomItems: props.bomItems }, field, query);

  return (
    <FormModal open={props.open} title={props.editing ? "编辑 BOM" : "新增 BOM"} onClose={props.onClose}>
      <Field
        label="成品物料名称"
        value={form.finishedMaterialName}
        onChangeText={(value) => onChange({ ...form, finishedMaterialName: value })}
        suggestions={suggestions("materialName", form.finishedMaterialName)}
      />
      <Field
        label="成品规格型号"
        value={form.finishedSpecModel}
        onChangeText={(value) => onChange({ ...form, finishedSpecModel: value })}
        suggestions={suggestions("specModel", form.finishedSpecModel)}
      />
      <Field
        label="成品采购成本"
        value={form.finishedPurchaseCost}
        onChangeText={(value) => onChange({ ...form, finishedPurchaseCost: value })}
        keyboardType="numeric"
      />
      <SectionTitle title="下级零部件" />
      {form.components.map((component, index) => (
        <View key={component.id ?? index} style={styles.subCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.strong}>零部件 {index + 1}</Text>
            {form.components.length > 1 ? (
              <Pressable
                onPress={() => onChange({ ...form, components: form.components.filter((_, componentIndex) => componentIndex !== index) })}
                style={styles.iconOnly}
              >
                <X color="#a3392b" size={16} />
              </Pressable>
            ) : null}
          </View>
          <Field
            label="零部件名称"
            value={component.materialName}
            onChangeText={(value) => onChange(updateBomComponent(form, index, { materialName: value }))}
            suggestions={suggestions("materialName", component.materialName)}
          />
          <Field
            label="零部件规格型号"
            value={component.specModel}
            onChangeText={(value) => onChange(updateBomComponent(form, index, { specModel: value }))}
            suggestions={suggestions("specModel", component.specModel)}
          />
          <Field
            label="数量"
            value={component.quantity}
            onChangeText={(value) => onChange(updateBomComponent(form, index, { quantity: value }))}
            keyboardType="numeric"
          />
        </View>
      ))}
      <SmallButton icon={<Plus color={colors.ink} size={16} />} label="增加零部件" onPress={() => onChange({ ...form, components: [...form.components, emptyBomComponentForm()] })} />
      <PrimaryButton label={props.editing ? "保存修改" : "保存 BOM"} onPress={props.onSubmit} />
    </FormModal>
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

function orderToForm(order: Order): OrderFormState {
  return {
    companyName: order.companyName,
    customerPoNo: order.customerPoNo ?? "",
    orderDate: order.orderDate,
    lines: order.lines.map((line) => ({
      id: line.id,
      materialName: line.materialName,
      specModel: line.specModel,
      quantity: String(line.quantity),
      unit: line.unit,
      taxIncludedUnitPrice: String(line.taxIncludedUnitPrice),
      taxIncludedTotal: String(line.taxIncludedTotal)
    })),
    note: order.note ?? "",
    sourceImageUri: order.sourceImage?.dataUrl
  };
}

function bomItemToForm(item: BomItem): BomFormState {
  return {
    id: item.id,
    finishedMaterialName: item.finishedMaterialName,
    finishedSpecModel: item.finishedSpecModel,
    finishedPurchaseCost: String(item.finishedPurchaseCost),
    components: item.components.map((component) => ({
      id: component.id,
      materialName: component.materialName,
      specModel: component.specModel,
      quantity: String(component.quantity)
    }))
  };
}

function updateOrderFormLine(form: OrderFormState, index: number, patch: Partial<OrderLineFormState>): OrderFormState {
  return {
    ...form,
    lines: form.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
  };
}

function updateBomComponent(form: BomFormState, index: number, patch: Partial<BomComponentFormState>): BomFormState {
  return {
    ...form,
    components: form.components.map((component, componentIndex) =>
      componentIndex === index ? { ...component, ...patch } : component
    )
  };
}

function updateOrderLineWithAutoTotal(form: OrderFormState, index: number, patch: Partial<OrderLineFormState>): OrderFormState {
  const current = form.lines[index];
  const next = { ...current, ...patch };
  const quantity = toNumber(next.quantity);
  const unitPrice = toNumber(next.taxIncludedUnitPrice);
  return updateOrderFormLine(form, index, {
    ...patch,
    taxIncludedTotal: quantity > 0 && unitPrice > 0 ? String(roundMoney(quantity * unitPrice)) : next.taxIncludedTotal
  });
}

function updatePurchaseWithAutoTotal(form: PurchaseFormState, patch: Partial<PurchaseFormState>): PurchaseFormState {
  const next = { ...form, ...patch };
  const quantity = toNumber(next.purchaseQuantity);
  const unitPrice = toNumber(next.purchaseUnitPrice);
  return {
    ...next,
    purchaseTotal: quantity > 0 && unitPrice > 0 ? String(roundMoney(quantity * unitPrice)) : next.purchaseTotal
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}
