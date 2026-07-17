import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, errorMessage } from "../../src/api/client";
import { PrimaryButton } from "../../src/components/Buttons";
import type { AuthUser, TokenPair } from "../../src/store/auth";
import { useAuthStore } from "../../src/store/auth";
import { colors, fonts, radius, spacing } from "../../src/theme";

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ data: { user: AuthUser; tokens: TokenPair } }>("/auth/login", {
        email: email.trim(),
        password,
      });
      const { user, tokens } = res.data.data;
      setAuth(tokens, user);
      router.replace("/(tabs)");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={["#8b5cf6", "#5b21b6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      <KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Ionicons name="sunny" size={44} color="#fbbf24" />
          </View>
          <Text style={styles.title}>{t("auth.title")}</Text>
          <Text style={styles.subtitle}>{t("auth.subtitle")}</Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>{t("auth.email")}</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <Text style={styles.label}>{t("auth.password")}</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label={t("auth.submit")}
            onPress={() => void submit()}
            loading={busy}
            disabled={!email || !password}
          />
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: spacing.xl },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: { fontSize: 28, fontFamily: fonts.extrabold, color: "#fff" },
  subtitle: { fontFamily: fonts.semibold, color: "#ddd6fe", marginTop: spacing.xs },
  form: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, paddingVertical: 12, fontFamily: fonts.semibold, color: colors.text },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.semibold },
});
