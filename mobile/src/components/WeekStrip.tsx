import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "../theme";

export interface WeekStripDay {
  label: string; // "Mon"
  sub?: string; // "May 16"
  content: ReactNode; // ring / emoji / count — or null for "–"
  highlight?: boolean; // today
}

interface WeekStripProps {
  days: WeekStripDay[];
  legend?: { color: string; label: string; sub?: string }[];
}

/** 7-column history strip with an optional color legend. */
export function WeekStrip({ days, legend }: WeekStripProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {days.map((day, i) => (
          <View key={i} style={[styles.day, day.highlight && styles.dayHighlight]}>
            <Text style={styles.dayLabel}>{day.label}</Text>
            {day.sub ? <Text style={styles.daySub}>{day.sub}</Text> : null}
            <View style={styles.content}>{day.content ?? <Text style={styles.dash}>–</Text>}</View>
          </View>
        ))}
      </View>
      {legend && legend.length > 0 && (
        <View style={styles.legend}>
          {legend.map((item, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <View>
                <Text style={styles.legendLabel}>{item.label}</Text>
                {item.sub ? <Text style={styles.legendSub}>{item.sub}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: { flexDirection: "row" },
  day: { flex: 1, alignItems: "center", gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md },
  dayHighlight: { backgroundColor: colors.primaryLight },
  dayLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.text },
  daySub: { fontSize: 10, fontFamily: fonts.semibold, color: colors.textMuted },
  content: { minHeight: 34, alignItems: "center", justifyContent: "center" },
  dash: { color: colors.textMuted, fontSize: 16 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.text },
  legendSub: { fontSize: 10, fontFamily: fonts.semibold, color: colors.textMuted },
});
