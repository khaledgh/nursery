import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useCreateDiary } from "../../../../src/api/hooks";
import { PrimaryButton } from "../../../../src/components/Buttons";
import { EnumPicker } from "../../../../src/components/form/EnumPicker";
import { PhotoField } from "../../../../src/components/form/PhotoField";
import { TextField } from "../../../../src/components/form/TextField";
import { Card, Screen } from "../../../../src/components/ui";
import { toLocalRFC3339 } from "../../../../src/lib/stats";
import { useFieldErrors } from "../../../../src/lib/useFieldErrors";
import { DIARY_TYPE, colors, fonts, spacing } from "../../../../src/theme";

export default function TeacherDiaryEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const childId = Number(id);
  const { t } = useTranslation();
  const router = useRouter();
  const createDiary = useCreateDiary();
  const errors = useFieldErrors();

  const [type, setType] = useState("activity");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaIds, setMediaIds] = useState<number[]>([]);
  // Every diary entry pushes to guardians. Photos are posted in bursts, so
  // they default to silent; a written note is deliberate and defaults to on.
  const [notify, setNotify] = useState(true);

  const onTypeChange = (next: string) => {
    setType(next);
    setNotify(next !== "photo");
  };

  const submit = () => {
    errors.reset();
    createDiary.mutate(
      {
        childId,
        type,
        title: title.trim(),
        body: body.trim(),
        media_ids: mediaIds,
        occurred_at: toLocalRFC3339(new Date()),
        notify,
      },
      {
        onSuccess: () => router.back(),
        onError: (e) => errors.capture(e),
      },
    );
  };

  return (
    <Screen>
      <EnumPicker
        label={t("teacher.diaryEntry.type")}
        options={Object.keys(DIARY_TYPE)}
        visuals={DIARY_TYPE}
        i18nPrefix="enums.diaryType"
        value={type}
        onChange={onTypeChange}
        error={errors.fieldError("type")}
      />
      <TextField
        label={t("teacher.diaryEntry.entryTitle")}
        value={title}
        onChangeText={setTitle}
        placeholder={t("teacher.diaryEntry.titlePlaceholder")}
        maxLength={191}
        error={errors.fieldError("title")}
      />
      <TextField
        label={t("teacher.diaryEntry.body")}
        value={body}
        onChangeText={setBody}
        placeholder={t("teacher.diaryEntry.bodyPlaceholder")}
        multiline
        maxLength={2000}
        error={errors.fieldError("body")}
      />
      <PhotoField label={t("teacher.diaryEntry.photos")} mediaIds={mediaIds} onChange={setMediaIds} max={10} />

      <Card style={styles.notifyRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.notifyLabel}>{t("teacher.diaryEntry.notifyParents")}</Text>
          <Text style={styles.notifyHint}>{t("teacher.diaryEntry.notifyHint")}</Text>
        </View>
        <Switch value={notify} onValueChange={setNotify} trackColor={{ true: colors.primary }} />
      </Card>

      {errors.message ? <Text style={styles.error}>{errors.message}</Text> : null}
      <PrimaryButton
        label={t("teacher.common.save")}
        onPress={submit}
        loading={createDiary.isPending}
        disabled={!title.trim() || createDiary.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  notifyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  notifyLabel: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  notifyHint: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.semibold, textAlign: "center" },
});
