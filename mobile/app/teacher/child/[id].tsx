import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  useDashboard,
  useHealthProfile,
  useLogDiaper,
  useLogMeal,
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
  colors,
  fonts,
  radius,
  spacing,
} from "../../../src/theme";

type Sheet = "meal" | "diaper" | "water" | null;

export default function TeacherChildHub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const childId = Number(id);
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();

  const dashboard = useDashboard(childId);
  const health = useHealthProfile(childId);
  const logMeal = useLogMeal();
  const logDiaper = useLogDiaper();
  const upsertHydration = useUpsertHydration();
  const errors = useFieldErrors();

  const [sheet, setSheet] = useState<Sheet>(null);
  const [mealType, setMealType] = useState("lunch");
  const [mealStatus, setMealStatus] = useState("ate_well");
  const [note, setNote] = useState("");
  const [wetness, setWetness] = useState("wet");
  const [stool, setStool] = useState("none");
  const [comfort, setComfort] = useState("happy");
  const [cups, setCups] = useState(0);

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
    logDiaper.mutate(
      { childId, wetness, stool, comfort, note, occurred_at: toLocalRFC3339(new Date()) },
      { onSuccess: closeSheet, onError: (e) => errors.capture(e) },
    );
  };

  const submitWater = () => {
    errors.reset();
    upsertHydration.mutate(
      { childId, cups },
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

        <SectionTitle>{" "}</SectionTitle>
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
          onPress={() => router.push("/child/health")}
        />
        <ActionCard
          icon="trophy"
          accent="meals"
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
});
