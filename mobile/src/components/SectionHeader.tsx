import { Ionicons } from "@expo/vector-icons";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Section title with an optional trailing "View all ›" link. */
export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={styles.action} hitSlop={8}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          <Ionicons name={I18nManager.isRTL ? "chevron-back" : "chevron-forward"} size={14} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  action: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
});
