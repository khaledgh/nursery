import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useReminders } from "../src/api/hooks";
import type { Reminder } from "../src/api/types";
import { EmptyState } from "../src/components/EmptyState";
import { IconCircle } from "../src/components/IconCircle";
import { PillBadge } from "../src/components/PillBadge";
import { SectionHeader } from "../src/components/SectionHeader";
import { SegmentTabs } from "../src/components/SegmentTabs";
import { TipBanner } from "../src/components/TipBanner";
import { Card, Divider, Loading, Screen } from "../src/components/ui";
import { colors, fonts, radius, safeIcon, spacing, type AccentName } from "../src/theme";

type Tab = "upcoming" | "all";

function reminderAccent(r: Reminder): AccentName {
  if (r.weather_alert) return "meals";
  return r.kind === "upcoming" ? "primary" : "neutral";
}

export default function RemindersScreen() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<Tab>("upcoming");
  const reminders = useReminders();

  const all = reminders.data ?? [];
  const upcoming = all.filter((r) => r.kind === "upcoming");
  const general = all.filter((r) => r.kind === "general");
  const shownUpcoming = tab === "upcoming" ? upcoming : all.filter((r) => r.kind === "upcoming");

  const dateLabel = (r: Reminder) => {
    if (!r.date) return "";
    const d = new Date(r.date);
    return d.toLocaleDateString(i18n.language, { weekday: "long", month: "short", day: "numeric" });
  };

  return (
    <Screen refreshing={reminders.isRefetching} onRefresh={() => void reminders.refetch()}>
      <Text style={styles.subtitle}>{t("reminders.subtitle")}</Text>

      <SegmentTabs
        tabs={[
          { key: "upcoming", label: t("reminders.upcoming") },
          { key: "all", label: t("reminders.all") },
        ]}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
      />

      {reminders.isLoading ? (
        <Loading />
      ) : all.length === 0 ? (
        <EmptyState icon="briefcase" title={t("reminders.empty")} />
      ) : (
        <>
          {shownUpcoming.map((r) => {
            const accent = reminderAccent(r);
            return (
              <Card key={r.id} style={styles.reminderCard}>
                <View style={styles.reminderHeader}>
                  <IconCircle name={safeIcon(r.icon, "sunny")} accent={accent} size={48} squircle />
                  <View style={{ flex: 1, gap: 3 }}>
                    {r.date ? <Text style={styles.reminderDate}>{dateLabel(r)}</Text> : null}
                    <Text style={styles.reminderTitle}>{r.title}</Text>
                    {r.description ? <Text style={styles.reminderDesc}>{r.description}</Text> : null}
                  </View>
                  {r.weather_alert && <PillBadge label={t("reminders.weatherAlert")} accent="meals" icon="sunny" />}
                </View>
                {(r.items ?? []).length > 0 && (
                  <View style={styles.itemsRow}>
                    {(r.items ?? []).map((item, i) => (
                      <View key={i} style={styles.itemChip}>
                        <Text style={styles.itemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          })}

          {(tab === "all" || general.length > 0) && general.length > 0 && (
            <>
              <SectionHeader title={t("reminders.general")} />
              <Card>
                {general.map((r, i) => (
                  <View key={r.id}>
                    <View style={styles.generalRow}>
                      <IconCircle name={safeIcon(r.icon, "checkmark-circle")} accent="neutral" size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reminderTitle}>{r.title}</Text>
                        {r.description ? <Text style={styles.reminderDesc}>{r.description}</Text> : null}
                      </View>
                    </View>
                    {i < general.length - 1 && <Divider />}
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      <TipBanner icon="heart" title={t("reminders.thankYou")} text={t("reminders.thankYouSub")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted, marginTop: -spacing.sm },
  reminderCard: { gap: spacing.sm + 2 },
  reminderHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  reminderDate: { fontSize: 12, fontFamily: fonts.extrabold, color: colors.primary },
  reminderTitle: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  reminderDesc: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  itemsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  itemChip: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
  },
  itemText: { fontSize: 12, fontFamily: fonts.bold, color: colors.text },
  generalRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingVertical: 4 },
});
