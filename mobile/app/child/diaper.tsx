import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useDiapers } from "../../src/api/hooks";
import { EmptyState } from "../../src/components/EmptyState";
import { HeroCard } from "../../src/components/HeroCard";
import { PillBadge } from "../../src/components/PillBadge";
import { SectionHeader } from "../../src/components/SectionHeader";
import { StatTile } from "../../src/components/StatTile";
import { TimelineItem } from "../../src/components/Timeline";
import { TipBanner } from "../../src/components/TipBanner";
import { WeekStrip, type WeekStripDay } from "../../src/components/WeekStrip";
import { Card, Loading, Screen } from "../../src/components/ui";
import {
  addDays,
  formatTime,
  groupByDay,
  isSameDay,
  startOfWeek,
  toISODate,
  weekRange,
} from "../../src/lib/stats";
import { useRefreshAll } from "../../src/lib/useRefreshAll";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, COMFORT, fonts, spacing, STOOL, WETNESS } from "../../src/theme";

export default function DiaperScreen() {
  const { t, i18n } = useTranslation();
  const { child } = useActiveChild();

  const today = toISODate(new Date());
  const monday = startOfWeek(new Date());
  const diapers = useDiapers(child?.id, { from: today, to: today });
  const weekDiapers = useDiapers(child?.id, { ...weekRange(monday), per_page: 100 });
  const { refreshing, onRefresh } = useRefreshAll(diapers, weekDiapers);

  const logs = [...(diapers.data ?? [])].sort((a, b) => a.time.localeCompare(b.time));
  const last = logs[logs.length - 1];
  const happyCount = logs.filter((d) => d.comfort === "happy").length;

  const byDay = groupByDay(weekDiapers.data ?? [], (d) => d.time);
  const weekDays: WeekStripDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const count = byDay.get(toISODate(d))?.length ?? 0;
    return {
      label: d.toLocaleDateString(i18n.language, { weekday: "short" }),
      highlight: isSameDay(d, new Date()),
      content: count ? <Text style={styles.weekCount}>{count}</Text> : null,
    };
  });

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {child && (
        <HeroCard
          photoUrl={child.avatar?.url}
          name={child.first_name}
          title={child.first_name}
          subtitle={t("diaper.todaysLog")}
        />
      )}

      <View style={styles.tiles}>
        <StatTile icon="repeat" accent="diaper" value={String(logs.length)} label={t("diaper.changesToday")} />
        <StatTile
          icon="time"
          accent="hydration"
          value={last ? formatTime(last.time, i18n.language) : "—"}
          label={t("diaper.lastChange")}
        />
        <StatTile
          icon="happy"
          accent="activity"
          value={logs.length ? `${happyCount}/${logs.length}` : "—"}
          label={t("diaper.comfort")}
        />
      </View>

      <SectionHeader title={t("diaper.todaysLog")} />
      {diapers.isLoading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <EmptyState icon="shirt" title={t("diaper.empty")} />
      ) : (
        <View>
          {logs.map((log, i) => {
            const wet = WETNESS[log.wetness] ?? WETNESS.wet;
            const comfort = COMFORT[log.comfort] ?? COMFORT.happy;
            return (
              <TimelineItem
                key={log.id}
                time={formatTime(log.time, i18n.language)}
                icon={wet.icon}
                accent={wet.accent}
                last={i === logs.length - 1}
              >
                <Card style={styles.logCard}>
                  <View style={styles.pills}>
                    <PillBadge label={t(`enums.wetness.${log.wetness}`)} accent={wet.accent} dot />
                    {log.stool !== "none" && (
                      <PillBadge
                        label={t(`enums.stool.${log.stool}`)}
                        accent={(STOOL[log.stool] ?? STOOL.normal).accent}
                        dot
                      />
                    )}
                    <PillBadge label={t(`enums.comfort.${log.comfort}`)} accent={comfort.accent} emoji={comfort.emoji} />
                  </View>
                  {log.note ? <Text style={styles.note}>{log.note}</Text> : null}
                </Card>
              </TimelineItem>
            );
          })}
        </View>
      )}

      <TipBanner icon="shield-checkmark" accent="diaper" text={t("diaper.tip")} />

      <SectionHeader title={t("diaper.history")} />
      <Card>
        <WeekStrip days={weekDays} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: spacing.sm },
  logCard: { gap: spacing.sm, padding: spacing.sm + 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  note: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  weekCount: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.primaryDark },
});
