import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTeacherRoster, useUpsertReport } from "../../../src/api/hooks";
import type { Child } from "../../../src/api/types";
import { PrimaryButton } from "../../../src/components/Buttons";
import { ChildAvatar } from "../../../src/components/ChildAvatar";
import { EmptyState } from "../../../src/components/EmptyState";
import { colors, fonts, radius, shadows, spacing } from "../../../src/theme";

const MOOD_PRESETS = [
  { key: "happy", label: "Happy 😊", rating: "great" },
  { key: "calm", label: "Calm 😌", rating: "good" },
  { key: "creative", label: "Creative 🎨", rating: "great" },
  { key: "social", label: "Social 🤝", rating: "great" },
];

const SUMMARY_PRESETS = [
  "Had a wonderful day playing cooperatively with classmates and participating actively.",
  "Enjoyed sensory play, story time, and outdoor activities with great enthusiasm.",
  "Creative day! Built blocks, painted colorful artwork, and had healthy meals.",
];

export default function BatchReportScreen() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const roster = useTeacherRoster();
  const upsertReport = useUpsertReport();

  const children = useMemo(() => roster.data ?? [], [roster.data]);

  // Selected child IDs
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => {
    if (ids) {
      const parsed = ids.split(",").map(Number).filter(Boolean);
      if (parsed.length > 0) return new Set(parsed);
    }
    return new Set();
  });

  const [summary, setSummary] = useState(SUMMARY_PRESETS[0]);
  const [selectedMoods, setSelectedMoods] = useState<Record<string, string>>({
    happy: "great",
    calm: "good",
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Class Daily Report" });
  }, [navigation]);

  // If no initial selection, default to all children once loaded
  useLayoutEffect(() => {
    if (!ids && children.length > 0 && selectedIds.size === 0) {
      setSelectedIds(new Set(children.map((c) => c.id)));
    }
  }, [children, ids, selectedIds.size]);

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

  const toggleMood = (key: string, rating: string) => {
    setSelectedMoods((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = rating;
      return next;
    });
  };

  const save = async () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    setResult(null);

    const targetList = [...selectedIds];
    const today = new Date().toISOString().slice(0, 10);
    const moodsPayload = Object.entries(selectedMoods).map(([key, rating]) => ({ key, rating }));

    let successCount = 0;
    for (const childId of targetList) {
      try {
        await upsertReport.mutateAsync({
          childId,
          date: today,
          summary,
          moods: moodsPayload,
        });
        successCount++;
      } catch {
        // Continue
      }
    }

    setSaving(false);
    setResult(`Published report for ${successCount} children ✓`);
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
            {/* Quick summary presets */}
            <Text style={styles.sectionTitle}>Day Summary</Text>
            <TextInput
              style={styles.textInput}
              multiline
              numberOfLines={3}
              value={summary}
              onChangeText={setSummary}
              placeholder="What did the children do today?"
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.presetsRow}>
              {SUMMARY_PRESETS.map((p, i) => (
                <Pressable
                  key={i}
                  onPress={() => setSummary(p)}
                  style={[styles.presetChip, summary === p && styles.presetChipActive]}
                >
                  <Text style={[styles.presetLabel, summary === p && styles.presetLabelActive]} numberOfLines={1}>
                    Preset {i + 1}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Mood toggles */}
            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Class Moods</Text>
            <View style={styles.moodsRow}>
              {MOOD_PRESETS.map((m) => {
                const active = Boolean(selectedMoods[m.key]);
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => toggleMood(m.key, m.rating)}
                    style={[styles.moodChip, active && styles.moodChipActive]}
                  >
                    <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Target Children */}
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
                <Text style={styles.childName}>{item.first_name} {item.last_name}</Text>
                <Text style={[styles.childStatus, isPresent && { color: colors.success }]}>
                  {isPresent ? "Present ✓" : item.present_status || "Not Checked In"}
                </Text>
              </View>
              <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                {selected && <Text style={styles.checkMark}>✓</Text>}
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
          label={saving ? "Publishing…" : `Publish for ${selectedIds.size} Children`}
          onPress={() => void save()}
          loading={saving}
          disabled={selectedIds.size === 0 || !summary.trim() || saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.sm },
  headerForm: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 13, fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.xs },
  textInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.text,
    minHeight: 70,
    textAlignVertical: "top",
  },
  presetsRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  presetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetLabel: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  presetLabelActive: { color: "#fff" },
  moodsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  moodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  moodLabel: { fontSize: 12, fontFamily: fonts.bold, color: colors.text },
  moodLabelActive: { color: "#fff" },
  childrenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  childRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  childRowSelected: { borderColor: colors.primary, backgroundColor: "#f0fdf4" },
  childName: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  childStatus: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted, textTransform: "capitalize" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  resultText: { textAlign: "center", fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
});
