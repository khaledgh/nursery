import { Ionicons } from "@expo/vector-icons";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, fonts, radius, spacing } from "../theme";
import { addDays } from "../lib/stats";
import { IconCircle } from "./IconCircle";

interface WeekSelectorProps {
  weekStart: Date; // Monday
  onChange: (monday: Date) => void;
}

/** ‹ May 19 – May 25 › week navigation (Monday-start, matches the API). */
export function WeekSelector({ weekStart, onChange }: WeekSelectorProps) {
  const { i18n } = useTranslation();
  const end = addDays(weekStart, 6);
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const back = I18nManager.isRTL ? "chevron-forward" : "chevron-back";
  const fwd = I18nManager.isRTL ? "chevron-back" : "chevron-forward";

  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(addDays(weekStart, -7))} style={styles.arrow} hitSlop={8}>
        <Ionicons name={back} size={18} color={colors.primary} />
      </Pressable>
      <View style={styles.center}>
        <IconCircle name="calendar" accent="primary" size={30} />
        <Text style={styles.label}>
          {weekStart.toLocaleDateString(i18n.language, fmt)} – {end.toLocaleDateString(i18n.language, fmt)},{" "}
          {end.getFullYear()}
        </Text>
      </View>
      <Pressable onPress={() => onChange(addDays(weekStart, 7))} style={styles.arrow} hitSlop={8}>
        <Ionicons name={fwd} size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
});
