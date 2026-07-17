import { Image } from "expo-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRateMenu, useWeeklyMenu } from "../../src/api/hooks";
import type { WeeklyMenu } from "../../src/api/types";
import { EmptyState } from "../../src/components/EmptyState";
import { HeroCard } from "../../src/components/HeroCard";
import { PillBadge } from "../../src/components/PillBadge";
import { TipBanner } from "../../src/components/TipBanner";
import { WeekSelector } from "../../src/components/WeekSelector";
import { Card, Loading, Screen } from "../../src/components/ui";
import { addDays, isSameDay, startOfWeek, toISODate } from "../../src/lib/stats";
import { useActiveChild } from "../../src/store/activeChild";
import { accents, colors, fonts, MEAL_TYPE, radius, spacing, type AccentName } from "../../src/theme";

const RATING_OPTIONS: { key: "eats" | "sometimes" | "doesnt_eat"; accent: AccentName; icon: string }[] = [
  { key: "eats", accent: "activity", icon: "✅" },
  { key: "sometimes", accent: "meals", icon: "🟡" },
  { key: "doesnt_eat", accent: "health", icon: "❌" },
];

export default function MealsScheduleScreen() {
  const { t, i18n } = useTranslation();
  const { child } = useActiveChild();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => toISODate(new Date()));

  const menu = useWeeklyMenu(child?.classroom_id, toISODate(weekStart));
  const rate = useRateMenu(child?.classroom_id);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayMenus = (menu.data ?? []).filter((m) => m.date.slice(0, 10) === selectedDay);

  const myRating = (m: WeeklyMenu) => m.ratings?.find((r) => r.child_id === child?.id)?.rating;

  return (
    <Screen refreshing={menu.isRefetching} onRefresh={() => void menu.refetch()}>
      {child && (
        <HeroCard
          variant="tint"
          photoUrl={child.avatar?.url}
          name={child.first_name}
          title={t("menu.legendTitle", { name: child.first_name })}
        >
          <View style={styles.legend}>
            {RATING_OPTIONS.map((o) => (
              <View key={o.key} style={styles.legendItem}>
                <Text>{o.icon}</Text>
                <Text style={styles.legendLabel}>{t(`enums.menuRating.${o.key}`)}</Text>
              </View>
            ))}
          </View>
        </HeroCard>
      )}

      <WeekSelector
        weekStart={weekStart}
        onChange={(monday) => {
          setWeekStart(monday);
          setSelectedDay(toISODate(monday));
        }}
      />

      {/* Day selector */}
      <View style={styles.dayRow}>
        {days.map((d) => {
          const iso = toISODate(d);
          const active = iso === selectedDay;
          return (
            <Pressable key={iso} onPress={() => setSelectedDay(iso)} style={[styles.day, active && styles.dayActive]}>
              <Text style={[styles.dayName, active && styles.dayTextActive]}>
                {d.toLocaleDateString(i18n.language, { weekday: "short" })}
              </Text>
              <Text style={[styles.dayNum, active && styles.dayTextActive]}>{d.getDate()}</Text>
              {isSameDay(d, new Date()) && <View style={[styles.todayDot, active && { backgroundColor: "#fff" }]} />}
            </Pressable>
          );
        })}
      </View>

      {menu.isLoading ? (
        <Loading />
      ) : dayMenus.length === 0 ? (
        <EmptyState icon="restaurant" title={t("menu.noMenu")} />
      ) : (
        dayMenus.map((m) => {
          const typeVisual = MEAL_TYPE[m.meal_type] ?? MEAL_TYPE.lunch;
          const mine = myRating(m);
          return (
            <Card key={m.id} style={styles.menuCard}>
              <View style={styles.menuHeader}>
                <PillBadge
                  label={t(`enums.mealType.${m.meal_type}`)}
                  accent={typeVisual.accent}
                  icon={typeVisual.icon}
                />
                {m.is_balanced && <PillBadge label={t("menu.balancedMeal")} accent="activity" icon="leaf" />}
              </View>

              <View style={styles.menuBody}>
                {m.image?.url && <Image source={{ uri: m.image.url }} style={styles.menuPhoto} contentFit="cover" />}
                <View style={styles.menuTexts}>
                  <Text style={styles.dishName}>{m.dish_name}</Text>
                  {(m.items ?? []).map((item, i) => (
                    <Text key={i} style={styles.dishItem}>
                      • {item}
                    </Text>
                  ))}
                </View>
              </View>

              {child && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.howEats}>{t("menu.howEats", { name: child.first_name })}</Text>
                  <View style={styles.ratingRow}>
                    {RATING_OPTIONS.map((o) => {
                      const active = mine === o.key;
                      const a = accents[o.accent];
                      return (
                        <Pressable
                          key={o.key}
                          disabled={rate.isPending}
                          onPress={() => rate.mutate({ menuId: m.id, childId: child.id, rating: o.key })}
                          style={[
                            styles.ratingBtn,
                            { borderColor: active ? a.main : colors.border, backgroundColor: active ? a.tint : colors.card },
                          ]}
                        >
                          <Text>{o.icon}</Text>
                          <Text style={[styles.ratingLabel, { color: active ? a.dark : colors.text }]}>
                            {t(`enums.menuRating.${o.key}`)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </Card>
          );
        })
      )}

      <TipBanner icon="restaurant" accent="meals" text={t("menu.nutritionNote")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: "row", gap: spacing.md, marginTop: 4, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.text },
  dayRow: { flexDirection: "row", gap: 4 },
  day: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayName: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted },
  dayNum: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  dayTextActive: { color: "#fff" },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  menuCard: { gap: spacing.sm + 2 },
  menuHeader: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  menuBody: { flexDirection: "row", gap: spacing.md },
  menuPhoto: { width: 96, height: 96, borderRadius: radius.md },
  menuTexts: { flex: 1, gap: 3 },
  dishName: { fontSize: 17, fontFamily: fonts.extrabold, color: colors.text },
  dishItem: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  divider: { height: 1, backgroundColor: colors.border },
  howEats: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  ratingRow: { flexDirection: "row", gap: spacing.sm },
  ratingBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  ratingLabel: { fontSize: 12, fontFamily: fonts.bold },
});
