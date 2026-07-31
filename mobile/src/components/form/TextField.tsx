import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, radius, spacing } from "../../theme";
import { FieldError } from "../FieldError";

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  icon?: string;
  multiline?: boolean;
  /**
   * Mirror the backend validator's limit so the keyboard stops the teacher
   * rather than a server error after they have finished typing.
   */
  maxLength?: number;
  keyboardType?: "default" | "numeric" | "email-address";
  autoCapitalize?: "none" | "sentences";
  error?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  multiline,
  maxLength,
  keyboardType = "default",
  autoCapitalize = "sentences",
  error,
}: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, multiline && styles.inputWrapMultiline, !!error && styles.inputWrapError]}>
        {icon ? <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.textMuted} /> : null}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputWrapMultiline: { alignItems: "flex-start", paddingVertical: spacing.sm, minHeight: 96 },
  inputWrapError: { borderColor: colors.danger },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  inputMultiline: { textAlignVertical: "top", minHeight: 80 },
});
