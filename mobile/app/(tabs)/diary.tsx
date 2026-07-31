import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useDiary } from "../../src/api/hooks";
import type { DiaryEntry } from "../../src/api/types";
import { ChildSwitcher } from "../../src/components/ChildSwitcher";
import { EmptyState } from "../../src/components/EmptyState";
import { FilterChips } from "../../src/components/FilterChips";
import { HeroCard } from "../../src/components/HeroCard";
import { PillBadge } from "../../src/components/PillBadge";
import { PhotoStrip, type StripPhoto } from "../../src/components/PhotoStrip";
import { SectionHeader } from "../../src/components/SectionHeader";
import { TimelineItem } from "../../src/components/Timeline";
import { TipBanner } from "../../src/components/TipBanner";
import { Card, Loading, Screen } from "../../src/components/ui";
import { formatTime, toISODate } from "../../src/lib/stats";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, DIARY_TYPE, fonts, radius, spacing } from "../../src/theme";

type Filter = "all" | "meals" | "sleep" | "activities" | "care";

const FILTER_TYPES: Record<Filter, DiaryEntry["type"][] | null> = {
  all: null,
  meals: ["meal"],
  sleep: ["sleep"],
  activities: ["activity", "photo"],
  care: ["diaper", "note"],
};

export default function DiaryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { child } = useActiveChild();
  const [filter, setFilter] = useState<Filter>("all");

  const today = toISODate(new Date());
  const diary = useDiary(child?.id, { from: today, to: today });

  const entries = diary.data ?? [];
  const liveEntry = entries.find((e) => e.is_live);
  const types = FILTER_TYPES[filter];
  const filtered = types ? entries.filter((e) => types.includes(e.type)) : entries;

  const moments: StripPhoto[] = entries
    .flatMap((e) => (e.media ?? []).filter((m) => m.media?.url).map((m) => ({ url: m.media!.url })))
    .slice(0, 12);

  const teacherNote = entries.find((e) => e.type === "note");

  return (
    <Screen refreshing={diary.isRefetching} onRefresh={() => void diary.refetch()}>
      <ChildSwitcher />

      {child && (
        <HeroCard
          variant="tint"
          photoUrl={child.avatar?.url}
          name={child.first_name}
          title={t("diary.havingGreatDay", { name: child.first_name })}
          subtitle={t("diary.subtitle")}
        >
          {liveEntry && (
            <View style={styles.livePill}>
              <PillBadge label={`${t("diary.live")} · ${liveEntry.title}`} accent="activity" dot />
            </View>
          )}
        </HeroCard>
      )}

      <FilterChips
        chips={[
          { key: "all", label: t("diary.all"), icon: "grid" },
          { key: "meals", label: t("diary.meals"), icon: "restaurant" },
          { key: "sleep", label: t("diary.sleep"), icon: "moon" },
          { key: "activities", label: t("diary.activities"), icon: "color-palette" },
          { key: "care", label: t("diary.care"), icon: "heart" },
        ]}
        active={filter}
        onChange={(k) => setFilter(k as Filter)}
      />

      <SectionHeader
        title={t("diary.timeline")}
        actionLabel={
          entries[0] ? t("diary.latestAt", { time: formatTime(entries[0].occurred_at, i18n.language) }) : undefined
        }
        onAction={entries[0] ? () => {} : undefined}
      />

      {diary.isLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState icon="book" title={t("diary.empty")} />
      ) : (
        <View>
          {filtered.map((entry, i) => {
            const visual = DIARY_TYPE[entry.type] ?? DIARY_TYPE.note;
            const photo = entry.media?.find((m) => m.media?.url)?.media?.url;
            return (
              <TimelineItem
                key={entry.id}
                time={formatTime(entry.occurred_at, i18n.language)}
                timeSub={entry.is_live ? t("diary.live") : undefined}
                icon={visual.icon}
                accent={visual.accent}
                last={i === filtered.length - 1}
              >
                <Card style={styles.entryCard}>
                  <View style={styles.entryTexts}>
                    <View style={styles.entryTitleRow}>
                      <Text style={styles.entryTitle}>{entry.title}</Text>
                      {entry.is_live && <PillBadge label={t("diary.live")} accent="activity" dot />}
                    </View>
                    {entry.body ? <Text style={styles.entryBody}>{entry.body}</Text> : null}
                    {entry.logged_by?.name ? (
                      <Text style={styles.entryBy}>{t("diary.loggedBy", { name: entry.logged_by.name })}</Text>
                    ) : null}
                  </View>
                  {photo && <Image source={{ uri: photo }} style={styles.entryPhoto} contentFit="cover" />}
                </Card>
              </TimelineItem>
            );
          })}
        </View>
      )}

      {moments.length > 0 && (
        <>
          <SectionHeader
            title={`💛 ${t("diary.moments")}`}
            actionLabel={t("common.viewAll")}
            onAction={() => router.push("/child/gallery")}
          />
          <PhotoStrip photos={moments} size={84} />
        </>
      )}

      {teacherNote && teacherNote.body ? (
        <TipBanner icon="heart" accent="primary" title={t("diary.teacherNote")} text={teacherNote.body} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  livePill: { marginTop: 4 },
  entryCard: { flexDirection: "row", gap: spacing.sm, padding: spacing.sm + 4 },
  entryTexts: { flex: 1, gap: 3 },
  entryTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  entryTitle: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  entryBody: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted, lineHeight: 18 },
  entryBy: { fontSize: 11, fontFamily: fonts.bold, color: colors.primary },
  entryPhoto: { width: 72, height: 72, borderRadius: radius.md },
});
