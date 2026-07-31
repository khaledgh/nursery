import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { ActionCard } from "../../src/components/ActionCard";
import { ChildAvatar } from "../../src/components/ChildAvatar";
import { SectionHeader } from "../../src/components/SectionHeader";
import { Card, Screen } from "../../src/components/ui";
import { applyLocale } from "../../src/i18n";
import { useAuthStore } from "../../src/store/auth";
import { colors, fonts, radius, spacing } from "../../src/theme";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "sv", label: "Svenska" },
  { code: "ar", label: "العربية" },
];

/** Staff profile + settings. Deliberately without the parent-only links. */
export default function TeacherMore() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, locale, setLocale, refreshToken, logout } = useAuthStore();

  const switchLocale = async (code: string) => {
    setLocale(code);
    const directionChanged = applyLocale(code);
    try {
      await api.put("/auth/locale", { locale: code });
    } catch {
      // server-side preference is best-effort
    }
    if (directionChanged) Alert.alert("", t("more.restartNote"));
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
      <Card style={styles.profile}>
        <ChildAvatar url={user?.avatar?.url} name={user?.name ?? "?"} size={64} ringColor={colors.primaryLight} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </Card>

      <ActionCard
        icon="notifications"
        accent="primary"
        title={t("notifications.title")}
        onPress={() => router.push("/notifications")}
      />
      <ActionCard
        icon="briefcase"
        accent="community"
        title={t("home.whatToBring")}
        onPress={() => router.push("/reminders")}
      />

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
  localeText: { fontFamily: fonts.bold, color: colors.text, fontSize: 13 },
  localeTextActive: { color: "#fff" },
  logout: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  logoutText: { fontFamily: fonts.bold, color: colors.danger, fontSize: 14 },
});
