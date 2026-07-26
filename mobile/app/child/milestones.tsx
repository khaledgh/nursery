import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAchievements, useMilestones } from "../../src/api/hooks";
import type { ChildMilestone } from "../../src/api/types";
import { EmptyState } from "../../src/components/EmptyState";
import { HeroCard } from "../../src/components/HeroCard";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { SectionHeader } from "../../src/components/SectionHeader";
import { SegmentTabs } from "../../src/components/SegmentTabs";
import { TipBanner } from "../../src/components/TipBanner";
import { Card, Loading, Screen } from "../../src/components/ui";
import { childAgeLabel, formatDate } from "../../src/lib/stats";
import { useRefreshAll } from "../../src/lib/useRefreshAll";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, fonts, radius, safeIcon, spacing } from "../../src/theme";

type Tab = "current" | "achievements" | "all";

function SkillCard({ milestone, locale }: { milestone: ChildMilestone; locale: string }) {
  const color = milestone.category?.color || colors.primary;
  return (
    <View style={styles.skillCard}>
      <View style={styles.skillTop}>
        <IconCircle
          name={safeIcon(milestone.category?.icon, "ribbon")}
          accent={{ main: color, tint: `${color}22`, dark: color }}
          size={48}
        />
        {milestone.status === "achieved" && <Text style={styles.skillStar}>⭐</Text>}
      </View>
      <Text style={styles.skillName}>{milestone.category?.name}</Text>
      {milestone.category?.description ? (
        <Text style={styles.skillDesc} numberOfLines={2}>
          {milestone.category.description}
        </Text>
      ) : null}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${milestone.progress_pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.progressPct}>{milestone.progress_pct}%</Text>
      </View>
      {milestone.assessed_at ? (
        <Text style={styles.assessed}>{formatDate(milestone.assessed_at, locale)}</Text>
      ) : null}
    </View>
  );
}

export default function MilestonesScreen() {
  const { t, i18n } = useTranslation();
  const { child } = useActiveChild();
  const [tab, setTab] = useState<Tab>("current");

  const milestones = useMilestones(child?.id);
  const achievements = useAchievements(child?.id);
  const { refreshing, onRefresh } = useRefreshAll(milestones, achievements);

  const all = milestones.data ?? [];
  const current = all.filter((m) => m.status === "in_progress");
  const shown = tab === "all" ? all : current;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {child && (
        <HeroCard
          variant="tint"
          photoUrl={child.avatar?.url}
          name={child.first_name}
          title={child.first_name}
          subtitle={childAgeLabel(child.dob)}
        >
          <Text style={styles.quote}>“{t("milestones.quote")}”</Text>
        </HeroCard>
      )}

      <SegmentTabs
        tabs={[
          { key: "current", label: t("milestones.current") },
          { key: "achievements", label: t("milestones.recent") },
          { key: "all", label: t("milestones.all") },
        ]}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
      />

      {tab !== "achievements" && (
        <>
          {child && (
            <SectionHeader title={t("milestones.growing", { name: child.first_name })} />
          )}
          <Text style={styles.growingSub}>{t("milestones.growingSub")}</Text>
          {milestones.isLoading ? (
            <Loading />
          ) : shown.length === 0 ? (
            <EmptyState icon="ribbon" title={t("milestones.empty")} />
          ) : (
            <View style={styles.skillGrid}>
              {shown.map((m) => (
                <SkillCard key={m.id} milestone={m} locale={i18n.language} />
              ))}
            </View>
          )}

          {child && shown.length > 0 && (
            <TipBanner
              icon="trophy"
              accent="activity"
              title={t("milestones.keepItUp", { name: child.first_name })}
              text={t("milestones.keepItUpSub")}
            />
          )}
        </>
      )}

      {tab !== "all" && (achievements.data ?? []).length > 0 && (
        <>
          <SectionHeader title={t("milestones.recent")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
            {(achievements.data ?? []).map((a) => {
              const color = a.template?.color || colors.primary;
              return (
                <Card key={a.id} style={styles.badgeCard}>
                  <IconCircle
                    name={safeIcon(a.template?.icon, "medal")}
                    accent={{ main: color, tint: `${color}22`, dark: color }}
                    size={52}
                  />
                  <PillBadge label={formatDate(a.awarded_date, i18n.language)} accent="neutral" />
                  <Text style={styles.badgeTitle}>{a.template?.title}</Text>
                  {(a.note || a.template?.description) ? (
                    <Text style={styles.badgeDesc} numberOfLines={2}>
                      {a.note || a.template?.description}
                    </Text>
                  ) : null}
                </Card>
              );
            })}
          </ScrollView>
        </>
      )}

      <TipBanner icon="heart" title={t("milestones.teacherNote")} text={t("milestones.quote")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  quote: { fontSize: 13, fontFamily: fonts.bold, color: colors.primaryDark, marginTop: 4 },
  growingSub: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted, marginTop: -spacing.sm },
  skillGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  skillCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  skillTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  skillStar: { fontSize: 16 },
  skillName: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  skillDesc: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressPct: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.text },
  assessed: { fontSize: 10, fontFamily: fonts.semibold, color: colors.textMuted },
  badgeRow: { gap: spacing.sm },
  badgeCard: { width: 150, alignItems: "center", gap: 6 },
  badgeTitle: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.text, textAlign: "center" },
  badgeDesc: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted, textAlign: "center" },
});
