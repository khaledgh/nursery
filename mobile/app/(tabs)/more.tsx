import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { api, uploadMedia } from "../../src/api/client";
import type { ItemResponse } from "../../src/api/types";
import { ActionCard } from "../../src/components/ActionCard";
import { ChildAvatar } from "../../src/components/ChildAvatar";
import { SectionHeader } from "../../src/components/SectionHeader";
import { Card, Screen } from "../../src/components/ui";
import { applyLocale } from "../../src/i18n";
import { useAuthStore, type AuthUser } from "../../src/store/auth";
import { colors, fonts, radius, spacing } from "../../src/theme";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "sv", label: "Svenska" },
  { code: "ar", label: "العربية" },
];

export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, locale, setLocale, setAuth, accessToken, refreshToken, logout } = useAuthStore();
  const [uploading, setUploading] = useState(false);

  const switchLocale = async (code: string) => {
    setLocale(code);
    const directionChanged = applyLocale(code);
    try {
      await api.put("/auth/locale", { locale: code });
    } catch {
      // server-side preference is best-effort
    }
    if (directionChanged) {
      Alert.alert("", t("more.restartNote"));
    }
  };

  const changePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    const asset = result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const uploaded = await uploadMedia(asset.uri, asset.mimeType ?? "image/jpeg");
      const res = await api.put<ItemResponse<AuthUser>>("/users/me/avatar", { media_id: uploaded.id });
      if (accessToken && refreshToken) {
        setAuth({ access_token: accessToken, refresh_token: refreshToken }, res.data.data);
      }
      void qc.invalidateQueries();
    } catch {
      Alert.alert("", t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const signOut = async () => {
    try {
      if (refreshToken) await api.post("/auth/logout", { refresh_token: refreshToken });
    } catch {
      // local logout regardless
    }
    logout();
    router.replace("/(auth)/login");
  };

  return (
    <Screen>
      {/* Profile */}
      <Card style={styles.profile}>
        <ChildAvatar url={user?.avatar?.url} name={user?.name ?? "?"} size={64} ringColor={colors.primaryLight} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Pressable onPress={() => void changePhoto()} disabled={uploading} hitSlop={6}>
            <Text style={styles.changePhoto}>{uploading ? t("common.loading") : t("more.changePhoto")}</Text>
          </Pressable>
        </View>
      </Card>

      {/* Links */}
      <ActionCard icon="chatbubbles" accent="primary" title="Messages & Chat" onPress={() => router.push("/chat")} />
      <ActionCard icon="options" accent="activity" title="Notification Preferences" onPress={() => router.push("/notification-settings")} />
      <ActionCard icon="heart" accent="health" title={t("home.health")} onPress={() => router.push("/child/health")} />
      <ActionCard icon="trophy" accent="meals" title={t("home.milestones")} onPress={() => router.push("/child/milestones")} />
      <ActionCard icon="school" accent="diaper" title={t("home.classroom")} onPress={() => router.push("/classroom")} />
      <ActionCard icon="images" accent="activity" title={t("home.gallery")} onPress={() => router.push("/child/gallery")} />
      <ActionCard icon="people" accent="activity" title={t("home.community")} onPress={() => router.push("/community")} />
      <ActionCard icon="card" accent="payments" title={t("home.payments")} onPress={() => router.push("/payments")} />
      <ActionCard icon="briefcase" accent="community" title={t("home.whatToBring")} onPress={() => router.push("/reminders")} />
      <ActionCard icon="notifications" accent="primary" title={t("notifications.title")} onPress={() => router.push("/notifications")} />

      <SectionHeader title={t("more.language")} />
      <Card>
        <View style={styles.localeRow}>
          {LOCALES.map((l) => (
            <Pressable
              key={l.code}
              onPress={() => void switchLocale(l.code)}
              style={[styles.localeChip, locale === l.code && styles.localeChipActive]}
            >
              <Text style={[styles.localeText, locale === l.code && styles.localeTextActive]}>{l.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Pressable style={styles.logout} onPress={() => void signOut()}>
        <Text style={styles.logoutText}>{t("more.logout")}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  name: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  email: { fontFamily: fonts.semibold, color: colors.textMuted, marginTop: 2, fontSize: 12 },
  changePhoto: { fontFamily: fonts.bold, color: colors.primary, marginTop: 6, fontSize: 12 },
  localeRow: { flexDirection: "row", gap: spacing.sm },
  localeChip: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  localeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  localeText: { fontFamily: fonts.bold, color: colors.text },
  localeTextActive: { color: "#fff" },
  logout: {
    backgroundColor: "#fee2e2",
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.md,
  },
  logoutText: { color: colors.danger, fontFamily: fonts.bold },
});
