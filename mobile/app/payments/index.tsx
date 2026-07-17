import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { errorMessage } from "../../src/api/client";
import { useInvoices, usePayInvoice } from "../../src/api/hooks";
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

export default function PaymentsScreen() {
  const { t, i18n } = useTranslation();
  const invoices = useInvoices();
  const pay = usePayInvoice();
  const [payingId, setPayingId] = useState<number | null>(null);

  const all = invoices.data ?? [];
  const open = all.filter((inv) => inv.status === "due" || inv.status === "overdue");
  const current = open[0];
  const paid = all.filter((inv) => inv.status === "paid");

  const startPayment = (invoice: Invoice) => {
    setPayingId(invoice.id);
    pay.mutate(invoice.id, {
      onSuccess: (data) => {
        setPayingId(null);
        const url = (data?.payment_url ?? data?.swish_url ?? data?.redirect_url) as string | undefined;
        if (url) void Linking.openURL(url);
        void invoices.refetch();
      },
      onError: (err) => {
        setPayingId(null);
        Alert.alert(t("common.error"), errorMessage(err));
      },
    });
  };

  return (
    <Screen refreshing={invoices.isRefetching} onRefresh={() => void invoices.refetch()}>
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
            <PrimaryButton
              label={t("payments.payNow")}
              icon="flash"
              loading={pay.isPending && payingId === current.id}
              onPress={() => startPayment(current)}
            />
            <Text style={styles.redirect}>🔒 {t("payments.redirect")}</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  dueCard: { gap: spacing.md },
  dueHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dueLabel: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  dueAmount: { fontSize: 30, fontFamily: fonts.extrabold, color: colors.danger },
  dueDate: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  redirect: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted, textAlign: "center" },
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
