import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "../../theme";
import { Tap } from "../Tap";

interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  mode: "date" | "time";
  minimumDate?: Date;
  maximumDate?: Date;
}

/**
 * A native date or time picker styled as a form field.
 *
 * iOS renders the compact inline picker (a tappable pill that opens the system
 * popover) so it works inside our own modals without stacking another Modal.
 * Android opens the system dialog imperatively.
 */
export function DateTimeField({ label, value, onChange, mode, minimumDate, maximumDate }: DateTimeFieldProps) {
  const { i18n } = useTranslation();

  const formatted =
    mode === "date"
      ? value.toLocaleDateString(i18n.language, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : value.toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" });

  // onValueChange fires only when a value is picked (not on dismiss).
  const handle = (_event: unknown, picked: Date) => onChange(picked);

  if (Platform.OS === "ios") {
    return (
      <View style={styles.field}>
        <Ionicons name={mode === "date" ? "calendar-outline" : "time-outline"} size={18} color={colors.primary} />
        <Text style={styles.label}>{label}</Text>
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          locale={i18n.language}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          minuteInterval={5}
          onValueChange={handle}
          accentColor={colors.primary}
        />
      </View>
    );
  }

  const open = () =>
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: true,
      minimumDate,
      maximumDate,
      onValueChange: handle,
    });

  return (
    <Tap style={styles.field} onPress={open} accessibilityRole="button" accessibilityLabel={`${label}: ${formatted}`}>
      <Ionicons name={mode === "date" ? "calendar-outline" : "time-outline"} size={18} color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{formatted}</Text>
    </Tap>
  );
}

/** Returns a copy of `base` with the calendar day taken from `day`. */
export function withDay(base: Date, day: Date): Date {
  const d = new Date(base);
  d.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  return d;
}

/** Returns a copy of `base` with the clock time taken from `time`. */
export function withTime(base: Date, time: Date): Date {
  const d = new Date(base);
  d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d;
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 6 : 12,
    minHeight: 48,
  },
  label: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textMuted },
  value: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
});
