import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "../../theme";
import { PrimaryButton } from "../Buttons";

interface FormSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  submitLabel: string;
  onSubmit: () => void;
  submitting?: boolean;
  canSubmit?: boolean;
  /** Non-field error shown above the submit button. */
  error?: string;
  children: ReactNode;
}

/**
 * Bottom sheet for single-child entry.
 *
 * A sheet rather than a pushed route: after logging for one child the teacher
 * is returned to exactly the list position they were on, with no back
 * navigation. Submit is disabled while in flight so an impatient double-tap
 * cannot create two meal logs — the API has no idempotency key.
 */
export function FormSheet({
  visible,
  onClose,
  title,
  subtitle,
  submitLabel,
  onSubmit,
  submitting,
  canSubmit = true,
  error,
  children,
}: FormSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropFill} onPress={submitting ? undefined : onClose} />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} disabled={submitting} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* shrink lets the scroll area give up space to the header and the
              button instead of pushing them off-screen. */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          <View style={styles.footer}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton
              label={submitLabel}
              onPress={onSubmit}
              loading={submitting}
              disabled={!canSubmit || submitting}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)" },
  backdropFill: { flex: 1 },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    // Cap the sheet, but let it shrink to its content when it is short.
    maxHeight: "85%",
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingBottom: spacing.md },
  title: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: spacing.md, paddingBottom: spacing.md },
  footer: { gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.md },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.semibold, textAlign: "center" },
});
