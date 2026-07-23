import React from "react";
import {
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
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AlertTriangle,
  Download,
  FileUp,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Truck,
  X
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { summarizeLine } from "../../domain/calculations";
import { InvoiceNeeded, Order, OrderLine, OrderLineStatus } from "../../domain/types";
import { formatCurrency, translate } from "../../i18n";

export const colors = {
  bg: "#f7f8f4",
  ink: "#12312f",
  muted: "#687773",
  border: "#e1e5df",
  panel: "#ffffff",
  field: "#edf1ea",
  accent: "#e7563f"
};

export function WorkspaceScreen({
  title,
  subtitle,
  children,
  onExport,
  onNewOrder
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onExport: () => void;
  onNewOrder: () => void;
}) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />
      <View style={styles.header}>
        <View style={styles.flexOne}>
          <Text style={styles.appTitle}>{title}</Text>
          <Text style={styles.appSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton icon={<Download color="#f7f8f4" size={19} />} label={t("common.export")} onPress={onExport} />
          <IconButton icon={<Plus color="#f7f8f4" size={20} />} label={t("common.newOrder")} onPress={onNewOrder} />
        </View>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.searchBox}>
      <Search color="#21413e" size={18} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t("common.searchPlaceholder")}
        placeholderTextColor="#7c8b86"
        style={styles.searchInput}
      />
    </View>
  );
}

export type SegmentOption<T extends string> = {
  key: T;
  label: string;
  count?: number;
};

export function SegmentTabs<T extends string>({
  options,
  active,
  onChange
}: {
  options: Array<SegmentOption<T>>;
  active: T;
  onChange: (value: T) => void;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentScroll}>
      {options.map((option) => {
        const selected = active === option.key;
        return (
          <Pressable key={option.key} onPress={() => onChange(option.key)} style={[styles.tab, selected && styles.activeTab]}>
            <Text style={[styles.tabText, selected && styles.activeTabText]}>
              {option.label}
              {typeof option.count === "number" ? ` ${option.count}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ImportStrip({
  title,
  description,
  actionLabel,
  onPress
}: {
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.importStrip}>
      <View style={styles.importIcon}>
        <FileUp color={colors.ink} size={19} />
      </View>
      <View style={styles.flexOne}>
        <Text style={styles.importTitle}>{title}</Text>
        <Text style={styles.importDescription}>{description}</Text>
      </View>
      <SmallButton icon={<FileUp color={colors.ink} size={16} />} label={actionLabel} onPress={onPress} />
    </View>
  );
}

export function OrderCard({
  order,
  onEditOrder,
  onDelivery,
  onEditDelivery,
  onPurchase,
  onEditPurchase,
  onDelete,
  onComplete,
  onReopen
}: {
  order: Order;
  onEditOrder: (order: Order) => void;
  onDelivery: (order: Order, line?: OrderLine) => void;
  onEditDelivery: (order: Order, line: OrderLine, deliveryId: string) => void;
  onPurchase: (order: Order, line: OrderLine) => void;
  onEditPurchase: (order: Order, line: OrderLine, purchaseId: string) => void;
  onDelete: (order: Order) => void;
  onComplete: (order: Order) => void;
  onReopen: (order: Order) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.flexOne}>
          <Text style={styles.cardTitle}>{order.companyName}</Text>
          <Text style={styles.meta}>
            {order.orderNo} / {order.orderDate}
          </Text>
        </View>
        <Pressable onPress={() => onEditOrder(order)} style={styles.iconOnly}>
          <Pencil color="#21413e" size={17} />
        </Pressable>
        <Pressable onPress={() => onDelete(order)} style={styles.iconOnly}>
          <X color="#a3392b" size={18} />
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <SmallButton icon={<Truck color={colors.ink} size={16} />} label={t("orders.deliverySheet")} onPress={() => onDelivery(order)} />
        {order.completedAt ? (
          <SmallButton icon={<PackageCheck color={colors.ink} size={16} />} label={t("orders.reopen")} onPress={() => onReopen(order)} />
        ) : (
          <SmallButton icon={<PackageCheck color={colors.ink} size={16} />} label={t("orders.markComplete")} onPress={() => onComplete(order)} />
        )}
      </View>
      {order.sourceImage ? <Image source={{ uri: order.sourceImage.dataUrl }} style={styles.attachmentPreview} /> : null}
      {order.lines.map((line) => {
        const summary = summarizeLine(order, line);
        return (
          <View key={line.id} style={styles.lineBlock}>
            <View style={styles.lineTop}>
              <View style={styles.flexOne}>
                <Text style={styles.strong}>
                  {line.materialName} / {line.specModel}
                </Text>
                <Text style={styles.meta}>
                  {line.quantity} {line.unit} x {formatCurrency(line.taxIncludedUnitPrice)}
                </Text>
              </View>
              <StatusPill status={summary.status} />
            </View>
            <View style={styles.metricsRow}>
              <MiniMetric label={t("orders.deliveredMetric")} value={summary.deliveredQuantity} />
              <MiniMetric label={t("orders.backorderMetric")} value={summary.backorderQuantity} danger={summary.backorderQuantity > 0} />
              <MiniMetric label={t("orders.inventoryMetric")} value={summary.inventoryBalance} danger={summary.inventoryBalance < 0} />
            </View>
            <View style={styles.actionRow}>
              <SmallButton icon={<Truck color={colors.ink} size={16} />} label={t("orders.singleLineDelivery")} onPress={() => onDelivery(order, line)} />
              <SmallButton icon={<PackageCheck color={colors.ink} size={16} />} label={t("orders.purchase")} onPress={() => onPurchase(order, line)} />
            </View>
            {line.deliveries.length ? (
              <View style={styles.recordList}>
                {line.deliveries.map((delivery) => (
                  <View key={delivery.id} style={styles.recordRow}>
                    <Text style={styles.meta}>
                      {t("orders.deliveryRecord", {
                        date: delivery.shipDate,
                        trackingNo: delivery.trackingNo,
                        quantity: delivery.quantity,
                        unit: line.unit
                      })}
                    </Text>
                    <Pressable onPress={() => onEditDelivery(order, line, delivery.id)} style={styles.inlineEdit}>
                      <Pencil color="#21413e" size={15} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {line.purchases.length ? (
              <View style={styles.recordList}>
                {line.purchases.map((purchase) => (
                  <View key={purchase.id} style={styles.recordRow}>
                    <Text style={styles.meta}>
                      {t("orders.purchaseRecord", {
                        date: purchase.purchaseDate,
                        spec: purchase.purchaseSpec,
                        total: formatCurrency(purchase.purchaseTotal),
                        invoice: invoiceText(purchase.invoiceNeeded)
                      })}
                    </Text>
                    <Pressable onPress={() => onEditPurchase(order, line, purchase.id)} style={styles.inlineEdit}>
                      <Pencil color="#21413e" size={15} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function FormModal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal animationType="slide" visible={open} onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.iconOnly}>
              <X color={colors.ink} size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>{children}</ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  suggestions = []
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
  suggestions?: string[];
}) {
  const visibleSuggestions = value.trim() ? suggestions.filter((suggestion) => suggestion !== value).slice(0, 5) : [];
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
      {visibleSuggestions.length ? (
        <View style={styles.suggestionList}>
          {visibleSuggestions.map((suggestion) => (
            <Pressable key={suggestion} onPress={() => onChangeText(suggestion)} style={styles.suggestionItem}>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: string | number; tone: "green" | "red" | "yellow" | "blue" }) {
  const toneStyle = {
    green: styles.statGreen,
    red: styles.statRed,
    yellow: styles.statYellow,
    blue: styles.statBlue
  }[tone];

  return (
    <View style={[styles.statTile, toneStyle]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function MiniMetric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, danger && styles.dangerText]}>{value}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: OrderLineStatus }) {
  const { t } = useTranslation();
  const label = t(`status.${status}`);
  return (
    <View style={[styles.pill, status === "over" && styles.pillDanger, status === "complete" && styles.pillSuccess]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyState}>{text}</Text>;
}

export function Notice({ text }: { text: string }) {
  return (
    <View style={styles.notice}>
      <AlertTriangle color="#a3392b" size={18} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SmallButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.smallButton}>
      {icon}
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton} accessibilityLabel={label}>
      {icon}
    </Pressable>
  );
}

export function formatMoney(value: number): string {
  return value.toFixed(2);
}

export function invoiceText(value: InvoiceNeeded) {
  if (value === "yes") return translate("invoice.yes");
  if (value === "no") return translate("invoice.no");
  return translate("invoice.unknown");
}

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    backgroundColor: colors.ink,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  appTitle: {
    color: "#f7f8f4",
    fontSize: 24,
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
  body: {
    flex: 1
  },
  bodyContent: {
    padding: 14,
    paddingBottom: 96,
    gap: 12
  },
  importStrip: {
    backgroundColor: "#e7efe7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d6dfd9",
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  importIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#f7f8f4",
    alignItems: "center",
    justifyContent: "center"
  },
  importTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  importDescription: {
    color: "#4c5d59",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2
  },
  segmentScroll: {
    paddingVertical: 2,
    gap: 8
  },
  tab: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#ecefe9"
  },
  activeTab: {
    backgroundColor: colors.accent
  },
  tabText: {
    color: "#41534f",
    fontWeight: "800"
  },
  activeTabText: {
    color: "#fff"
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
  statGreen: {
    backgroundColor: "#dfece6"
  },
  statRed: {
    backgroundColor: "#f8dfd8"
  },
  statYellow: {
    backgroundColor: "#f7ebc3"
  },
  statBlue: {
    backgroundColor: "#dce8f5"
  },
  statLabel: {
    color: "#50625e",
    fontSize: 13,
    fontWeight: "700"
  },
  statValue: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 10
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10
  },
  cardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start"
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  meta: {
    color: colors.muted,
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
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  recordList: {
    gap: 6
  },
  recordRow: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  inlineEdit: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#edf1ea",
    alignItems: "center",
    justifyContent: "center"
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
    color: colors.ink,
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
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  notice: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
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
    color: colors.muted,
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
    color: colors.ink,
    fontSize: 15
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.bg
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
    color: colors.ink,
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
  subCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    gap: 10
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
    color: colors.ink,
    fontSize: 15
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: "#d8dfd8",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  suggestionItem: {
    minHeight: 34,
    paddingHorizontal: 11,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#eef2ed"
  },
  suggestionText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700"
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
    backgroundColor: colors.ink,
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
    backgroundColor: colors.ink
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
