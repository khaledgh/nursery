import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCheckInOut, useTeacherRoster } from "../../src/api/hooks";
import type { Child } from "../../src/api/types";
import { EmptyState } from "../../src/components/EmptyState";
import { RosterRow } from "../../src/components/teacher/RosterRow";
import { useAuthStore } from "../../src/store/auth";
import { colors, fonts, radius, shadows, spacing } from "../../src/theme";

type FilterKey = "all" | "out" | "in" | "absent";

const FILTERS: { key: FilterKey; labelKey: string }[] = [
  { key: "all", labelKey: "teacher.roster.all" },
  { key: "out", labelKey: "teacher.roster.notCheckedIn" },
  { key: "in", labelKey: "teacher.roster.in" },
  { key: "absent", labelKey: "teacher.roster.absent" },
];

export default function TeacherRoster() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const teacherName = useAuthStore((s) => s.user?.name ?? "");

  const [filter, setFilter] = useState<FilterKey>("all");
  const roster = useTeacherRoster(filter);
  const allRoster = useTeacherRoster("all");
  const checkInOut = useCheckInOut();

  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [pendingId, setPendingId] = useState<number | null>(null);
  const selectionMode = selection.size > 0;

  const children = useMemo(() => roster.data ?? [], [roster.data]);
  const allChildren = useMemo(() => allRoster.data ?? [], [allRoster.data]);

  const counts = useMemo(
    () => ({
      in: allChildren.filter((c) => c.present_status === "checked_in").length,
      out: allChildren.filter((c) => c.present_status === "checked_out").length,
      absent: allChildren.filter((c) => c.present_status === "absent").length,
    }),
    [allChildren],
  );

  const visible = children;

  const toggleAttendance = useCallback(
    (child: Child) => {
      setPendingId(child.id);
      checkInOut.mutate(
        { childId: child.id, action: child.present_status === "checked_in" ? "check_out" : "check_in" },
        { onSettled: () => setPendingId(null) },
      );
    },
    [checkInOut],
  );

  const openChild = useCallback(
    (child: Child) => {
      if (selectionMode) {
        setSelection((prev) => {
          const next = new Set(prev);
          if (!next.delete(child.id)) next.add(child.id);
          return next;
        });
        return;
      }
      router.push(`/teacher/child/${child.id}`);
    },
    [router, selectionMode],
  );

  const startSelection = useCallback((child: Child) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (!next.delete(child.id)) next.add(child.id);
      return next;
    });
  }, []);

  // Sequential rather than parallel: each check-in is independently authorised
  // server-side, and a partial failure must leave the rest applied.
  const bulkCheck = async (action: "check_in" | "check_out" | "absent") => {
    const ids = [...selection];
    for (const id of ids) {
      try {
        await checkInOut.mutateAsync({ childId: id, action });
      } catch {
        // Keep going: one child failing must not abandon the rest.
      }
    }
    setSelection(new Set());
  };

  const markAllPresent = async () => {
    const notIn = allChildren.filter((c) => c.present_status !== "checked_in");
    for (const child of notIn) {
      try {
        await checkInOut.mutateAsync({ childId: child.id, action: "check_in" });
      } catch {}
    }
  };

  const allSelected = visible.length > 0 && visible.every((c) => selection.has(c.id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelection(new Set());
    } else {
      setSelection(new Set(visible.map((c) => c.id)));
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: Child }) => (
      <RosterRow
        child={item}
        busy={pendingId === item.id}
        selectionMode={selectionMode}
        selected={selection.has(item.id)}
        onPress={openChild}
        onLongPress={startSelection}
        onToggleAttendance={toggleAttendance}
      />
    ),
    [openChild, pendingId, selection, selectionMode, startSelection, toggleAttendance],
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("teacher.roster.title")}</Text>
          <Text style={styles.subtitle}>
            {teacherName ? `${teacherName} · ` : ""}
            {t("teacher.roster.subtitle", { count: children.length })}
          </Text>
        </View>
        <Pressable onPress={() => router.push("/notifications")} hitSlop={8} style={styles.bell}>
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.summary}>
        <SummaryPill label={t("teacher.roster.in")} value={counts.in} tone={colors.success} />
        <SummaryPill label={t("teacher.roster.out")} value={counts.out} tone={colors.textMuted} />
        <SummaryPill label={t("teacher.roster.absent")} value={counts.absent} tone={colors.danger} />
      </View>

      {/* Classroom Quick Action Bar */}
      <View style={styles.quickBar}>
        <Pressable style={styles.markAllBtn} onPress={() => void markAllPresent()}>
          <Ionicons name="checkmark-done" size={15} color="#fff" />
          <Text style={styles.markAllBtnText}>Mark all present ({allChildren.length})</Text>
        </Pressable>

        <Pressable style={styles.selectAllBtn} onPress={toggleSelectAll}>
          <Ionicons
            name={allSelected ? "checkbox" : "square-outline"}
            size={16}
            color={colors.primary}
          />
          <Text style={styles.selectAllBtnText}>
            {allSelected ? "Deselect all" : "Select all"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, filter === f.key && styles.chipLabelActive]}>{t(f.labelKey)}</Text>
          </Pressable>
        ))}
      </View>

      {roster.isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(c) => String(c.id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 110 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={roster.isRefetching} onRefresh={() => void roster.refetch()} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title={t("teacher.roster.empty")} />}
        />
      )}

      {selectionMode ? (
        <View style={[styles.bulkBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.bulkTopRow}>
            <Text style={styles.bulkCount}>{t("teacher.roster.selected", { count: selection.size })}</Text>
            <Pressable onPress={() => setSelection(new Set())} hitSlop={8}>
              <Text style={styles.bulkClear}>{t("teacher.roster.clear")}</Text>
            </Pressable>
          </View>

          <View style={styles.bulkActionsRow}>
            <Pressable style={styles.bulkCheckInBtn} onPress={() => void bulkCheck("check_in")}>
              <Text style={styles.bulkBtnText}>Present</Text>
            </Pressable>
            <Pressable style={styles.bulkCheckOutBtn} onPress={() => void bulkCheck("check_out")}>
              <Text style={styles.bulkBtnText}>Out</Text>
            </Pressable>
            <Pressable style={styles.bulkAbsentBtn} onPress={() => void bulkCheck("absent")}>
              <Text style={styles.bulkBtnText}>Absent</Text>
            </Pressable>
            <Pressable
              style={styles.bulkActionPill}
              onPress={() =>
                router.push({
                  pathname: "/teacher/log",
                  params: { ids: Array.from(selection).join(",") },
                })
              }
            >
              <Ionicons name="heart-outline" size={14} color={colors.primary} />
              <Text style={styles.bulkActionPillText}>Care</Text>
            </Pressable>
            <Pressable
              style={styles.bulkActionPill}
              onPress={() =>
                router.push({
                  pathname: "/teacher/batch/report",
                  params: { ids: Array.from(selection).join(",") },
                })
              }
            >
              <Ionicons name="document-text-outline" size={14} color={colors.primary} />
              <Text style={styles.bulkActionPillText}>Report</Text>
            </Pressable>
            <Pressable
              style={styles.bulkActionPill}
              onPress={() =>
                router.push({
                  pathname: "/teacher/batch/milestone",
                  params: { ids: Array.from(selection).join(",") },
                })
              }
            >
              <Ionicons name="trophy-outline" size={14} color="#f59e0b" />
              <Text style={styles.bulkActionPillText}>Milestone</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <View style={[styles.pill, shadows.card]}>
      <Text style={[styles.pillValue, { color: tone }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 24, fontFamily: fonts.extrabold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 2 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  pill: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  pillValue: { fontSize: 20, fontFamily: fonts.extrabold },
  pillLabel: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.md },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.text },
  chipLabelActive: { color: "#fff" },
  quickBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  markAllBtnText: { color: "#fff", fontSize: 12, fontFamily: fonts.bold },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectAllBtnText: { color: colors.text, fontSize: 12, fontFamily: fonts.bold },
  list: { padding: spacing.md, gap: spacing.sm },
  bulkBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    ...shadows.card,
  },
  bulkTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bulkClear: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
  bulkCount: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.text },
  bulkActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bulkCheckInBtn: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  bulkCheckOutBtn: {
    flex: 1,
    backgroundColor: colors.textMuted,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  bulkAbsentBtn: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  bulkBtnText: { color: "#fff", fontSize: 11, fontFamily: fonts.bold },
  bulkActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkActionPillText: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary },
});
