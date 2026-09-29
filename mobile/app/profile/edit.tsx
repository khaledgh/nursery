import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { api, errorMessage, uploadMedia } from "../../src/api/client";
import { useMeContext, useUpdateMe } from "../../src/api/hooks";
import type { ItemResponse } from "../../src/api/types";
import { PrimaryButton } from "../../src/components/Buttons";
import { ChildAvatar } from "../../src/components/ChildAvatar";
import { TextField } from "../../src/components/form/TextField";
import { Card, Screen } from "../../src/components/ui";
import { useAuthStore, type AuthUser } from "../../src/store/auth";
import { colors, fonts, spacing } from "../../src/theme";
import { Tap } from "../../src/components/Tap";

/** The signed-in user edits their own name, phone and photo. */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, accessToken, refreshToken, setAuth } = useAuthStore();
  const me = useMeContext();
  const updateMe = useUpdateMe();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (me.data?.user?.phone !== undefined) setPhone(me.data.user.phone ?? "");
  }, [me.data]);

  // Updating the persisted user is what refreshes Home, More and every other
  // screen that reads the name/avatar from the auth store.
  const storeUser = (fresh: Partial<AuthUser>) => {
    if (user && accessToken && refreshToken) {
      setAuth({ access_token: accessToken, refresh_token: refreshToken }, { ...user, ...fresh });
    }
  };

  const changePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    const asset = result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(asset.uri, asset.mimeType ?? "image/jpeg", "avatars");
      const res = await api.put<ItemResponse<AuthUser>>("/users/me/avatar", { media_id: uploaded.id });
      storeUser({ avatar: res.data.data.avatar ?? null });
      void qc.invalidateQueries();
    } catch (err) {
      Alert.alert(t("common.error"), errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert(t("common.error"), t("profile.nameRequired"));
      return;
    }
    updateMe.mutate(
      { name: trimmed, phone: phone.trim() },
      {
        onSuccess: () => {
          storeUser({ name: trimmed });
          void qc.invalidateQueries();
          router.back();
        },
        onError: (err) => Alert.alert(t("common.error"), errorMessage(err)),
      },
    );
  };

  return (
    <Screen>
      <Card style={styles.avatarCard}>
        <ChildAvatar url={user?.avatar?.url} name={user?.name ?? "?"} size={88} ringColor={colors.primaryLight} />
        <Tap onPress={() => void changePhoto()} disabled={uploading} hitSlop={8}>
          <Text style={styles.changePhoto}>{uploading ? t("common.loading") : t("more.changePhoto")}</Text>
        </Tap>
      </Card>

      <Card style={styles.form}>
        <TextField label={t("profile.name")} value={name} onChangeText={setName} icon="person-outline" maxLength={191} />
        <TextField
          label={t("profile.phone")}
          value={phone}
          onChangeText={setPhone}
          icon="call-outline"
          keyboardType="phone-pad"
          autoCapitalize="none"
          maxLength={32}
        />
        <View>
          <Text style={styles.readonlyLabel}>{t("profile.email")}</Text>
          <Text style={styles.readonly}>{user?.email}</Text>
        </View>
      </Card>

      <PrimaryButton label={t("common.save")} icon="checkmark" loading={updateMe.isPending} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  changePhoto: { color: colors.primary, fontFamily: fonts.bold, fontSize: 14 },
  form: { gap: spacing.md },
  readonlyLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted, marginBottom: 2 },
  readonly: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
});
