import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { accents, radius, type Accent, type AccentName } from "../theme";

interface PillBadgeProps {
  label: string;
  accent?: AccentName | Accent;
  icon?: string;
  dot?: boolean;
  emoji?: string;
}

/** Rounded status pill ("Ate well", "Wet", "Paid"). */
export function PillBadge({ label, accent = "primary", icon, dot, emoji }: PillBadgeProps) {
  const a: Accent = typeof accent === "string" ? accents[accent] : accent;
  return (
    <View style={[styles.pill, { backgroundColor: a.tint }]}>
      {dot && <View style={[styles.dot, { backgroundColor: a.main }]} />}
      {icon && <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={12} color={a.main} />}
      {emoji && <Text style={styles.emoji}>{emoji}</Text>}
      <Text style={[styles.label, { color: a.dark }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  emoji: { fontSize: 11 },
  label: { fontSize: 12, fontFamily: "Nunito_700Bold" },
});
