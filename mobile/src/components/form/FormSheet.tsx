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
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropFill} onPress={submitting ? undefined : onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable onPress={onClose} disabled={submitting} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton
              label={submitLabel}
              onPress={onSubmit}
              loading={submitting}
              disabled={!canSubmit || submitting}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
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
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: "88%",
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  title: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  body: { gap: spacing.md, paddingBottom: spacing.sm },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.semibold, textAlign: "center" },
});
