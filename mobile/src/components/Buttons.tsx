import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { accents, colors, radius, spacing, type Accent, type AccentName } from "../theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accent?: AccentName | Accent;
  icon?: string;
}

export function PrimaryButton({ label, onPress, loading, disabled, accent = "primary", icon }: ButtonProps) {
  const a: Accent = typeof accent === "string" ? accents[accent] : accent;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.base, { backgroundColor: a.main, opacity: off ? 0.5 : pressed ? 0.85 : 1 }]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color="#fff" />}
          <Text style={styles.primaryLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function GhostButton({ label, onPress, loading, disabled, accent = "primary", icon }: ButtonProps) {
  const a: Accent = typeof accent === "string" ? accents[accent] : accent;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        styles.ghost,
        { borderColor: a.main, backgroundColor: pressed ? a.tint : colors.card, opacity: off ? 0.5 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={a.main} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={a.main} />}
          <Text style={[styles.ghostLabel, { color: a.dark }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  primaryLabel: { color: "#fff", fontSize: 14, fontFamily: "Nunito_700Bold" },
  ghost: { borderWidth: 1.5 },
  ghostLabel: { fontSize: 14, fontFamily: "Nunito_700Bold" },
});
