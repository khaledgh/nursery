import { StyleSheet, Text, View } from "react-native";
import { accents, colors, fonts, radius, spacing, REPORT_RATING } from "../theme";
import { IconCircle } from "./IconCircle";

interface RatingRowProps {
  icon: string;
  title: string;
  description?: string;
  rating: string; // thriving | doing_well | improving | needs_support
  note?: string;
}

/** Daily-report dimension row: icon, label, note chip and emoji rating. */
export function RatingRow({ icon, title, description, rating, note }: RatingRowProps) {
  const visual = REPORT_RATING[rating] ?? REPORT_RATING.doing_well;
  const a = accents[visual.accent];
  return (
    <View style={styles.row}>
      <IconCircle name={icon} accent={visual.accent} size={40} squircle />
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {note ? (
          <View style={[styles.noteChip, { backgroundColor: a.tint }]}>
            <Text style={[styles.noteText, { color: a.dark }]}>{note}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.emoji}>{visual.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingVertical: spacing.sm },
  texts: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  description: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  noteChip: {
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  noteText: { fontSize: 11, fontFamily: fonts.bold },
  emoji: { fontSize: 26 },
});
