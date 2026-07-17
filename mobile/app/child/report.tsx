import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useDashboard, useReports } from "../../src/api/hooks";
import { EmptyState } from "../../src/components/EmptyState";
import { HeroCard } from "../../src/components/HeroCard";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { RatingRow } from "../../src/components/RatingRow";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatTile } from "../../src/components/StatTile";
import { Card, Loading, Screen } from "../../src/components/ui";
import { formatTime, minutesLabel, toISODate } from "../../src/lib/stats";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, fonts, MEAL_STATUS, radius, spacing } from "../../src/theme";

const DIM_ICONS: Record<string, string> = {
  social: "people",
  participation: "color-palette",
  listening: "ear",
  focus: "locate",
  hygiene: "water",
  eating: "restaurant",
};

export default function ReportScreen() {
  const { t, i18n } = useTranslation();
  const { child } = useActiveChild();
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? toISODate(new Date());

  const reports = useReports(child?.id, { from: date, to: date, per_page: 1 });
  const report = reports.data?.[0];
  const isToday = date === toISODate(new Date());
  const dashboard = useDashboard(isToday ? child?.id : undefined);

  const meals = dashboard.data?.meals ?? [];
  const nap = dashboard.data?.sleep?.[0];
  const diaperCount = dashboard.data?.diapers?.length ?? 0;

  return (
    <Screen refreshing={reports.isRefetching} onRefresh={() => void reports.refetch()}>
      {child && (
        <HeroCard
          variant="tint"
          photoUrl={child.avatar?.url}
          name={child.first_name}
          title={t("report.wonderfulDay", { name: child.first_name })}
          subtitle={new Date(date).toLocaleDateString(i18n.language, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        >
          {report?.moods?.length ? (
            <View style={styles.moodRow}>
              {report.moods.map((m) => (
                <View key={m.key} style={styles.moodChip}>
                  <Text style={styles.moodKey}>{t(`enums.reportMood.${m.key}`)}</Text>
                  <Text style={styles.moodRating}>{t(`enums.moodRating.${m.rating}`)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </HeroCard>
      )}

      {reports.isLoading ? (
        <Loading />
      ) : !report ? (
        <EmptyState icon="document-text" title={t("report.noReport")} />
      ) : (
        <>
          {report.summary ? (
            <Card>
              <Text style={styles.summary}>{report.summary}</Text>
            </Card>
          ) : null}

          {/* Care summary (today only — live data) */}
          {isToday && (meals.length > 0 || nap || diaperCount > 0) && (
            <>
              <SectionHeader title={`💗 ${t("report.careSummary")}`} />
              <View style={styles.tiles}>
                {meals.slice(0, 2).map((meal) => (
                  <StatTile
                    key={meal.id}
                    icon="restaurant"
                    accent={MEAL_STATUS[meal.status]?.accent ?? "meals"}
                    value={t(`enums.mealStatus.${meal.status}`)}
                    label={t(`enums.mealType.${meal.meal_type}`)}
                    sub={formatTime(meal.served_at, i18n.language)}
                  />
                ))}
                {diaperCount > 0 && (
                  <StatTile icon="shirt" accent="diaper" value={String(diaperCount)} label={t("home.diapers")} />
                )}
                {nap && (
                  <StatTile icon="moon" accent="sleep" value={minutesLabel(nap.total_minutes)} label={t("home.sleep")} />
                )}
              </View>
            </>
          )}

          {/* Development ratings */}
          {(report.ratings ?? []).length > 0 && (
            <>
              <SectionHeader title={t("report.development")} />
              <Card>
                {(report.ratings ?? []).map((r) => (
                  <RatingRow
                    key={r.dimension}
                    icon={DIM_ICONS[r.dimension] ?? "sparkles"}
                    title={t(`report.dims.${r.dimension}`)}
                    rating={r.rating}
                    note={r.note}
                  />
                ))}
              </Card>
            </>
          )}

          {/* Highlight */}
          {(report.highlight_text || report.highlight_media?.url) && (
            <>
              <SectionHeader title={`✨ ${t("report.highlight")}`} />
              <Card style={styles.highlightCard}>
                {report.highlight_media?.url && (
                  <Image source={{ uri: report.highlight_media.url }} style={styles.highlightPhoto} contentFit="cover" />
                )}
                {report.highlight_text ? <Text style={styles.highlightText}>{report.highlight_text}</Text> : null}
              </Card>
            </>
          )}

          {/* Home tips */}
          {(report.home_tips ?? []).length > 0 && (
            <>
              <SectionHeader title={`💡 ${t("report.supportHome")}`} />
              <Card style={styles.tipsCard}>
                {(report.home_tips ?? []).map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <IconCircle name="checkmark" accent="activity" size={26} />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </Card>
            </>
          )}

          <View style={styles.legend}>
            {(["thriving", "doing_well", "improving", "needs_support"] as const).map((k) => (
              <PillBadge key={k} label={t(`enums.reportRating.${k}`)} accent={k === "thriving" || k === "doing_well" ? "activity" : k === "improving" ? "meals" : "community"} dot />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  moodRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  moodChip: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    alignItems: "center",
  },
  moodKey: { fontSize: 11, fontFamily: fonts.bold, color: colors.text },
  moodRating: { fontSize: 10, fontFamily: fonts.extrabold, color: colors.success },
  summary: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, lineHeight: 20 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  highlightCard: { gap: spacing.sm },
  highlightPhoto: { width: "100%", height: 160, borderRadius: radius.md },
  highlightText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, lineHeight: 20 },
  tipsCard: { gap: spacing.sm },
  tipRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tipText: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
});
