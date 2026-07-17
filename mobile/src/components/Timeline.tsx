import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, spacing, type Accent, type AccentName } from "../theme";
import { IconCircle } from "./IconCircle";

interface TimelineItemProps extends PropsWithChildren {
  time: string;
  timeSub?: string; // e.g. "Now"
  icon: string;
  accent: AccentName | Accent;
  last?: boolean;
}

/** One row of a vertical timeline: time column, icon dot + connecting line, content card. */
export function TimelineItem({ time, timeSub, icon, accent, last, children }: TimelineItemProps) {
  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={styles.time}>{time}</Text>
        {timeSub ? <Text style={styles.timeSub}>{timeSub}</Text> : null}
      </View>
      <View style={styles.lineCol}>
        <IconCircle name={icon} accent={accent} size={32} />
        {!last && <View style={styles.line} />}
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  timeCol: { width: 60, alignItems: "flex-end", paddingTop: 6 },
  time: { fontSize: 12, fontFamily: fonts.bold, color: colors.text },
  timeSub: { fontSize: 10, fontFamily: fonts.bold, color: colors.success },
  lineCol: { alignItems: "center" },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  content: { flex: 1, paddingBottom: spacing.md },
});
