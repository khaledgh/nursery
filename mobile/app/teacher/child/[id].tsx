import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  useDashboard,
  useHealthProfile,
  useLogDiaper,
  useLogMeal,
  useLogSleep,
  useMilestoneCategories,
  useAssessMilestone,
  useUpsertHydration,
} from "../../../src/api/hooks";
import { ChildAvatar } from "../../../src/components/ChildAvatar";
import { EnumPicker } from "../../../src/components/form/EnumPicker";
import { FormSheet } from "../../../src/components/form/FormSheet";
import { Stepper } from "../../../src/components/form/Stepper";
import { TextField } from "../../../src/components/form/TextField";
import { ActionCard } from "../../../src/components/ActionCard";
import { StatTile } from "../../../src/components/StatTile";
import { Loading, Screen, SectionTitle } from "../../../src/components/ui";
import { useFieldErrors } from "../../../src/lib/useFieldErrors";
import { childAgeLabel, minutesLabel, toLocalRFC3339 } from "../../../src/lib/stats";
import {
  COMFORT,
  MEAL_STATUS,
  MEAL_TYPE,
  STOOL,
  WETNESS,
  accents,
  colors,
  fonts,
  radius,
  spacing,
} from "../../../src/theme";

type Sheet = "meal" | "nap" | "diaper" | "water" | "milestone" | null;

/** Common nap lengths, so the usual case is one tap rather than a time picker. */
const NAP_PRESETS = [15, 30, 45, 60, 90, 120];

export default function TeacherChildHub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const childId = Number(id);
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();

  const dashboard = useDashboard(childId);
  const health = useHealthProfile(childId);
  const logMeal = useLogMeal();
  const logSleep = useLogSleep();
  const logDiaper = useLogDiaper();
  const upsertHydration = useUpsertHydration();
  const categoriesQuery = useMilestoneCategories();
  const assessMilestone = useAssessMilestone();
  const errors = useFieldErrors();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [mealType, setMealType] = useState("lunch");
  const [mealStatus, setMealStatus] = useState("ate_well");
  const [note, setNote] = useState("");
  const [wetness, setWetness] = useState("wet");
  const [stool, setStool] = useState("none");
  const [comfort, setComfort] = useState("happy");
  const [cups, setCups] = useState(0);
  const [napMin, setNapMin] = useState(60);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [progressPct, setProgressPct] = useState(50);
  const [milestoneStatus, setMilestoneStatus] = useState<"in_progress" | "achieved">("in_progress");
  const [milestoneNote, setMilestoneNote] = useState("");

  const child = dashboard.data?.child;
  const name = child ? `${child.first_name} ${child.last_name}`.trim() : "";

  useLayoutEffect(() => {
    if (child) navigation.setOptions({ title: child.first_name });
  }, [child, navigation]);

  const napMinutes = useMemo(
    () => (dashboard.data?.sleep ?? []).reduce((sum, s) => sum + (s.total_minutes ?? 0), 0),
    [dashboard.data?.sleep],
  );
  const allergies = health.data?.allergies ?? [];

  const closeSheet = () => {
    setSheet(null);
    setNote("");
    errors.reset();
  };

  const submitMeal = () => {
    errors.reset();
    logMeal.mutate(
      { childId, meal_type: mealType, status: mealStatus, note, served_at: toLocalRFC3339(new Date()) },
      { onSuccess: closeSheet, onError: (e) => errors.capture(e) },
    );
  };

  const submitDiaper = () => {
    errors.reset();
    const nowIso = toLocalRFC3339(new Date());
    logDiaper.mutate(
      { childId, wetness, stool, comfort, note, time: nowIso, occurred_at: nowIso },
      { onSuccess: closeSheet, onError: (e) => errors.capture(e) },
    );
  };

  const submitNap = () => {
    errors.reset();
    // Teachers report "she slept about an hour", so the duration is the input
    // and the timestamps are derived backwards from now.
    const end = new Date();
    const start = new Date(end.getTime() - napMin * 60_000);
    logSleep.mutate(
      { childId, start_at: toLocalRFC3339(start), end_at: toLocalRFC3339(end), note },
      { onSuccess: closeSheet, onError: (e) => errors.capture(e) },
    );
  };

  const submitWater = () => {
    errors.reset();
    const todayStr = new Date().toISOString().split("T")[0];
    upsertHydration.mutate(
      { childId, cups, date: todayStr },
      { onSuccess: closeSheet, onError: (e) => errors.capture(e) },
    );
  };

  const submitMilestone = () => {
    errors.reset();
    if (!selectedCatId) return;
    assessMilestone.mutate(
      {
        childId,
        category_id: selectedCatId,
        progress_pct: progressPct,
        status: milestoneStatus,
        description: milestoneNote,
      },
      { onSuccess: closeSheet, onError: (e) => errors.capture(e) },
    );
  };

  if (dashboard.isLoading || !child) return <Loading />;

  return (
    <>
      <Screen refreshing={dashboard.isRefetching} onRefresh={() => void dashboard.refetch()}>
        <View style={styles.header}>
          <ChildAvatar url={child.avatar?.url} name={child.first_name} size={72} ringColor={colors.primaryLight} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.meta}>
              {childAgeLabel(child.dob)}
              {child.classroom?.name ? ` · ${child.classroom.name}` : ""}
            </Text>
          </View>
        </View>

        {/* Allergies must be impossible to miss before logging any food. */}
        {allergies.length > 0 ? (
          <View style={styles.allergy}>
            <Ionicons name="warning" size={18} color={colors.danger} />
            <Text style={styles.allergyText}>
              {t("teacher.child.allergyWarning")}:{" "}
              {allergies
                .map((a) => (a.severity === "severe" ? `${a.name} (${t("enums.severity.severe")})` : a.name))
                .join(", ")}
            </Text>
          </View>
        ) : null}

        <SectionTitle>{t("teacher.child.todayAtGlance")}</SectionTitle>
        <View style={styles.tiles}>
          <StatTile
            icon="restaurant"
            accent="meals"
            value={String(dashboard.data?.meals.length ?? 0)}
            label={t("teacher.child.meals")}
            onPress={() => setSheet("meal")}
          />
          <StatTile
            icon="moon"
            accent="sleep"
            value={minutesLabel(napMinutes)}
            label={t("teacher.child.nap")}
            onPress={() => setSheet("nap")}
          />
          <StatTile
            icon="shirt"
            accent="diaper"
            value={String(dashboard.data?.diapers.length ?? 0)}
            label={t("teacher.child.diapers")}
            onPress={() => setSheet("diaper")}
          />
          <StatTile
            icon="water"
            accent="hydration"
            value={String(dashboard.data?.hydration?.cups ?? 0)}
            label={t("teacher.child.water")}
            onPress={() => {
              setCups(dashboard.data?.hydration?.cups ?? 0);
              setSheet("water");
            }}
          />
        </View>

        <ActionCard
          icon="book"
          accent="primary"
          title={t("teacher.child.addDiary")}
          onPress={() => router.push(`/teacher/child/${childId}/diary`)}
        />
        <ActionCard
          icon="heart"
          accent="health"
          title={t("teacher.child.healthIncidents")}
          onPress={() => router.push(`/teacher/child/${childId}/health`)}
        />
        <ActionCard
          icon="trophy"
          accent="meals"
          title={t("teacher.child.assessMilestone", "Assess Child Milestone")}
          onPress={() => {
            if (categoriesQuery.data && categoriesQuery.data.length > 0) {
              setSelectedCatId(categoriesQuery.data[0].id);
            }
            setSheet("milestone");
          }}
        />
        <ActionCard
          icon="ribbon"
          accent="primary"
          title={t("teacher.child.milestonesLink")}
          onPress={() => router.push("/child/milestones")}
        />
      </Screen>

      <FormSheet
        visible={sheet === "meal"}
        onClose={closeSheet}
        title={t("teacher.batch.mealTitle")}
        subtitle={name}
        submitLabel={t("teacher.common.save")}
        onSubmit={submitMeal}
        submitting={logMeal.isPending}
        error={errors.message}
      >
        <EnumPicker
          label={t("teacher.care.mealType")}
          options={Object.keys(MEAL_TYPE)}
          visuals={MEAL_TYPE}
          i18nPrefix="enums.mealType"
          value={mealType}
          onChange={setMealType}
          error={errors.fieldError("meal_type")}
        />
        <EnumPicker
          label={t("teacher.care.mealStatus")}
          options={Object.keys(MEAL_STATUS)}
          visuals={MEAL_STATUS}
          i18nPrefix="enums.mealStatus"
          value={mealStatus}
          onChange={setMealStatus}
          variant="emoji"
          error={errors.fieldError("status")}
        />
        <TextField
          label={t("teacher.care.note")}
          value={note}
          onChangeText={setNote}
          placeholder={t("teacher.care.notePlaceholder")}
          multiline
          maxLength={500}
          error={errors.fieldError("note")}
        />
      </FormSheet>

      <FormSheet
        visible={sheet === "nap"}
        onClose={closeSheet}
        title={t("teacher.batch.napTitle")}
        subtitle={name}
        submitLabel={t("teacher.common.save")}
        onSubmit={submitNap}
        submitting={logSleep.isPending}
        error={errors.message}
      >
        <View style={styles.presets}>
          {NAP_PRESETS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setNapMin(m)}
              style={[styles.preset, napMin === m && styles.presetActive]}
            >
              <Text style={[styles.presetLabel, napMin === m && styles.presetLabelActive]}>
                {minutesLabel(m)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Stepper
          label={t("teacher.care.duration")}
          value={napMin}
          onChange={setNapMin}
          min={5}
          max={300}
          step={5}
          suffix="min"
          accent="sleep"
        />
        <TextField
          label={t("teacher.care.note")}
          value={note}
          onChangeText={setNote}
          placeholder={t("teacher.care.notePlaceholder")}
          multiline
          maxLength={500}
          error={errors.fieldError("note")}
        />
      </FormSheet>

      <FormSheet
        visible={sheet === "diaper"}
        onClose={closeSheet}
        title={t("teacher.batch.diaperTitle")}
        subtitle={name}
        submitLabel={t("teacher.common.save")}
        onSubmit={submitDiaper}
        submitting={logDiaper.isPending}
        error={errors.message}
      >
        <EnumPicker
          label={t("teacher.care.wetness")}
          options={Object.keys(WETNESS)}
          visuals={WETNESS}
          i18nPrefix="enums.wetness"
          value={wetness}
          onChange={setWetness}
          error={errors.fieldError("wetness")}
        />
        <EnumPicker
          label={t("teacher.care.stool")}
          options={Object.keys(STOOL)}
          visuals={STOOL}
          i18nPrefix="enums.stool"
          value={stool}
          onChange={setStool}
          error={errors.fieldError("stool")}
        />
        <EnumPicker
          label={t("teacher.care.comfort")}
          options={Object.keys(COMFORT)}
          visuals={COMFORT}
          i18nPrefix="enums.comfort"
          value={comfort}
          onChange={setComfort}
          error={errors.fieldError("comfort")}
        />
      </FormSheet>

      <FormSheet
        visible={sheet === "water"}
        onClose={closeSheet}
        title={t("teacher.care.cups")}
        subtitle={name}
        submitLabel={t("teacher.common.save")}
        onSubmit={submitWater}
        submitting={upsertHydration.isPending}
        error={errors.message}
      >
        <Stepper
          label={t("teacher.care.cups")}
          value={cups}
          onChange={setCups}
          min={0}
          max={30}
          accent="hydration"
        />
      </FormSheet>

      <FormSheet
        visible={sheet === "milestone"}
        onClose={closeSheet}
        title={t("teacher.child.assessMilestone", "Assess Child Milestone")}
        subtitle={name}
        submitLabel={t("teacher.common.save")}
        onSubmit={submitMilestone}
        submitting={assessMilestone.isPending}
        error={errors.message}
      >
        {categoriesQuery.data && categoriesQuery.data.length > 0 ? (
          <EnumPicker
            label={t("milestones.category", "Category")}
            options={categoriesQuery.data.map((c) => String(c.id))}
            visuals={Object.fromEntries(categoriesQuery.data.map((c) => [String(c.id), { label: c.name, emoji: "🎯" }]))}
            i18nPrefix=""
            value={selectedCatId ? String(selectedCatId) : String(categoriesQuery.data[0].id)}
            onChange={(v) => setSelectedCatId(Number(v))}
          />
        ) : null}
        <Stepper
          label={t("milestones.progress", "Progress (%)")}
          value={progressPct}
          onChange={setProgressPct}
          min={0}
          max={100}
          step={10}
          suffix="%"
          accent="primary"
        />
        <EnumPicker
          label={t("milestones.status", "Status")}
          options={["in_progress", "achieved"]}
          visuals={{
            in_progress: { label: t("milestones.inProgress", "In Progress"), emoji: "⏳" },
            achieved: { label: t("milestones.achieved", "Achieved"), emoji: "⭐" },
          }}
          i18nPrefix=""
          value={milestoneStatus}
          onChange={(v) => setMilestoneStatus(v as any)}
        />
        <TextField
          label={t("teacher.care.note")}
          value={milestoneNote}
          onChangeText={setMilestoneNote}
          placeholder={t("teacher.care.notePlaceholder")}
          multiline
          maxLength={500}
        />
      </FormSheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontSize: 20, fontFamily: fonts.extrabold, color: colors.text },
  meta: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  allergy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#fee2e2",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.md,
  },
  allergyText: { flex: 1, fontSize: 13, fontFamily: fonts.bold, color: "#b91c1c" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  preset: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  presetActive: { borderColor: accents.sleep.main, backgroundColor: accents.sleep.tint },
  presetLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  presetLabelActive: { color: accents.sleep.dark },
});
