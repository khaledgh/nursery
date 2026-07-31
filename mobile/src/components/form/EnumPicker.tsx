import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { accents, colors, fonts, radius, spacing, type EnumVisual } from "../../theme";
import { FieldError } from "../FieldError";

interface EnumPickerProps {
  label?: string;
  /** Option keys, e.g. Object.keys(MEAL_STATUS). Order is preserved. */
  options: string[];
  /** One of the enum→visual maps in theme.ts (MEAL_STATUS, WETNESS, ...). */
  visuals: Record<string, EnumVisual>;
  /** i18n prefix for labels, e.g. "enums.mealStatus" — these already exist. */
  i18nPrefix: string;
  value?: string;
  onChange: (value: string) => void;
  /** "emoji" gives oversized targets for the batch sweep. */
  variant?: "chips" | "emoji";
  error?: string;
}

/**
 * Single-select over a backend enum. Every visual (icon, emoji, accent colour)
 * comes from theme.ts and every label from the existing `enums.*` bundles, so
 * adding a picker needs no new assets and no new translation keys.
 */
export function EnumPicker({
  label,
  options,
  visuals,
  i18nPrefix,
  value,
  onChange,
  variant = "chips",
  error,
}: EnumPickerProps) {
  const { t } = useTranslation();
  const emoji = variant === "emoji";

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        {options.map((key) => {
          const visual = visuals[key];
          const accent = accents[visual?.accent as keyof typeof accents] ?? accents.primary;
          const selected = value === key;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                emoji ? styles.emojiOption : styles.chip,
                { borderColor: selected ? accent.main : colors.border },
                selected && { backgroundColor: accent.tint },
              ]}
            >
              {emoji && visual?.emoji ? (
                <Text style={styles.emojiGlyph}>{visual.emoji}</Text>
              ) : (
                <Ionicons
                  name={(visual?.icon ?? "ellipse") as keyof typeof Ionicons.glyphMap}
                  size={emoji ? 22 : 15}
                  color={selected ? accent.dark : colors.textMuted}
                />
              )}
              <Text
                numberOfLines={1}
                style={[styles.optionLabel, emoji && styles.emojiLabel, selected && { color: accent.dark }]}
              >
                {t(`${i18nPrefix}.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    // 44pt minimum target: this is tapped hundreds of times a day.
    minHeight: 44,
  },
  emojiOption: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    minWidth: 64,
    minHeight: 56,
  },
  emojiGlyph: { fontSize: 22 },
  optionLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  emojiLabel: { fontSize: 10, fontFamily: fonts.semibold, color: colors.textMuted },
});
