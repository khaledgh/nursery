import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, shadows, spacing, type Accent, type AccentName } from "../theme";
import { IconCircle } from "./IconCircle";

interface StatTileProps {
  icon: string;
  accent: AccentName | Accent;
  value: string;
  label: string;
  sub?: string;
  onPress?: () => void;
}

/** Small stat card used in summary grids (meals / sleep / diapers / temp…). */
export function StatTile({ icon, accent, value, label, sub, onPress }: StatTileProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.tile, shadows.card, pressed && { opacity: 0.85 }]}
    >
      <IconCircle name={icon} accent={accent} size={36} />
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    alignItems: "center",
    gap: 3,
  },
  value: { fontSize: 15, fontFamily: "Nunito_800ExtraBold", color: colors.text },
  label: { fontSize: 11, fontFamily: "Nunito_600SemiBold", color: colors.textMuted },
  sub: { fontSize: 10, fontFamily: "Nunito_600SemiBold", color: colors.textMuted },
});
