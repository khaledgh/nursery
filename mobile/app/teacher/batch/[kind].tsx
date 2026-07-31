import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLogDiaper, useLogMeal, useTeacherRoster } from "../../../src/api/hooks";
import type { Child } from "../../../src/api/types";
import { PrimaryButton } from "../../../src/components/Buttons";
import { ChildAvatar } from "../../../src/components/ChildAvatar";
import { EnumPicker } from "../../../src/components/form/EnumPicker";
import { EmptyState } from "../../../src/components/EmptyState";
import { toLocalRFC3339 } from "../../../src/lib/stats";
import { colors, fonts, MEAL_STATUS, MEAL_TYPE, radius, shadows, spacing, WETNESS } from "../../../src/theme";

/** Breakfast before 10:00, lunch before 14:00, otherwise a snack. */
function defaultMealType(now = new Date()): string {
  const h = now.getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snack";
  return "dinner";
}

type Kind = "meal" | "nap" | "diaper";

export default function BatchLog() {
  const { kind } = useLocalSearchParams<{ kind: Kind }>();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const roster = useTeacherRoster();
  const logMeal = useLogMeal();
  const logDiaper = useLogDiaper();

  const [mealType, setMealType] = useState(defaultMealType);
  // childId → chosen enum value. Absence means "skip this child".
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<number[]>([]);
  const [result, setResult] = useState<string | null>(null);

  const titleKey = kind === "diaper" ? "teacher.batch.diaperTitle" : "teacher.batch.mealTitle";
  useLayoutEffect(() => {
    navigation.setOptions({ title: t(titleKey) });
  }, [navigation, t, titleKey]);

  const children = useMemo(() => roster.data ?? [], [roster.data]);
  const chosen = useMemo(() => Object.keys(picks).length, [picks]);

  const setPick = useCallback((childId: number, value: string) => {
    setPicks((prev) => {
      const next = { ...prev };
      // Tapping the selected option again clears it, so a mistake is undoable.
      if (next[childId] === value) delete next[childId];
      else next[childId] = value;
      return next;
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setResult(null);
    const entries = Object.entries(picks);
    const failures: number[] = [];

    // Sequential: each write is authorised per child server-side, and a
    // partial failure must leave the successful ones saved.
    for (const [idRaw, value] of entries) {
      const childId = Number(idRaw);
      try {
        if (kind === "diaper") {
          await logDiaper.mutateAsync({
            childId,
            wetness: value,
            stool: "none",
            occurred_at: toLocalRFC3339(new Date()),
          });
        } else {
          await logMeal.mutateAsync({
            childId,
            meal_type: mealType,
            status: value,
            served_at: toLocalRFC3339(new Date()),
          });
        }
      } catch {
        failures.push(childId);
      }
    }

    setFailed(failures);
    // Keep failed rows selected so the teacher never loses their input.
    setPicks((prev) => Object.fromEntries(failures.map((id) => [id, prev[id]])));
    setResult(
      failures.length === 0
        ? t("teacher.batch.savedAll", { count: entries.length })
        : t("teacher.batch.partial", { saved: entries.length - failures.length, failed: failures.length }),
    );
    setSaving(false);
  };

  const renderItem = useCallback(
    ({ item }: { item: Child }) => (
      <View style={[styles.row, shadows.card, failed.includes(item.id) && styles.rowFailed]}>
        <ChildAvatar url={item.avatar?.url} name={item.first_name} size={38} />
        <Text style={styles.name} numberOfLines={1}>
          {item.first_name}
        </Text>
        <View style={styles.picker}>
          <EnumPicker
            options={kind === "diaper" ? Object.keys(WETNESS) : Object.keys(MEAL_STATUS)}
            visuals={kind === "diaper" ? WETNESS : MEAL_STATUS}
            i18nPrefix={kind === "diaper" ? "enums.wetness" : "enums.mealStatus"}
            value={picks[item.id]}
            onChange={(v) => setPick(item.id, v)}
            variant="emoji"
          />
        </View>
      </View>
    ),
    [failed, kind, picks, setPick],
  );

  if (roster.isLoading) return <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />;

  return (
    <View style={styles.root}>
      {kind !== "diaper" ? (
        <View style={styles.head}>
          <EnumPicker
            label={t("teacher.care.mealType")}
            options={Object.keys(MEAL_TYPE)}
            visuals={MEAL_TYPE}
            i18nPrefix="enums.mealType"
            value={mealType}
            onChange={setMealType}
          />
        </View>
      ) : null}

      <FlatList
        data={children}
        keyExtractor={(c) => String(c.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: 120 + insets.bottom }]}
        ListEmptyComponent={<EmptyState icon="people-outline" title={t("teacher.roster.empty")} />}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        {result ? <Text style={styles.result}>{result}</Text> : null}
        <PrimaryButton
          label={
            failed.length > 0
              ? t("teacher.batch.retryFailed", { count: failed.length })
              : t("teacher.batch.save", { count: chosen })
          }
          onPress={() => void save()}
          loading={saving}
          disabled={chosen === 0 || saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { padding: spacing.md, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  rowFailed: { borderColor: colors.danger },
  name: { width: 76, fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  picker: { flex: 1 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
  },
  result: { textAlign: "center", fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
});
