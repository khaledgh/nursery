import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { uploadMedia } from "../../api/client";
import { colors, fonts, radius, spacing } from "../../theme";

interface PhotoFieldProps {
  label?: string;
  mediaIds: number[];
  onChange: (ids: number[]) => void;
  /** Backend caps diary attachments at 10. */
  max?: number;
  allowCamera?: boolean;
}

/**
 * Picks images, uploads each straight to R2, and reports back the media ids
 * the parent entity will reference. Local thumbnails appear immediately so the
 * teacher is never blocked watching an upload spinner.
 */
export function PhotoField({ label, mediaIds, onChange, max = 10, allowCamera = true }: PhotoFieldProps) {
  const { t } = useTranslation();
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const full = mediaIds.length >= max;

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    setPreviews((p) => [...p, asset.uri]);
    setBusy(true);
    try {
      const media = await uploadMedia(asset.uri, asset.mimeType ?? "image/jpeg");
      onChange([...mediaIds, media.id]);
    } catch {
      setPreviews((p) => p.filter((uri) => uri !== asset.uri));
      Alert.alert("", t("teacher.common.failed"));
    } finally {
      setBusy(false);
    }
  };

  const fromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    const asset = res.assets?.[0];
    if (asset) await upload(asset);
  };

  const fromCamera = async () => {
    // Asked at the point of use, not at launch: a permission dialog with no
    // context on first login gets denied.
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      // Degrade to library rather than dead-ending the teacher.
      await fromLibrary();
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
    const asset = res.assets?.[0];
    if (asset) await upload(asset);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {previews.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {previews.map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.thumb} contentFit="cover" />
          ))}
          {busy ? (
            <View style={[styles.thumb, styles.thumbBusy]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      <View style={styles.actions}>
        {allowCamera ? (
          <Pressable style={styles.btn} onPress={() => void fromCamera()} disabled={full || busy}>
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={styles.btnLabel}>{t("teacher.diaryEntry.camera")}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.btn} onPress={() => void fromLibrary()} disabled={full || busy}>
          <Ionicons name="images-outline" size={18} color={colors.primary} />
          <Text style={styles.btnLabel}>{t("teacher.diaryEntry.library")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  thumbs: { gap: spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  thumbBusy: { alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: spacing.sm },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  btnLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
});
