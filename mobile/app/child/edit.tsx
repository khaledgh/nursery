import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { errorMessage, uploadMedia } from "../../src/api/client";
import {
  useAddAllergy,
  useAddHealthNote,
  useDeleteAllergy,
  useDeleteHealthNote,
  useHealthProfile,
  useUpdateChildProfile,
} from "../../src/api/hooks";
import type { Allergy } from "../../src/api/types";
import { GhostButton, PrimaryButton } from "../../src/components/Buttons";
import { ChildAvatar } from "../../src/components/ChildAvatar";
import { DateTimeField } from "../../src/components/form/DateTimeField";
import { TextField } from "../../src/components/form/TextField";
import { SectionHeader } from "../../src/components/SectionHeader";
import { Card, Screen } from "../../src/components/ui";
import { toISODate } from "../../src/lib/stats";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, fonts, radius, spacing } from "../../src/theme";
import { Tap } from "../../src/components/Tap";

const SEVERITIES: Allergy["severity"][] = ["mild", "moderate", "severe"];
const SEVERITY_COLOR: Record<Allergy["severity"], string> = { mild: "#10b981", moderate: "#f59e0b", severe: "#ef4444" };

/** A parent edits their child's profile and keeps allergies/medical notes current. */
export default function EditChildScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const child = useActiveChild((s) => s.child);
  const childId = child?.id;

  const update = useUpdateChildProfile(childId);
  const health = useHealthProfile(childId);
  const addAllergy = useAddAllergy(childId);
  const deleteAllergy = useDeleteAllergy(childId);
  const addNote = useAddHealthNote(childId);
  const deleteNote = useDeleteHealthNote(childId);

  const [firstName, setFirstName] = useState(child?.first_name ?? "");
  const [lastName, setLastName] = useState(child?.last_name ?? "");
  const [dob, setDob] = useState<Date>(child?.dob ? new Date(child.dob) : new Date());
  const [uploading, setUploading] = useState(false);

  const [allergyName, setAllergyName] = useState("");
  const [severity, setSeverity] = useState<Allergy["severity"]>("mild");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  useEffect(() => {
    if (!child) return;
    setFirstName(child.first_name);
    setLastName(child.last_name);
    if (child.dob) setDob(new Date(child.dob));
  }, [child?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!child) {
    return (
      <Screen>
        <Text style={styles.muted}>{t("common.loading")}</Text>
      </Screen>
    );
  }

  const fail = (err: unknown) => Alert.alert(t("common.error"), errorMessage(err));

  const changePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    const asset = result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(asset.uri, asset.mimeType ?? "image/jpeg", "avatars");
      await update.mutateAsync({ avatar_id: uploaded.id });
    } catch (err) {
      fail(err);
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(t("common.error"), t("profile.nameRequired"));
      return;
    }
    update.mutate(
      { first_name: firstName.trim(), last_name: lastName.trim(), dob: toISODate(dob) },
      { onSuccess: () => router.back(), onError: fail },
    );
  };

  const allergies = health.data?.allergies ?? [];
  const notes = health.data?.notes ?? [];

  const confirmDelete = (onYes: () => void) =>
    Alert.alert(t("common.delete"), t("profile.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: onYes },
    ]);

  return (
    <Screen>
      <Card style={styles.avatarCard}>
        <ChildAvatar url={child.avatar?.url} name={child.first_name} size={88} ringColor={colors.primaryLight} />
        <Tap onPress={() => void changePhoto()} disabled={uploading} hitSlop={8}>
          <Text style={styles.link}>{uploading ? t("common.loading") : t("profile.changeChildPhoto")}</Text>
        </Tap>
      </Card>

      <Card style={styles.form}>
        <TextField label={t("profile.firstName")} value={firstName} onChangeText={setFirstName} maxLength={100} />
        <TextField label={t("profile.lastName")} value={lastName} onChangeText={setLastName} maxLength={100} />
        <DateTimeField label={t("profile.birthday")} mode="date" value={dob} maximumDate={new Date()} onChange={setDob} />
        <PrimaryButton label={t("common.save")} icon="checkmark" loading={update.isPending && !uploading} onPress={saveProfile} />
      </Card>

      <SectionHeader title={t("profile.allergies")} />
      <Card style={styles.form}>
        {allergies.length === 0 && <Text style={styles.muted}>{t("profile.noAllergies")}</Text>}
        {allergies.map((a) => (
          <View key={a.id} style={styles.itemRow}>
            <View style={[styles.dot, { backgroundColor: SEVERITY_COLOR[a.severity] }]} />
            <Text style={styles.itemTitle}>{a.name}</Text>
            <Text style={styles.itemMeta}>{t(`enums.severity.${a.severity}`)}</Text>
            <Tap hitSlop={10} onPress={() => confirmDelete(() => deleteAllergy.mutate(a.id, { onError: fail }))}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Tap>
          </View>
        ))}
        <TextField label={t("profile.addAllergy")} value={allergyName} onChangeText={setAllergyName} placeholder={t("profile.allergyPlaceholder")} maxLength={191} />
        <View style={styles.chips}>
          {SEVERITIES.map((s) => (
            <Tap
              key={s}
              onPress={() => setSeverity(s)}
              style={[styles.chip, severity === s && { backgroundColor: SEVERITY_COLOR[s], borderColor: SEVERITY_COLOR[s] }]}
            >
              <Text style={[styles.chipText, severity === s && styles.chipTextActive]}>{t(`enums.severity.${s}`)}</Text>
            </Tap>
          ))}
        </View>
        <GhostButton
          label={t("profile.add")}
          icon="add"
          disabled={!allergyName.trim()}
          loading={addAllergy.isPending}
          onPress={() =>
            addAllergy.mutate({ name: allergyName.trim(), severity }, { onSuccess: () => setAllergyName(""), onError: fail })
          }
        />
      </Card>

      <SectionHeader title={t("profile.medicalNotes")} />
      <Card style={styles.form}>
        {notes.length === 0 && <Text style={styles.muted}>{t("profile.noNotes")}</Text>}
        {notes.map((n) => (
          <View key={n.id} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{n.title}</Text>
              {n.body ? <Text style={styles.itemMeta}>{n.body}</Text> : null}
            </View>
            <Tap hitSlop={10} onPress={() => confirmDelete(() => deleteNote.mutate(n.id, { onError: fail }))}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Tap>
          </View>
        ))}
        <TextField label={t("profile.noteTitle")} value={noteTitle} onChangeText={setNoteTitle} maxLength={191} />
        <TextField label={t("profile.noteBody")} value={noteBody} onChangeText={setNoteBody} multiline maxLength={2000} />
        <GhostButton
          label={t("profile.add")}
          icon="add"
          disabled={!noteTitle.trim()}
          loading={addNote.isPending}
          onPress={() =>
            addNote.mutate(
              { title: noteTitle.trim(), body: noteBody.trim() },
              {
                onSuccess: () => {
                  setNoteTitle("");
                  setNoteBody("");
                },
                onError: fail,
              },
            )
          }
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  link: { color: colors.primary, fontFamily: fonts.bold, fontSize: 14 },
  form: { gap: spacing.md },
  muted: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemTitle: { flex: 1, fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  itemMeta: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  chips: { flexDirection: "row", gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: colors.card,
  },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  chipTextActive: { color: "#fff" },
});
