import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAchievementTemplates,
  useAssessMilestone,
  useAwardAchievement,
  useMilestoneCategories,
  useTeacherRoster,
} from "../../../src/api/hooks";
import type { Child } from "../../../src/api/types";
import { PrimaryButton } from "../../../src/components/Buttons";
import { ChildAvatar } from "../../../src/components/ChildAvatar";
import { EmptyState } from "../../../src/components/EmptyState";
import { colors, fonts, radius, shadows, spacing } from "../../../src/theme";

type Mode = "badge" | "skill";

export default function BatchMilestoneScreen() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const roster = useTeacherRoster("all");
  const templatesQuery = useAchievementTemplates();
  const categoriesQuery = useMilestoneCategories();
  const awardAchievement = useAwardAchievement();
  const assessMilestone = useAssessMilestone();

  const children = useMemo(() => roster.data ?? [], [roster.data]);

  // Selected child IDs
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    if (ids) {
      const parsed = ids.split(",").map(Number).filter(Boolean);
      if (parsed.length > 0) return new Set(parsed);
    }
    return new Set();
  });

  // Action mode: badge or skill
  const [mode, setMode] = useState<Mode>("badge");

  // Badge Form State
  const [selectedBadgeId, setSelectedBadgeId] = useState<number | null>(null);
  const [badgeNote, setBadgeNote] = useState("");

  // Skill Form State
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [progressPct, setProgressPct] = useState(100);
  const [status, setStatus] = useState<"in_progress" | "achieved">("achieved");
  const [skillNote, setSkillNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Milestones & Badges" });
  }, [navigation]);

  // Default selection to all children if no ids passed and data ready
  useLayoutEffect(() => {
    if (!ids && children.length > 0 && selectedIds.size === 0) {
      setSelectedIds(new Set(children.map((c) => c.id)));
    }
  }, [children, ids, selectedIds.size]);

  // Set default templates and categories once loaded
  useLayoutEffect(() => {
    if (templatesQuery.data && templatesQuery.data.length > 0 && selectedBadgeId === null) {
      setSelectedBadgeId(templatesQuery.data[0].id);
    }
  }, [templatesQuery.data, selectedBadgeId]);

  useLayoutEffect(() => {
    if (categoriesQuery.data && categoriesQuery.data.length > 0 && selectedCatId === null) {
      setSelectedCatId(categoriesQuery.data[0].id);
    }
  }, [categoriesQuery.data, selectedCatId]);

  const toggleChild = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => setSelectedIds(new Set(children.map((c) => c.id)));
  const selectPresentOnly = () =>
    setSelectedIds(new Set(children.filter((c) => c.present_status === "checked_in").map((c) => c.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const presentCount = useMemo(
    () => children.filter((c) => c.present_status === "checked_in").length,
    [children],
  );

  const save = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    setResult(null);

    const targetList = [...selectedIds];
    let successCount = 0;

    for (const childId of targetList) {
      try {
        if (mode === "badge" && selectedBadgeId) {
          await awardAchievement.mutateAsync({
            childId,
            achievement_template_id: selectedBadgeId,
            note: badgeNote || undefined,
            awarded_date: new Date().toISOString().split("T")[0],
          });
        } else if (mode === "skill" && selectedCatId) {
          await assessMilestone.mutateAsync({
            childId,
            category_id: selectedCatId,
            progress_pct: progressPct,
            status,
            description: skillNote || undefined,
          });
        }
        successCount++;
      } catch {
        // Continue
      }
    }

    setSaving(false);
    setResult(
      mode === "badge"
        ? `🏆 Awarded badge to ${successCount} children! ✓`
        : `📊 Applied milestone to ${successCount} children! ✓`,
    );

    setTimeout(() => {
      router.back();
    }, 1500);
  };

  if (roster.isLoading) {
    return <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />;
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={children}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={[styles.content, { paddingBottom: 130 + insets.bottom }]}
        ListHeaderComponent={
          <View style={styles.headerForm}>
            {/* Mode Switcher */}
            <View style={styles.modeTabs}>
              <Pressable
                onPress={() => setMode("badge")}
                style={[styles.modeTab, mode === "badge" && styles.modeTabActive]}
              >
                <Ionicons
                  name="trophy"
                  size={16}
                  color={mode === "badge" ? "#f59e0b" : colors.textMuted}
                />
                <Text style={[styles.modeTabLabel, mode === "badge" && styles.modeTabLabelActive]}>
                  Award Badges 🏆
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMode("skill")}
                style={[styles.modeTab, mode === "skill" && styles.modeTabActive]}
              >
                <Ionicons
                  name="bar-chart"
                  size={16}
                  color={mode === "skill" ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.modeTabLabel, mode === "skill" && styles.modeTabLabelActive]}>
                  Skill Milestone 📊
                </Text>
              </Pressable>
            </View>

            {/* Mode A: Award Badges */}
            {mode === "badge" && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Choose Badge Template</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeScroll}>
                  {(templatesQuery.data ?? []).map((tp) => {
                    const active = selectedBadgeId === tp.id;
                    return (
                      <Pressable
                        key={tp.id}
                        onPress={() => setSelectedBadgeId(tp.id)}
                        style={[styles.badgeCard, active && styles.badgeCardActive]}
                      >
                        <View style={[styles.badgeIconBubble, { backgroundColor: tp.color || "#f59e0b" }]}>
                          <Text style={{ fontSize: 18 }}>🏆</Text>
                        </View>
                        <Text style={styles.badgeTitle} numberOfLines={1}>
                          {tp.title}
                        </Text>
                        {tp.description ? (
                          <Text style={styles.badgeDesc} numberOfLines={2}>
                            {tp.description}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Note / Observation (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={badgeNote}
                  onChangeText={setBadgeNote}
                  placeholder="e.g. Demonstrated outstanding helper spirit today"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}

            {/* Mode B: Skill Assessment */}
            {mode === "skill" && (
              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>Select Skill Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                  {(categoriesQuery.data ?? []).map((cat) => {
                    const active = selectedCatId === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setSelectedCatId(cat.id)}
                        style={[styles.catChip, active && styles.catChipActive]}
                      >
                        <View style={[styles.catDot, { backgroundColor: cat.color || colors.primary }]} />
                        <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Progress Level</Text>
                <View style={styles.progressRow}>
                  {[25, 50, 75, 100].map((pct) => (
                    <Pressable
                      key={pct}
                      onPress={() => setProgressPct(pct)}
                      style={[styles.pctChip, progressPct === pct && styles.pctChipActive]}
                    >
                      <Text style={[styles.pctLabel, progressPct === pct && styles.pctLabelActive]}>
                        {pct}%
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Status</Text>
                <View style={styles.statusRow}>
                  <Pressable
                    onPress={() => setStatus("in_progress")}
                    style={[styles.statusChip, status === "in_progress" && styles.statusChipActive]}
                  >
                    <Text style={[styles.statusLabel, status === "in_progress" && styles.statusLabelActive]}>
                      In Progress ⏳
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setStatus("achieved")}
                    style={[styles.statusChip, status === "achieved" && styles.statusChipActive]}
                  >
                    <Text style={[styles.statusLabel, status === "achieved" && styles.statusLabelActive]}>
                      Achieved ⭐
                    </Text>
                  </Pressable>
                </View>

                <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Note for Parents (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={skillNote}
                  onChangeText={setSkillNote}
                  placeholder="e.g. Mastered counting up to 20 with confidence"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}

            {/* Target Children Selector Bar */}
            <View style={styles.childrenHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Target Students ({selectedIds.size} / {children.length})
                </Text>
              </View>

              <View style={styles.selectionActions}>
                <Pressable onPress={selectAll} hitSlop={6}>
                  <Text style={styles.actionLink}>All</Text>
                </Pressable>
                <Text style={styles.actionDivider}>·</Text>
                <Pressable onPress={selectPresentOnly} hitSlop={6}>
                  <Text style={[styles.actionLink, { color: colors.success }]}>
                    Present ({presentCount})
                  </Text>
                </Pressable>
                <Text style={styles.actionDivider}>·</Text>
                <Pressable onPress={clearSelection} hitSlop={6}>
                  <Text style={[styles.actionLink, { color: colors.textMuted }]}>Clear</Text>
                </Pressable>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.id);
          const isPresent = item.present_status === "checked_in";
          return (
            <Pressable
              onPress={() => toggleChild(item.id)}
              style={[styles.childRow, shadows.card, selected && styles.childRowSelected]}
            >
              <View style={styles.avatarWrapper}>
                <ChildAvatar url={item.avatar?.url} name={item.first_name} size={36} />
                <View
                  style={[
                    styles.presenceDot,
                    {
                      backgroundColor: isPresent
                        ? colors.success
                        : item.present_status === "absent"
                        ? colors.danger
                        : colors.textMuted,
                    },
                  ]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>
                  {item.first_name} {item.last_name}
                </Text>
                <Text style={[styles.childStatus, isPresent && { color: colors.success }]}>
                  {isPresent ? "Present ✓" : item.present_status === "absent" ? "Absent" : "Checked Out"}
                </Text>
              </View>
              <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No children in classroom" />}
      />

      {/* Floating Save Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        {result && <Text style={styles.resultText}>{result}</Text>}
        <PrimaryButton
          label={
            saving
              ? "Saving…"
              : mode === "badge"
              ? `Award 🏆 for ${selectedIds.size} Children`
              : `Apply Assessment for ${selectedIds.size} Children`
          }
          onPress={() => void save()}
          loading={saving}
          disabled={selectedIds.size === 0 || saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.sm },
  headerForm: { gap: spacing.sm, paddingBottom: spacing.sm },
  modeTabs: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  modeTabActive: {
    backgroundColor: colors.bg,
    ...shadows.card,
  },
  modeTabLabel: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.textMuted,
  },
  modeTabLabelActive: {
    color: colors.text,
  },
  sectionBlock: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.extrabold,
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  badgeScroll: { gap: spacing.sm, paddingVertical: spacing.xs },
  badgeCard: {
    width: 120,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  badgeCardActive: {
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    borderWidth: 2,
  },
  badgeIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  badgeTitle: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: "center",
  },
  badgeDesc: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  categoryScroll: { gap: spacing.xs, paddingVertical: spacing.xs },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: {
    borderColor: colors.primary,
    backgroundColor: "#eff6ff",
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.textMuted },
  catLabelActive: { color: colors.primary },
  progressRow: { flexDirection: "row", gap: spacing.sm },
  pctChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pctChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  pctLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
  pctLabelActive: { color: "#fff" },
  statusRow: { flexDirection: "row", gap: spacing.sm },
  statusChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipActive: {
    borderColor: colors.primary,
    backgroundColor: "#eff6ff",
  },
  statusLabel: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
  statusLabelActive: { color: colors.primary },
  textInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  childrenHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actionLink: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  actionDivider: {
    color: colors.border,
    fontSize: 12,
  },
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  childRowSelected: {
    borderColor: colors.primary,
    backgroundColor: "#f8fafc",
  },
  avatarWrapper: {
    position: "relative",
  },
  presenceDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  childName: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  childStatus: { fontSize: 12, fontFamily: fonts.regular, color: colors.textMuted, marginTop: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  resultText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.success,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
});
