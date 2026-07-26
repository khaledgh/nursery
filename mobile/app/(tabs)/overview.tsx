import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useReports, useWeeklyPlan } from "../../src/api/hooks";
import type { WeeklyPlanItem } from "../../src/api/types";
import { ChildSwitcher } from "../../src/components/ChildSwitcher";
import { EmptyState } from "../../src/components/EmptyState";
import { HeroCard } from "../../src/components/HeroCard";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { SectionHeader } from "../../src/components/SectionHeader";
import { TipBanner } from "../../src/components/TipBanner";
import { WeekSelector } from "../../src/components/WeekSelector";
import { Card, Loading, Screen } from "../../src/components/ui";
import { addDays, childAgeLabel, startOfWeek, toISODate, weekRange } from "../../src/lib/stats";
import { useRefreshAll } from "../../src/lib/useRefreshAll";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, fonts, radius, REPORT_RATING, safeIcon, spacing } from "../../src/theme";

function planAccent(item: WeeklyPlanItem) {
  return item.color ? { main: item.color, tint: `${item.color}22`, dark: item.color } : undefined;
}

export default function OverviewScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { child } = useActiveChild();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const plan = useWeeklyPlan(child?.classroom_id, toISODate(weekStart));
  const reports = useReports(child?.id, weekRange(weekStart));
  const { refreshing, onRefresh } = useRefreshAll(plan, reports);

  const items = plan.data?.items ?? [];
  const learning = items.filter((i) => i.kind === "learning_area");
  const activities = items.filter((i) => i.kind === "activity").sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  const gains = items.filter((i) => i.kind === "gain");

  const weekdayName = (day: number | null) => {
    if (day === null) return "";
    // Reference week: 2026-06-07 is a Sunday; add `day` to land on the right weekday.
    const ref = new Date(2026, 5, 7 + day);
    return ref.toLocaleDateString(i18n.language, { weekday: "short" });
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <ChildSwitcher />

      {child && (
        <HeroCard
          variant="tint"
          photoUrl={child.avatar?.url}
          name={child.first_name}
          title={child.first_name}
          subtitle={childAgeLabel(child.dob)}
        >
          <Text style={styles.quote}>“{t("overview.quote")}”</Text>
        </HeroCard>
      )}

      <WeekSelector weekStart={weekStart} onChange={setWeekStart} />

      {plan.isLoading ? (
        <Loading />
      ) : !plan.data ? (
        <EmptyState icon="stats-chart" title={t("overview.noPlan")} />
      ) : (
        <>
          {learning.length > 0 && (
            <Card style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconCircle name="book" accent="health" size={40} squircle />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{t("overview.learning")}</Text>
                  <Text style={styles.sectionSub}>{t("overview.learningSub")}</Text>
                </View>
              </View>
              <View style={styles.grid}>
                {learning.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
                    <IconCircle name={safeIcon(item.icon, "sparkles")} accent={planAccent(item) ?? "primary"} size={44} />
                    <Text style={styles.gridTitle}>{item.title}</Text>
                    {item.description ? <Text style={styles.gridSub}>{item.description}</Text> : null}
                  </View>
                ))}
              </View>
            </Card>
          )}

          {activities.length > 0 && (
            <Card style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconCircle name="star" accent="meals" size={40} squircle />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{t("overview.activities")}</Text>
                  <Text style={styles.sectionSub}>{t("overview.activitiesSub")}</Text>
                </View>
              </View>
              <View style={styles.activityRow}>
                {activities.map((item) => (
                  <View key={item.id} style={styles.activityCard}>
                    <Text style={styles.activityDay}>{weekdayName(item.day)}</Text>
                    <IconCircle name={safeIcon(item.icon, "color-palette")} accent={planAccent(item) ?? "activity"} size={40} />
                    <Text style={styles.activityTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={styles.activitySub} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </Card>
          )}

          {gains.length > 0 && (
            <Card style={styles.section}>
              <View style={styles.sectionHeader}>
                <IconCircle name="trophy" accent="primary" size={40} squircle />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{t("overview.gains")}</Text>
                  <Text style={styles.sectionSub}>{t("overview.gainsSub")}</Text>
                </View>
              </View>
              <View style={styles.grid}>
                {gains.map((item) => (
                  <View key={item.id} style={styles.gridItem}>
                    <IconCircle name={safeIcon(item.icon, "heart")} accent={planAccent(item) ?? "events"} size={44} />
                    <Text style={styles.gridTitle}>{item.title}</Text>
                    {item.description ? <Text style={styles.gridSub}>{item.description}</Text> : null}
                  </View>
                ))}
              </View>
            </Card>
          )}

          {plan.data.note ? (
            <TipBanner icon="create" title={t("overview.teacherNote")} text={plan.data.note} />
          ) : null}
        </>
      )}

      {/* Daily reports of the week */}
      {(reports.data ?? []).length > 0 && (
        <>
          <SectionHeader title={t("overview.dailyReports")} />
          {(reports.data ?? []).map((report) => {
            const top = report.ratings?.filter((r) => r.rating === "thriving" || r.rating === "doing_well") ?? [];
            return (
              <Pressable
                key={report.id}
                onPress={() => router.push(`/child/report?date=${report.date.slice(0, 10)}` as never)}
              >
                <Card style={styles.reportCard}>
                  <IconCircle name="document-text" accent="primary" size={40} squircle />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.reportDate}>
                      {new Date(report.date).toLocaleDateString(i18n.language, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    {report.summary ? (
                      <Text style={styles.reportSummary} numberOfLines={2}>
                        {report.summary}
                      </Text>
                    ) : null}
                    {top.length > 0 && (
                      <View style={styles.reportPills}>
                        {top.slice(0, 3).map((r) => (
                          <PillBadge
                            key={r.dimension}
                            label={t(`report.dims.${r.dimension}`)}
                            accent={REPORT_RATING[r.rating].accent}
                            emoji={REPORT_RATING[r.rating].emoji}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  quote: { fontSize: 13, fontFamily: fonts.bold, color: colors.primaryDark, marginTop: 4 },
  section: { gap: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  sectionTitle: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  sectionSub: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridItem: {
    width: "47%",
    alignItems: "center",
    gap: 5,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  gridTitle: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.text, textAlign: "center" },
  gridSub: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted, textAlign: "center" },
  activityRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  activityCard: {
    width: "30%",
    alignItems: "center",
    gap: 5,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  activityDay: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.primary },
  activityTitle: { fontSize: 12, fontFamily: fonts.extrabold, color: colors.text, textAlign: "center" },
  activitySub: { fontSize: 10, fontFamily: fonts.semibold, color: colors.textMuted, textAlign: "center" },
  reportCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  reportDate: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  reportSummary: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  reportPills: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
});
