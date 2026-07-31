import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { accents, colors, fonts, radius, spacing, type AccentName } from "../../theme";

interface StepperProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  accent?: AccentName;
}

/**
 * Integer entry with large +/- targets. Deliberately not a text input: typing
 * a number one-handed while supervising a room is the worst possible
 * interaction, and every value here is a small count.
 */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  suffix,
  accent = "primary",
}: StepperProps) {
  const tone = accents[accent];
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(clamp(value - step))}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel="decrement"
          style={[styles.btn, { borderColor: tone.main }, value <= min && styles.btnOff]}
        >
          <Ionicons name="remove" size={22} color={value <= min ? colors.textMuted : tone.dark} />
        </Pressable>

        <View style={styles.valueWrap}>
          <Text style={[styles.value, { color: tone.dark }]}>{value}</Text>
          {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        </View>

        <Pressable
          onPress={() => onChange(clamp(value + step))}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel="increment"
          style={[styles.btn, { borderColor: tone.main }, value >= max && styles.btnOff]}
        >
          <Ionicons name="add" size={22} color={value >= max ? colors.textMuted : tone.dark} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  btnOff: { borderColor: colors.border, opacity: 0.6 },
  valueWrap: { flex: 1, alignItems: "center" },
  value: { fontSize: 26, fontFamily: fonts.extrabold },
  suffix: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
});
