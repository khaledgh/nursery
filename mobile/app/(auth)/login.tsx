import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
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
  ScrollView,
} from "react-native";
import { api } from "../../src/api/client";
import { PrimaryButton } from "../../src/components/Buttons";
import { FieldError } from "../../src/components/FieldError";
import { useFieldErrors } from "../../src/lib/useFieldErrors";
import type { AuthUser, TokenPair } from "../../src/store/auth";
import { homeRouteForRole, useAuthStore } from "../../src/store/auth";
import { colors, fonts, gradients, radius, spacing } from "../../src/theme";

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const errors = useFieldErrors();

  const submit = async () => {
    setBusy(true);
    errors.reset();
    try {
      // Parents and teachers sign in with the id their nursery issued, not an
      // email: it resolves the nursery unambiguously, and many parents share
      // or lack a personal address.
      const res = await api.post<{ data: { user: AuthUser; tokens: TokenPair } }>("/auth/login", {
        login_id: loginId.trim().toLowerCase(),
        password,
      });
      const { user, tokens } = res.data.data;
      setAuth(tokens, user);
      router.replace(homeRouteForRole(user.role));
    } catch (err) {
      errors.capture(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      <KeyboardAvoidingView 
        style={styles.inner} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.logoCircle}>
              <Image source={require("../../assets/logo-mark.png")} style={styles.logo} contentFit="contain" />
            </View>
            <Text style={styles.title}>{t("auth.title")}</Text>
            <Text style={styles.subtitle}>{t("auth.subtitle")}</Text>
          </View>
          <View style={styles.form}>
            <Text style={styles.label}>{t("auth.loginId")}</Text>
            <View style={[styles.inputWrap, errors.fieldError("login_id") && styles.inputWrapError]}>
              <Ionicons name="card-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                value={loginId}
                onChangeText={setLoginId}
                placeholder="nursery-1042"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <Text style={styles.hint}>{t("auth.loginIdHint")}</Text>
            <FieldError message={errors.fieldError("login_id")} />
            <Text style={styles.label}>{t("auth.password")}</Text>
            <View style={[styles.inputWrap, errors.fieldError("password") && styles.inputWrapError]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
              />
            </View>
            <FieldError message={errors.fieldError("password")} />
            {errors.message ? <Text style={styles.error}>{errors.message}</Text> : null}
            <PrimaryButton
              label={t("auth.submit")}
              onPress={() => void submit()}
              loading={busy}
              disabled={!loginId || !password}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  hero: { alignItems: "center", marginBottom: spacing.xl },
  logo: {
    width: 60,
    height: 60,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.92)",
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
  hint: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textMuted, marginTop: -spacing.xs },
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
  inputWrapError: { borderColor: colors.danger },
  input: { flex: 1, paddingVertical: 12, fontFamily: fonts.semibold, color: colors.text },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.semibold },
});
