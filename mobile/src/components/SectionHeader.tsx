import { Ionicons } from "@expo/vector-icons";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../theme";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Short instruction under the title, e.g. "Tap an icon to open it". */
  hint?: string;
}

/** Section title with an optional trailing "View all ›" link. */
export function SectionHeader({ title, actionLabel, onAction, hint }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {hint ? (
          <View style={styles.hintRow}>
            <Ionicons name="hand-left-outline" size={12} color={colors.primary} />
            <Text style={styles.hint}>{hint}</Text>
          </View>
        ) : null}
      </View>
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
  titleWrap: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  hint: { fontSize: 12, fontFamily: fonts.semibold, color: colors.primary },
  action: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.primary },
});
