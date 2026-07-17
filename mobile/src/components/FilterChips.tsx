import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, fonts, radius, spacing } from "../theme";

interface FilterChipsProps {
  chips: { key: string; label: string; icon?: string }[];
  active: string;
  onChange: (key: string) => void;
}

/** Horizontal scrolling filter row (All / Meals / Sleep / Activities / Care). */
export function FilterChips({ chips, active, onChange }: FilterChipsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips.map((chip) => {
        const isActive = chip.key === active;
        return (
          <Pressable
            key={chip.key}
            onPress={() => onChange(chip.key)}
            style={[styles.chip, isActive && styles.chipActive]}
          >
            {chip.icon && (
              <Ionicons
                name={chip.icon as keyof typeof Ionicons.glyphMap}
                size={14}
                color={isActive ? "#fff" : colors.primary}
              />
            )}
            <Text style={[styles.label, isActive && styles.labelActive]}>{chip.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  labelActive: { color: "#fff" },
});
