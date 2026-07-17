import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSleep } from "../../src/api/hooks";
import { EmptyState } from "../../src/components/EmptyState";
import { HeroCard } from "../../src/components/HeroCard";
import { PillBadge } from "../../src/components/PillBadge";
import { ProgressRing } from "../../src/components/ProgressRing";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatTile } from "../../src/components/StatTile";
import { TipBanner } from "../../src/components/TipBanner";
import { WeekStrip, type WeekStripDay } from "../../src/components/WeekStrip";
import { Card, Loading, Screen } from "../../src/components/ui";
import {
  addDays,
  formatTime,
  groupByDay,
  isSameDay,
  minutesLabel,
  startOfWeek,
  toISODate,
  weekRange,
} from "../../src/lib/stats";
import { useActiveChild } from "../../src/store/activeChild";
import { accents, colors, fonts, spacing } from "../../src/theme";

const qualityColor = (pct: number) =>
  pct >= 80 ? accents.primary.main : pct >= 60 ? accents.activity.main : pct >= 40 ? accents.meals.main : accents.health.main;

export default function SleepScreen() {
  const { t, i18n } = useTranslation();
  const { child } = useActiveChild();

  const today = toISODate(new Date());
  const monday = startOfWeek(new Date());
  const naps = useSleep(child?.id, { from: today, to: today });
  const weekNaps = useSleep(child?.id, { ...weekRange(monday), per_page: 50 });

  const nap = naps.data?.[0];
  const phases = nap
    ? [
        { key: "deepSleep", min: nap.deep_min, color: accents.primary.dark },
        { key: "lightSleep", min: nap.light_min, color: accents.primary.main },
        { key: "awake", min: nap.awake_min, color: accents.meals.main },
      ]
    : [];
  const phaseTotal = phases.reduce((a, p) => a + p.min, 0) || 1;

  const byDay = groupByDay(weekNaps.data ?? [], (s) => s.start_at);
  const weekDays: WeekStripDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const dayNaps = byDay.get(toISODate(d)) ?? [];
    if (!dayNaps.length) {
      return { label: d.toLocaleDateString(i18n.language, { weekday: "short" }), content: null };
    }
    const avgPct = Math.round(dayNaps.reduce((a, s) => a + s.quality_pct, 0) / dayNaps.length);
    const totalMin = dayNaps.reduce((a, s) => a + s.total_minutes, 0);
    return {
      label: d.toLocaleDateString(i18n.language, { weekday: "short" }),
      highlight: isSameDay(d, new Date()),
      content: (
        <View style={styles.weekDay}>
          <ProgressRing pct={avgPct} size={36} stroke={4} color={qualityColor(avgPct)} labelColor={colors.text} />
          <Text style={styles.weekSub}>{minutesLabel(totalMin)}</Text>
        </View>
      ),
    };
  });

  return (
    <Screen refreshing={naps.isRefetching} onRefresh={() => void naps.refetch()}>
      {child && (
        <HeroCard
          photoUrl={child.avatar?.url}
          name={child.first_name}
          title={nap ? t("sleep.peacefulNap", { name: child.first_name }) : child.first_name}
          subtitle={nap?.mood_after ? `${t("sleep.moodAfterNap")}: ${nap.mood_after}` : undefined}
          ring={nap ? { pct: nap.quality_pct, label: t("sleep.napQuality") } : undefined}
        />
      )}

      <SectionHeader title={t("sleep.todaysNap")} />
      {naps.isLoading ? (
        <Loading />
      ) : !nap ? (
        <EmptyState icon="moon" title={t("sleep.empty")} />
      ) : (
        <>
          <Card style={styles.napCard}>
            <View style={styles.napHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.napTitle}>
                  {formatTime(nap.start_at, i18n.language)} – {formatTime(nap.end_at, i18n.language)}
                </Text>
                <PillBadge label={t("sleep.completed")} accent="activity" dot />
              </View>
              <View style={styles.napTotal}>
                <Text style={styles.napTotalLabel}>{t("sleep.totalNapTime")}</Text>
                <Text style={styles.napTotalValue}>{minutesLabel(nap.total_minutes)}</Text>
              </View>
            </View>

            {/* Phase bar */}
            <View style={styles.phaseBar}>
              {phases.map((p) =>
                p.min > 0 ? (
                  <View key={p.key} style={{ flex: p.min / phaseTotal, backgroundColor: p.color }} />
                ) : null,
              )}
            </View>
            <View style={styles.phaseLegend}>
              {phases.map((p) => (
                <View key={p.key} style={styles.phaseItem}>
                  <View style={[styles.phaseDot, { backgroundColor: p.color }]} />
                  <View>
                    <Text style={styles.phaseLabel}>{t(`sleep.${p.key}`)}</Text>
                    <Text style={styles.phaseSub}>
                      {minutesLabel(p.min)} ({Math.round((p.min / phaseTotal) * 100)}%)
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          <SectionHeader title={t("sleep.highlights")} />
          <View style={styles.tiles}>
            <StatTile
              icon="moon"
              accent="sleep"
              value={formatTime(nap.start_at, i18n.language)}
              label={t("sleep.fellAsleep")}
              sub={nap.took_to_sleep_min ? t("sleep.tookMin", { count: nap.took_to_sleep_min }) : undefined}
            />
            <StatTile icon="sunny" accent="meals" value={formatTime(nap.end_at, i18n.language)} label={t("sleep.wokeUp")} />
            <StatTile
              icon="heart"
              accent="health"
              value={nap.mood_after || "—"}
              label={t("sleep.moodAfterNap")}
            />
            <StatTile icon="star" accent="primary" value={`${nap.quality_pct}%`} label={t("sleep.quality")} />
          </View>
        </>
      )}

      <TipBanner title={t("diary.teacherNote")} text={t("sleep.teacherTip")} />

      <SectionHeader title={t("sleep.napHistory")} />
      <Card>
        <WeekStrip
          days={weekDays}
          legend={[
            { color: accents.primary.main, label: t("sleep.legendGreat"), sub: "80%+" },
            { color: accents.activity.main, label: t("sleep.legendGood"), sub: "60–79%" },
            { color: accents.meals.main, label: t("sleep.legendOkay"), sub: "40–59%" },
            { color: accents.health.main, label: t("sleep.legendNeedsAttention"), sub: "< 40%" },
          ]}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  napCard: { gap: spacing.md },
  napHeader: { flexDirection: "row", alignItems: "center" },
  napTitle: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  napTotal: { alignItems: "flex-end" },
  napTotalLabel: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  napTotalValue: { fontSize: 20, fontFamily: fonts.extrabold, color: colors.text },
  phaseBar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: colors.border },
  phaseLegend: { flexDirection: "row", justifyContent: "space-between" },
  phaseItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.text },
  phaseSub: { fontSize: 10, fontFamily: fonts.semibold, color: colors.textMuted },
  tiles: { flexDirection: "row", gap: spacing.sm },
  weekDay: { alignItems: "center", gap: 3 },
  weekSub: { fontSize: 9, fontFamily: fonts.semibold, color: colors.textMuted },
});
