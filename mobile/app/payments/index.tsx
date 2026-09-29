import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { useInvoices } from "../../src/api/hooks";
import type { Invoice } from "../../src/api/types";
import { PrimaryButton } from "../../src/components/Buttons";
import { EmptyState } from "../../src/components/EmptyState";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { SectionHeader } from "../../src/components/SectionHeader";
import { TipBanner } from "../../src/components/TipBanner";
import { Card, Divider, InfoRow, Loading, Screen } from "../../src/components/ui";
import { formatDate, formatMoney } from "../../src/lib/stats";
import { colors, fonts, radius, spacing, type AccentName } from "../../src/theme";

const STATUS_ACCENT: Record<Invoice["status"], AccentName> = {
  due: "meals",
  paid: "activity",
  overdue: "health",
  cancelled: "neutral",
};

import { Modal, TextInput } from "react-native";
import { usePayMultiMonths } from "../../src/api/hooks";
import { useAuthStore } from "../../src/store/auth";
import { useClearSectionBadge } from "../../src/lib/useClearSectionBadge";
import { Tap } from "../../src/components/Tap";

export default function PaymentsScreen() {
  useClearSectionBadge("payments");
  const { t, i18n } = useTranslation();
  const invoices = useInvoices();
  const payMulti = usePayMultiMonths();
  const user = useAuthStore((s) => s.user);

  const [showMultiModal, setShowMultiModal] = useState(false);
  const [childIdText, setChildIdText] = useState("");
  const [monthsCountText, setMonthsCountText] = useState("3");
  const [startPeriodText, setStartPeriodText] = useState("2026-08");

  const isAdmin = user?.role === "admin";

  const handleProcessMultiPayment = () => {
    const childId = Number(childIdText);
    const monthsCount = Number(monthsCountText);
    if (!childId || !monthsCount) {
      Alert.alert(t("common.error"), "Child ID and months count are required.");
      return;
    }
    payMulti.mutate(
      {
        child_id: childId,
        months_count: monthsCount,
        start_period: startPeriodText.trim() || "2026-08",
      },
      {
        onSuccess: () => {
          setShowMultiModal(false);
          Alert.alert("Success", `Recorded payment for ${monthsCount} month(s)!`);
          void invoices.refetch();
        },
        onError: (err) => {
          Alert.alert(t("common.error"), errorMessage(err));
        },
      }
    );
  };

  const all = invoices.data ?? [];
  const open = all.filter((inv) => inv.status === "due" || inv.status === "overdue");
  const current = open[0];
  const paid = all.filter((inv) => inv.status === "paid");

  return (
    <Screen refreshing={invoices.isRefetching} onRefresh={() => void invoices.refetch()}>
      {isAdmin && (
        <Card style={styles.adminCard}>
          <Text style={styles.adminTitle}>Admin Payment Management</Text>
          <Text style={styles.adminSub}>Record payments for multiple months at once for a client</Text>
          <PrimaryButton
            label="Record Multi-Month Payment"
            icon="add-circle-outline"
            onPress={() => setShowMultiModal(true)}
          />
        </Card>
      )}

      <TipBanner
        icon="shield-checkmark"
        accent="primary"
        title={t("payments.secure")}
        text={t("payments.secureSub")}
      />

      {invoices.isLoading ? (
        <Loading />
      ) : !current ? (
        all.length === 0 ? (
          <EmptyState icon="card" title={t("payments.empty")} />
        ) : (
          <TipBanner icon="checkmark-circle" accent="activity" text={t("payments.allPaid")} />
        )
      ) : (
        <>
          {/* Amount due */}
          <Card style={styles.dueCard}>
            <View style={styles.dueHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.dueLabel}>{t("payments.amountDue")}</Text>
                <Text style={styles.dueAmount}>{formatMoney(current.total_minor, current.currency, i18n.language)}</Text>
                <Text style={styles.dueDate}>
                  📅 {t("payments.dueDate", { date: formatDate(current.due_date, i18n.language) })}
                </Text>
                <PillBadge
                  label={t(`enums.invoiceStatus.${current.status}`)}
                  accent={STATUS_ACCENT[current.status]}
                  icon="alert-circle"
                />
              </View>
              <IconCircle name="receipt" accent="primary" size={64} squircle />
            </View>
            {/* Parents don't pay in the app: the nursery office records payments. */}
            <View style={styles.officeNote}>
              <IconCircle name="business" accent="primary" size={32} />
              <Text style={styles.officeText}>{t("payments.payAtOffice")}</Text>
            </View>
          </Card>

          {/* Invoice summary */}
          <SectionHeader title={t("payments.invoiceSummary")} />
          <Card>
            <Text style={styles.invoiceNo}>{t("payments.invoiceNo", { no: current.invoice_no })}</Text>
            <Divider />
            {(current.items ?? []).map((item) => (
              <InfoRow
                key={item.id}
                label={item.label}
                value={formatMoney(item.amount_minor, current.currency, i18n.language)}
              />
            ))}
            <Divider />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t("payments.totalAmount")}</Text>
              <Text style={styles.totalValue}>{formatMoney(current.total_minor, current.currency, i18n.language)}</Text>
            </View>
          </Card>

          <TipBanner icon="information-circle" title={t("payments.importantNote")} text={t("payments.importantNoteText")} />
        </>
      )}

      {/* Recent payments */}
      {paid.length > 0 && (
        <>
          <SectionHeader title={t("payments.recentPayments")} />
          <Card>
            {paid.map((inv, i) => {
              const lastPayment = inv.payments?.[inv.payments.length - 1];
              return (
                <View key={inv.id}>
                  <View style={styles.paidRow}>
                    <IconCircle name="checkmark-circle" accent="activity" size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.paidPeriod}>{inv.period || inv.invoice_no}</Text>
                      <Text style={styles.paidSub}>{t("payments.invoiceNo", { no: inv.invoice_no })}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.paidAmount}>{formatMoney(inv.total_minor, inv.currency, i18n.language)}</Text>
                      {lastPayment?.paid_at ? (
                        <Text style={styles.paidSub}>
                          {t("payments.paidOn", { date: formatDate(lastPayment.paid_at, i18n.language) })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {i < paid.length - 1 && <Divider />}
                </View>
              );
            })}
          </Card>
        </>
      )}

      <Card style={styles.helpCard}>
        <IconCircle name="headset" accent="primary" size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.helpTitle}>{t("payments.needHelp")}</Text>
          <Text style={styles.helpSub}>{t("payments.needHelpSub")}</Text>
        </View>
      </Card>

      {/* Admin Multi-Month Payment Modal */}
      <Modal visible={showMultiModal} transparent animationType="fade" onRequestClose={() => setShowMultiModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Multi-Month Payment Entry</Text>
            <Text style={styles.modalSub}>Mark multiple months as paid for a student</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Child ID (e.g. 1)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={childIdText}
              onChangeText={setChildIdText}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Number of Months (e.g. 3)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={monthsCountText}
              onChangeText={setMonthsCountText}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Start Period (e.g. 2026-08)"
              placeholderTextColor={colors.textMuted}
              value={startPeriodText}
              onChangeText={setStartPeriodText}
            />
            <View style={styles.modalActions}>
              <Tap onPress={() => setShowMultiModal(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Tap>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Submit Payment"
                  onPress={handleProcessMultiPayment}
                  loading={payMulti.isPending}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  adminCard: { gap: spacing.sm, backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  adminTitle: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  adminSub: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  modalTitle: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  modalSub: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  modalInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  modalCancel: { paddingVertical: 12, paddingHorizontal: spacing.md },
  modalCancelText: { fontFamily: fonts.bold, color: colors.textMuted },
  dueCard: { gap: spacing.md },
  dueHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dueLabel: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  dueAmount: { fontSize: 30, fontFamily: fonts.extrabold, color: colors.danger },
  dueDate: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  officeNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  officeText: { flex: 1, fontSize: 12, fontFamily: fonts.semibold, color: colors.text, lineHeight: 17 },
  invoiceNo: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.text, paddingBottom: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6 },
  totalLabel: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  totalValue: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.primary },
  paidRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingVertical: 6 },
  paidPeriod: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  paidSub: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  paidAmount: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  helpCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, backgroundColor: colors.primaryLight },
  helpTitle: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  helpSub: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
});
