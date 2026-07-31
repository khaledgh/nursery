import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Child } from "../../api/types";
import { accents, colors, fonts, radius, shadows, spacing } from "../../theme";
import { ChildAvatar } from "../ChildAvatar";

/** Which of today's routine logs already exist for this child. */
export interface DayFlags {
  meal: boolean;
  sleep: boolean;
  diaper: boolean;
  report: boolean;
}

const DOTS: { key: keyof DayFlags; accent: keyof typeof accents }[] = [
  { key: "meal", accent: "meals" },
  { key: "sleep", accent: "sleep" },
  { key: "diaper", accent: "diaper" },
  { key: "report", accent: "primary" },
];

const ringFor = (status: Child["present_status"]) =>
  status === "checked_in" ? colors.success : status === "absent" ? colors.danger : colors.border;

interface RosterRowProps {
  child: Child;
  flags?: DayFlags;
  busy?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onPress: (child: Child) => void;
  onLongPress: (child: Child) => void;
  onToggleAttendance: (child: Child) => void;
}

/**
 * One child in the class roster.
 *
 * The four status dots are the point of the row: a teacher scans a single
 * column to see who still needs a meal or a nap logged, instead of opening
 * each child in turn to find out.
 */
function RosterRowInner({
  child,
  flags,
  busy,
  selectionMode,
  selected,
  onPress,
  onLongPress,
  onToggleAttendance,
}: RosterRowProps) {
  const checkedIn = child.present_status === "checked_in";
  const name = `${child.first_name} ${child.last_name}`.trim();

  return (
    <Pressable
      onPress={() => onPress(child)}
      onLongPress={() => onLongPress(child)}
      delayLongPress={250}
      style={({ pressed }) => [styles.row, shadows.card, selected && styles.rowSelected, pressed && styles.pressed]}
    >
      {selectionMode ? (
        <Ionicons
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          size={24}
          color={selected ? colors.primary : colors.border}
        />
      ) : null}

      <ChildAvatar url={child.avatar?.url} name={child.first_name} size={44} ringColor={ringFor(child.present_status)} />

      <View style={styles.center}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {flags ? (
          <View style={styles.dots}>
            {DOTS.map(({ key, accent }) => (
              <View
                key={key}
                style={[
                  styles.dot,
                  flags[key] ? { backgroundColor: accents[accent].main } : styles.dotEmpty,
                ]}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.sub} numberOfLines={1}>
            {child.classroom?.name ?? ""}
          </Text>
        )}
      </View>

      {selectionMode ? null : (
        <Pressable
          onPress={() => onToggleAttendance(child)}
          disabled={busy}
          hitSlop={6}
          style={[styles.action, checkedIn ? styles.actionOut : styles.actionIn, busy && styles.actionBusy]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={checkedIn ? colors.textMuted : "#fff"} />
          ) : (
            <Ionicons
              name={checkedIn ? "exit-outline" : "enter-outline"}
              size={18}
              color={checkedIn ? colors.textMuted : "#fff"}
            />
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

export const RosterRow = memo(RosterRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  pressed: { opacity: 0.85 },
  center: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  sub: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotEmpty: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.border },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIn: { backgroundColor: colors.primary },
  actionOut: { backgroundColor: colors.primaryLight },
  actionBusy: { opacity: 0.6 },
});
