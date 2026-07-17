import { Ionicons } from "@expo/vector-icons";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadows, spacing, type Accent, type AccentName } from "../theme";
import { IconCircle } from "./IconCircle";

interface ActionCardProps {
  icon: string;
  accent?: AccentName | Accent;
  title: string;
  subtitle?: string;
  onPress: () => void;
  chevron?: boolean;
}

/** Tappable row card with icon circle, title/subtitle and a trailing chevron. */
export function ActionCard({ icon, accent = "primary", title, subtitle, onPress, chevron = true }: ActionCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, shadows.card, pressed && { opacity: 0.85 }]}>
      <IconCircle name={icon} accent={accent} size={42} />
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {chevron && (
        <Ionicons name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  texts: { flex: 1, gap: 1 },
  title: { fontSize: 14, fontFamily: "Nunito_700Bold", color: colors.text },
  subtitle: { fontSize: 12, fontFamily: "Nunito_600SemiBold", color: colors.textMuted },
});
