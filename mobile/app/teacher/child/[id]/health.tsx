import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCreateHealthRecord, useHealthProfile } from "../../../../src/api/hooks";
import { FormSheet } from "../../../../src/components/form/FormSheet";
import { TextField } from "../../../../src/components/form/TextField";
import { ActionCard } from "../../../../src/components/ActionCard";
import { Card, Loading, Screen, SectionTitle } from "../../../../src/components/ui";
import { toISODate } from "../../../../src/lib/stats";
import { accents, colors, fonts, radius, spacing } from "../../../../src/theme";

type Sheet = "temperature" | "illness" | "incident" | null;

/** Temperatures a teacher actually records, so no decimal keyboard fumbling. */
const TEMPS = [36.5, 37, 37.5, 38, 38.5, 39, 39.5];

export default function TeacherHealth() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const childId = Number(id);
  const { t } = useTranslation();

  const health = useHealthProfile(childId);
  const addVital = useCreateHealthRecord("vitals");
  const addIllness = useCreateHealthRecord("illnesses");
  const addNote = useCreateHealthRecord("notes");

  const [sheet, setSheet] = useState<Sheet>(null);
  const [temp, setTemp] = useState(37);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const close = () => {
    setSheet(null);
    setTitle("");
    setBody("");
    setFormError(null);
  };

  const fail = () => setFormError(t("teacher.common.failed"));

  const saveTemperature = () =>
    addVital.mutate(
      { childId, date: toISODate(new Date()), temperature: temp },
      { onSuccess: close, onError: fail },
    );

  const saveIllness = () => {
    // These endpoints bind straight to the model and return no field errors,
    // so the check has to happen here.
    if (!title.trim()) {
      setFormError(t("teacher.health.titleRequired"));
      return;
    }
    addIllness.mutate(
      {
        childId,
        title: title.trim(),
        status: "active",
        temperature: temp,
        date: toISODate(new Date()),
        note: body.trim(),
      },
      { onSuccess: close, onError: fail },
    );
  };

  const saveIncident = () => {
    if (!title.trim()) {
      setFormError(t("teacher.health.titleRequired"));
      return;
    }
    // Recorded as a health note with an [Incident] prefix — see the note in
    // the plan: this is an interim shape, not a formal incident record.
    addNote.mutate(
      { childId, title: `[Incident] ${title.trim()}`, body: body.trim() },
      { onSuccess: close, onError: fail },
    );
  };

  if (health.isLoading) return <Loading />;

  const profile = health.data;
  const allergies = profile?.allergies ?? [];
  const illnesses = profile?.illnesses ?? [];
  const notes = profile?.notes ?? [];

  return (
    <>
      <Screen refreshing={health.isRefetching} onRefresh={() => void health.refetch()}>
        {allergies.length > 0 ? (
          <View style={styles.allergy}>
            <Ionicons name="warning" size={18} color={colors.danger} />
            <Text style={styles.allergyText}>
              {t("teacher.child.allergyWarning")}: {allergies.map((a) => a.name).join(", ")}
            </Text>
          </View>
        ) : null}

        <SectionTitle>{t("teacher.health.record")}</SectionTitle>
        <ActionCard
          icon="thermometer"
          accent="health"
          title={t("teacher.health.addVital")}
          onPress={() => setSheet("temperature")}
        />
        <ActionCard
          icon="medkit"
          accent="community"
          title={t("teacher.health.addIllness")}
          onPress={() => setSheet("illness")}
        />
        <ActionCard
          icon="alert-circle"
          accent="meals"
          title={t("teacher.health.addIncident")}
          onPress={() => setSheet("incident")}
        />

        {illnesses.length > 0 ? (
          <>
            <SectionTitle>{t("health.records")}</SectionTitle>
            {illnesses.slice(0, 5).map((row) => (
              <Card key={row.id}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowMeta}>{row.date}</Text>
              </Card>
            ))}
          </>
        ) : null}

        {notes.length > 0 ? (
          <>
            <SectionTitle>{t("health.notes")}</SectionTitle>
            {notes.slice(0, 5).map((row) => (
              <Card key={row.id}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                {row.body ? <Text style={styles.rowMeta}>{row.body}</Text> : null}
              </Card>
            ))}
          </>
        ) : null}
      </Screen>

      <FormSheet
        visible={sheet === "temperature"}
        onClose={close}
        title={t("teacher.health.addVital")}
        submitLabel={t("teacher.common.save")}
        onSubmit={saveTemperature}
        submitting={addVital.isPending}
        error={formError ?? undefined}
      >
        <TempPicker value={temp} onChange={setTemp} label={t("health.temperature")} />
      </FormSheet>

      <FormSheet
        visible={sheet === "illness"}
        onClose={close}
        title={t("teacher.health.addIllness")}
        submitLabel={t("teacher.common.save")}
        onSubmit={saveIllness}
        submitting={addIllness.isPending}
        canSubmit={!!title.trim()}
        error={formError ?? undefined}
      >
        <TextField
          label={t("teacher.diaryEntry.entryTitle")}
          value={title}
          onChangeText={setTitle}
          placeholder={t("teacher.health.illnessPlaceholder")}
          maxLength={191}
        />
        <TempPicker value={temp} onChange={setTemp} label={t("health.temperature")} />
        <TextField
          label={t("teacher.care.note")}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={1000}
        />
      </FormSheet>

      <FormSheet
        visible={sheet === "incident"}
        onClose={close}
        title={t("teacher.health.addIncident")}
        submitLabel={t("teacher.common.save")}
        onSubmit={saveIncident}
        submitting={addNote.isPending}
        canSubmit={!!title.trim()}
        error={formError ?? undefined}
      >
        <TextField
          label={t("teacher.diaryEntry.entryTitle")}
          value={title}
          onChangeText={setTitle}
          placeholder={t("teacher.health.incidentPlaceholder")}
          maxLength={170}
        />
        <TextField
          label={t("teacher.health.whatHappened")}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
        />
      </FormSheet>
    </>
  );
}

function TempPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.temps}>
        {TEMPS.map((n) => {
          const active = value === n;
          // 38°C and above is the conventional fever threshold.
          const feverish = n >= 38;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={[
                styles.temp,
                active && {
                  borderColor: feverish ? colors.danger : accents.health.main,
                  backgroundColor: feverish ? "#fee2e2" : accents.health.tint,
                },
              ]}
            >
              <Text style={[styles.tempLabel, active && { color: feverish ? "#b91c1c" : accents.health.dark }]}>
                {n.toFixed(1)}°
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  temps: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  temp: {
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  tempLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  rowTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  rowMeta: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
});
