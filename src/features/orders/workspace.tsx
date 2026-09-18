import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Image, Platform, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Archive, Camera, Plus, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
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
  isReady: boolean;
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

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

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
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
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
    let active = true;

    void Promise.allSettled([orderRepository.load(), bomRepository.load()]).then(([ordersResult, bomResult]) => {
      if (!active) return;
      if (ordersResult.status === "fulfilled") setOrders(ordersResult.value);
      else Alert.alert(t("alerts.readFailed"), errorMessage(ordersResult.reason, t));
      if (bomResult.status === "fulfilled") setBomItems(bomResult.value);
      else Alert.alert(t("alerts.bomReadFailed"), errorMessage(bomResult.reason, t));
      setIsReady(true);
    });

    return () => {
      active = false;
    };
  }, [t]);

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
      Alert.alert(t("alerts.orderSaveFailed"), localizeValidationErrors(errors, t).join("\n"));
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
      Alert.alert(t("alerts.duplicateOrderTitle"), t("alerts.duplicateOrderMessage"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("alerts.continueSave"), onPress: () => void submitOrder(true) }
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
      Alert.alert(t("alerts.deliverySaveFailed"), localizeValidationErrors(errors, t).join("\n"));
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
      Alert.alert(t("alerts.purchaseSaveFailed"), localizeValidationErrors(errors, t).join("\n"));
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
    // Android's system photo picker grants access to the selected image without library permission.
    if (source === "camera" || Platform.OS !== "android") {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("alerts.noPermission"), source === "camera" ? t("alerts.cameraPermissionRequired") : t("alerts.libraryPermissionRequired"));
        return undefined;
      }
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
      Alert.alert(t("alerts.exportDone"), t("alerts.exportDoneMessage", { count: files.length }));
    } catch (error) {
      Alert.alert(t("alerts.exportFailed"), errorMessage(error, t));
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
        Alert.alert(t("alerts.importFailed"), t("alerts.noImportRows"));
        return;
      }

      const errors = importedInputs.flatMap((input, index) =>
        validateOrderInput(input).map((message) =>
          t("alerts.importedOrderPrefix", { number: index + 1, message: localizeValidationMessage(message, t) })
        )
      );
      if (errors.length) {
        Alert.alert(t("alerts.importFailed"), errors.slice(0, 6).join("\n"));
        return;
      }

      const importedOrders = importedInputs.map((input) => createOrder(input));
      const importedLineCount = importedOrders.reduce((total, order) => total + order.lines.length, 0);
      await saveOrders([...importedOrders, ...orders]);
      Alert.alert(t("alerts.importDone"), t("alerts.importDoneMessage", { orders: importedOrders.length, lines: importedLineCount }));
    } catch (error) {
      Alert.alert(t("alerts.importFailed"), errorMessage(error, t));
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
    Alert.alert(t("alerts.deleteOrder"), t("alerts.deleteOrderMessage", { orderNo: order.orderNo }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => void saveOrders(removeOrder(orders, order.id)) }
    ]);
  };

  const completeOrder = (order: Order) => {
    Alert.alert(t("alerts.markComplete"), t("alerts.markCompleteMessage", { orderNo: order.orderNo }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("alerts.complete"), onPress: () => void saveOrders(markOrderCompleted(orders, order.id)) }
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
    Alert.alert(t("alerts.deleteBom"), t("alerts.deleteBomMessage", { name: item.finishedMaterialName, spec: item.finishedSpecModel }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => void saveBomItems(removeBomItem(bomItems, item.id)) }
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
      !bomForm.finishedMaterialName.trim() && t("validation.finishedMaterialRequired"),
      !bomForm.finishedSpecModel.trim() && t("validation.finishedSpecRequired"),
      toNumber(bomForm.finishedPurchaseCost) < 0 && t("validation.finishedCostNonNegative"),
      !components.length && t("validation.componentRequired"),
      ...components.flatMap((component, index) => {
        const prefix = components.length > 1 ? t("validation.componentPrefix", { number: index + 1 }) : t("validation.componentSinglePrefix");
        return [
          !component.materialName.trim() && t("validation.componentNameRequired", { prefix }),
          !component.specModel.trim() && t("validation.componentSpecRequired", { prefix }),
          component.quantity <= 0 && t("validation.componentQuantityRequired", { prefix })
        ].filter(Boolean) as string[];
      })
    ].filter(Boolean) as string[];
    if (errors.length) {
      Alert.alert(t("alerts.bomSaveFailed"), errors.join("\n"));
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
    isReady,
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
  const { t } = useTranslation();
  const suggestions = (field: Parameters<typeof getAutocompleteSuggestions>[1], query: string) =>
    getAutocompleteSuggestions({ orders: props.orders, bomItems: props.bomItems }, field, query);
  return (
    <FormModal open={props.open} title={props.editing ? t("forms.editOrder") : t("forms.newOrder")} onClose={props.onClose}>
      <ImportStrip
        title={t("forms.importOrderTitle")}
        description={t("forms.importOrderDescription")}
        actionLabel={t("forms.chooseAttachment")}
        onPress={() => props.onPick("library")}
      />
      <Field
        label={t("forms.companyName")}
        value={form.companyName}
        onChangeText={(value) => onChange({ ...form, companyName: value })}
        suggestions={suggestions("companyName", form.companyName)}
      />
      <Field label={t("forms.customerPoNo")} value={form.customerPoNo} onChangeText={(value) => onChange({ ...form, customerPoNo: value })} />
      <Field label={t("forms.orderDate")} value={form.orderDate} onChangeText={(value) => onChange({ ...form, orderDate: value })} placeholder="2026-07-07" />
      <SectionTitle title={t("forms.materialDetails")} />
      {form.lines.map((line, index) => (
        <View key={line.id ?? index} style={styles.subCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.strong}>{t("orders.materialNumber", { number: index + 1 })}</Text>
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
            label={t("forms.materialName")}
            value={line.materialName}
            onChangeText={(value) => onChange(updateOrderFormLine(form, index, { materialName: value }))}
            suggestions={suggestions("materialName", line.materialName)}
          />
          <Field
            label={t("forms.specModel")}
            value={line.specModel}
            onChangeText={(value) => onChange(updateOrderFormLine(form, index, { specModel: value }))}
            suggestions={suggestions("specModel", line.specModel)}
          />
          <View style={styles.formGrid}>
            <Field label={t("forms.quantity")} value={line.quantity} onChangeText={(value) => onChange(updateOrderLineWithAutoTotal(form, index, { quantity: value }))} keyboardType="numeric" />
            <Field
              label={t("forms.unit")}
              value={line.unit}
              onChangeText={(value) => onChange(updateOrderFormLine(form, index, { unit: value }))}
              suggestions={suggestions("purchaseUnit", line.unit)}
            />
          </View>
          <View style={styles.formGrid}>
            <Field label={t("forms.taxIncludedUnitPrice")} value={line.taxIncludedUnitPrice} onChangeText={(value) => onChange(updateOrderLineWithAutoTotal(form, index, { taxIncludedUnitPrice: value }))} keyboardType="numeric" />
            <Field label={t("forms.taxIncludedTotal")} value={line.taxIncludedTotal} onChangeText={(value) => onChange(updateOrderFormLine(form, index, { taxIncludedTotal: value }))} keyboardType="numeric" />
          </View>
        </View>
      ))}
      <SmallButton icon={<Plus color={colors.ink} size={16} />} label={t("forms.addMaterial")} onPress={() => onChange({ ...form, lines: [...form.lines, emptyOrderLineForm()] })} />
      <Field label={t("forms.note")} value={form.note} onChangeText={(value) => onChange({ ...form, note: value })} multiline />
      {form.sourceImageUri ? <Image source={{ uri: form.sourceImageUri }} style={styles.formImage} /> : null}
      <View style={styles.actionRow}>
        <SmallButton icon={<Camera color={colors.ink} size={16} />} label={t("forms.takePhoto")} onPress={() => props.onPick("camera")} />
        <SmallButton icon={<Archive color={colors.ink} size={16} />} label={t("forms.chooseAttachment")} onPress={() => props.onPick("library")} />
      </View>
      <PrimaryButton label={props.editing ? t("common.saveChanges") : t("forms.saveOrder")} onPress={props.onSubmit} />
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
  const { t } = useTranslation();
  return (
    <FormModal open={props.open} title={props.editing ? t("forms.editDelivery") : t("forms.newDelivery")} onClose={props.onClose}>
      {props.target ? (
        <Text style={styles.formTarget}>
          {props.target.order.companyName}
          {props.target.line ? ` / ${props.target.line.specModel}` : ` / ${t("forms.multiMaterialDelivery")}`}
        </Text>
      ) : null}
      <Field label={t("forms.courierCompany")} value={form.courierCompany} onChangeText={(value) => onChange({ ...form, courierCompany: value })} />
      <Field label={t("forms.trackingNo")} value={form.trackingNo} onChangeText={(value) => onChange({ ...form, trackingNo: value })} />
      <Field label={t("forms.shipDate")} value={form.shipDate} onChangeText={(value) => onChange({ ...form, shipDate: value })} placeholder="2026-07-07" />
      <SectionTitle title={t("forms.deliveryDetails")} />
      {form.lines.map((line, index) => (
        <View key={line.lineId} style={styles.subCard}>
          <Text style={styles.strong}>
            {line.materialName} / {line.specModel}
          </Text>
          <Field
            label={t("forms.deliveryQuantityWithUnit", { unit: line.unit })}
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
      <Field label={t("forms.note")} value={form.note} onChangeText={(value) => onChange({ ...form, note: value })} multiline />
      <PrimaryButton label={props.editing ? t("common.saveChanges") : t("forms.saveDelivery")} onPress={props.onSubmit} />
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
  const { t } = useTranslation();
  const suggestions = (field: Parameters<typeof getAutocompleteSuggestions>[1], query: string) =>
    getAutocompleteSuggestions({ orders: props.orders, bomItems: props.bomItems }, field, query);
  return (
    <FormModal open={props.open} title={props.editing ? t("forms.editPurchase") : t("forms.newPurchase")} onClose={props.onClose}>
      {props.target ? <Text style={styles.formTarget}>{props.target.order.companyName} / {props.target.line.specModel}</Text> : null}
      <ImportStrip
        title={t("forms.importPurchaseTitle")}
        description={t("forms.importPurchaseDescription")}
        actionLabel={t("forms.chooseProof")}
        onPress={() => props.onPick("library")}
      />
      <Field
        label={t("forms.supplier")}
        value={form.supplierName}
        onChangeText={(value) => onChange({ ...form, supplierName: value })}
        suggestions={suggestions("supplierName", form.supplierName)}
      />
      <Field label={t("forms.supplierOrderNo")} value={form.taobaoOrderNo} onChangeText={(value) => onChange({ ...form, taobaoOrderNo: value })} />
      <Field label={t("forms.purchaseDate")} value={form.purchaseDate} onChangeText={(value) => onChange({ ...form, purchaseDate: value })} />
      <Field
        label={t("forms.purchaseSpec")}
        value={form.purchaseSpec}
        onChangeText={(value) => onChange({ ...form, purchaseSpec: value })}
        suggestions={suggestions("purchaseSpec", form.purchaseSpec)}
      />
      <View style={styles.formGrid}>
        <Field label={t("forms.purchaseQuantity")} value={form.purchaseQuantity} onChangeText={(value) => onChange(updatePurchaseWithAutoTotal(form, { purchaseQuantity: value }))} keyboardType="numeric" />
        <Field
          label={t("forms.purchaseUnit")}
          value={form.purchaseUnit}
          onChangeText={(value) => onChange({ ...form, purchaseUnit: value })}
          suggestions={suggestions("purchaseUnit", form.purchaseUnit)}
        />
      </View>
      <View style={styles.formGrid}>
        <Field label={t("forms.purchaseUnitPrice")} value={form.purchaseUnitPrice} onChangeText={(value) => onChange(updatePurchaseWithAutoTotal(form, { purchaseUnitPrice: value }))} keyboardType="numeric" />
        <Field label={t("forms.purchaseTotal")} value={form.purchaseTotal} onChangeText={(value) => onChange({ ...form, purchaseTotal: value })} keyboardType="numeric" />
      </View>
      <Field label={t("forms.conversionRatio")} value={form.conversionRatioToOrderUnit} onChangeText={(value) => onChange({ ...form, conversionRatioToOrderUnit: value })} keyboardType="numeric" />
      <View style={styles.segmented}>
        {(["yes", "no"] as const).map((value) => (
          <Pressable key={value} onPress={() => onChange({ ...form, invoiceNeeded: value })} style={[styles.segment, form.invoiceNeeded === value && styles.activeSegment]}>
            <Text style={[styles.segmentText, form.invoiceNeeded === value && styles.activeSegmentText]}>{invoiceText(value)}</Text>
          </Pressable>
        ))}
      </View>
      <Field label={t("forms.note")} value={form.note} onChangeText={(value) => onChange({ ...form, note: value })} multiline />
      {form.attachmentUri ? <Image source={{ uri: form.attachmentUri }} style={styles.formImage} /> : null}
      <View style={styles.actionRow}>
        <SmallButton icon={<Camera color={colors.ink} size={16} />} label={t("forms.takeProofPhoto")} onPress={() => props.onPick("camera")} />
        <SmallButton icon={<Archive color={colors.ink} size={16} />} label={t("forms.chooseProof")} onPress={() => props.onPick("library")} />
      </View>
      <PrimaryButton label={props.editing ? t("common.saveChanges") : t("forms.savePurchase")} onPress={props.onSubmit} />
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
  const { t } = useTranslation();
  const suggestions = (field: Parameters<typeof getAutocompleteSuggestions>[1], query: string) =>
    getAutocompleteSuggestions({ orders: props.orders, bomItems: props.bomItems }, field, query);

  return (
    <FormModal open={props.open} title={props.editing ? t("forms.editBom") : t("forms.newBom")} onClose={props.onClose}>
      <Field
        label={t("forms.finishedMaterialName")}
        value={form.finishedMaterialName}
        onChangeText={(value) => onChange({ ...form, finishedMaterialName: value })}
        suggestions={suggestions("materialName", form.finishedMaterialName)}
      />
      <Field
        label={t("forms.finishedSpecModel")}
        value={form.finishedSpecModel}
        onChangeText={(value) => onChange({ ...form, finishedSpecModel: value })}
        suggestions={suggestions("specModel", form.finishedSpecModel)}
      />
      <Field
        label={t("forms.finishedPurchaseCost")}
        value={form.finishedPurchaseCost}
        onChangeText={(value) => onChange({ ...form, finishedPurchaseCost: value })}
        keyboardType="numeric"
      />
      <SectionTitle title={t("forms.childComponents")} />
      {form.components.map((component, index) => (
        <View key={component.id ?? index} style={styles.subCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.strong}>{t("bom.componentNumber", { number: index + 1 })}</Text>
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
            label={t("forms.componentName")}
            value={component.materialName}
            onChangeText={(value) => onChange(updateBomComponent(form, index, { materialName: value }))}
            suggestions={suggestions("materialName", component.materialName)}
          />
          <Field
            label={t("forms.componentSpecModel")}
            value={component.specModel}
            onChangeText={(value) => onChange(updateBomComponent(form, index, { specModel: value }))}
            suggestions={suggestions("specModel", component.specModel)}
          />
          <Field
            label={t("forms.quantity")}
            value={component.quantity}
            onChangeText={(value) => onChange(updateBomComponent(form, index, { quantity: value }))}
            keyboardType="numeric"
          />
        </View>
      ))}
      <SmallButton icon={<Plus color={colors.ink} size={16} />} label={t("forms.addComponent")} onPress={() => onChange({ ...form, components: [...form.components, emptyBomComponentForm()] })} />
      <PrimaryButton label={props.editing ? t("common.saveChanges") : t("forms.saveBom")} onPress={props.onSubmit} />
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

function localizeValidationErrors(errors: string[], t: TranslateFn): string[] {
  return errors.map((message) => localizeValidationMessage(message, t));
}

function localizeValidationMessage(message: string, t: TranslateFn): string {
  const lineMatch = message.match(/^第 (\d+) 行(.+)$/);
  const prefix = lineMatch ? t("validation.orderLinePrefix", { number: Number(lineMatch[1]) }) : "";
  const normalizedMessage = lineMatch?.[2] ?? message;

  switch (normalizedMessage) {
    case "客户公司不能为空":
      return t("validation.companyRequired");
    case "订单日期不能为空":
      return t("validation.orderDateRequired");
    case "至少需要 1 行物料":
      return t("validation.materialLineRequired");
    case "物料名称不能为空":
      return t("validation.materialRequired", { prefix });
    case "规格型号不能为空":
      return t("validation.specRequired", { prefix });
    case "订单数量必须大于 0":
      return t("validation.orderQuantityRequired", { prefix });
    case "含税单价必须大于 0":
      return t("validation.unitPriceRequired", { prefix });
    case "快递单号不能为空":
      return t("validation.trackingRequired");
    case "发货日期不能为空":
      return t("validation.shipDateRequired");
    case "至少填写 1 行送货数量":
      return t("validation.deliveryLineRequired");
    case "送货数量必须大于 0":
      return t("validation.deliveryQuantityRequired");
    case "买入日期不能为空":
      return t("validation.purchaseDateRequired");
    case "买入规格不能为空":
      return t("validation.purchaseSpecRequired");
    case "买入数量必须大于 0":
      return t("validation.purchaseQuantityRequired");
    case "买入单价必须大于 0":
      return t("validation.purchaseUnitPriceRequired");
    case "换算比例必须大于 0":
      return t("validation.conversionRatioRequired");
    default:
      return message;
  }
}

function errorMessage(error: unknown, t: TranslateFn): string {
  return error instanceof Error ? error.message : t("common.unknownError");
}
