import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useHydration, useMeals } from "../../src/api/hooks";
import { EmptyState } from "../../src/components/EmptyState";
import { HeroCard } from "../../src/components/HeroCard";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { SectionHeader } from "../../src/components/SectionHeader";
import { TipBanner } from "../../src/components/TipBanner";
import { WeekStrip, type WeekStripDay } from "../../src/components/WeekStrip";
import { Card, Loading, Screen } from "../../src/components/ui";
import {
  addDays,
  appetitePct,
  formatTime,
  groupByDay,
  isSameDay,
  startOfWeek,
  toISODate,
  weekRange,
} from "../../src/lib/stats";
import { useRefreshAll } from "../../src/lib/useRefreshAll";
import { useActiveChild } from "../../src/store/activeChild";
import { accents, colors, fonts, MEAL_STATUS, MEAL_TYPE, radius, spacing } from "../../src/theme";

export default function FeedScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { child } = useActiveChild();

  const today = toISODate(new Date());
  const monday = startOfWeek(new Date());
  const meals = useMeals(child?.id, { from: today, to: today });
  const weekMeals = useMeals(child?.id, { ...weekRange(monday), per_page: 100 });
  const hydration = useHydration(child?.id, { from: today, to: today });
  const { refreshing, onRefresh } = useRefreshAll(meals, weekMeals, hydration);

  const todayMeals = [...(meals.data ?? [])].sort((a, b) => a.served_at.localeCompare(b.served_at));
  const pct = appetitePct(todayMeals);
  const cups = hydration.data?.[0]?.cups ?? 0;

  const byDay = groupByDay(weekMeals.data ?? [], (m) => m.served_at);
  const weekDays: WeekStripDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const dayMeals = byDay.get(toISODate(d)) ?? [];
    const dayPct = dayMeals.length ? appetitePct(dayMeals) : null;
    return {
      label: d.toLocaleDateString(i18n.language, { weekday: "short" }),
      highlight: isSameDay(d, new Date()),
      content:
        dayPct === null ? null : (
          <View style={styles.weekDay}>
            <Text style={styles.weekEmoji}>{dayPct >= 75 ? "😊" : dayPct >= 40 ? "🙂" : "😐"}</Text>
            <Text style={styles.weekPct}>{dayPct}%</Text>
          </View>
        ),
    };
  });

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {child && (
        <HeroCard
          photoUrl={child.avatar?.url}
          name={child.first_name}
          title={child.first_name}
          subtitle={t("feed.todaysMeals")}
          ring={{ pct, label: t("feed.appetite") }}
        />
      )}

      <SectionHeader
        title={t("feed.todaysMeals")}
        actionLabel={t("feed.weeklyMenu")}
        onAction={() => router.push("/child/meals-schedule")}
      />

      {meals.isLoading ? (
        <Loading />
      ) : todayMeals.length === 0 ? (
        <EmptyState icon="restaurant" title={t("feed.empty")} />
      ) : (
        todayMeals.map((meal) => {
          const typeVisual = MEAL_TYPE[meal.meal_type] ?? MEAL_TYPE.lunch;
          const statusVisual = MEAL_STATUS[meal.status] ?? MEAL_STATUS.ate_half;
          return (
            <Card key={meal.id} style={styles.mealCard}>
              <IconCircle name={typeVisual.icon} accent={typeVisual.accent} size={44} squircle />
              <View style={styles.mealTexts}>
                <View style={styles.mealTitleRow}>
                  <Text style={styles.mealTitle}>{t(`enums.mealType.${meal.meal_type}`)}</Text>
                  <Text style={styles.mealTime}>{formatTime(meal.served_at, i18n.language)}</Text>
                </View>
                <PillBadge
                  label={t(`enums.mealStatus.${meal.status}`)}
                  accent={statusVisual.accent}
                  emoji={statusVisual.emoji}
                />
                {meal.note ? <Text style={styles.mealNote}>{meal.note}</Text> : null}
              </View>
              {meal.image?.url && <Image source={{ uri: meal.image.url }} style={styles.mealPhoto} contentFit="cover" />}
            </Card>
          );
        })
      )}

      {/* Hydration */}
      <Card style={styles.hydrationCard}>
        <IconCircle name="water" accent="hydration" size={44} squircle />
        <View style={{ flex: 1 }}>
          <Text style={styles.hydrationTitle}>{t("feed.hydration")}</Text>
          <Text style={styles.hydrationSub}>{t("feed.cupsToday", { count: cups })}</Text>
        </View>
        <View style={styles.cups}>
          {Array.from({ length: Math.max(cups, 5) }, (_, i) => (
            <Ionicons
              key={i}
              name="water"
              size={18}
              color={i < cups ? accents.hydration.main : colors.border}
            />
          )).slice(0, 8)}
        </View>
      </Card>

      <TipBanner icon="water" accent="hydration" text={t("feed.tip")} />

      <SectionHeader title={t("feed.weeklyOverview")} />
      <Card>
        <WeekStrip days={weekDays} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mealCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  mealTexts: { flex: 1, gap: 5 },
  mealTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mealTitle: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  mealTime: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  mealNote: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  mealPhoto: { width: 64, height: 64, borderRadius: radius.md },
  hydrationCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  hydrationTitle: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  hydrationSub: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  cups: { flexDirection: "row", gap: 2 },
  weekDay: { alignItems: "center", gap: 2 },
  weekEmoji: { fontSize: 16 },
  weekPct: { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted },
});
