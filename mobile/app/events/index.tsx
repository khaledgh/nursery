import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEvents, useRsvp } from "../../src/api/hooks";
import type { EventItem } from "../../src/api/types";
import { EmptyState } from "../../src/components/EmptyState";
import { IconCircle } from "../../src/components/IconCircle";
import { SegmentTabs } from "../../src/components/SegmentTabs";
import { Card, Loading, Screen } from "../../src/components/ui";
import { formatTime } from "../../src/lib/stats";
import { useActiveChild } from "../../src/store/activeChild";
import { useAuthStore } from "../../src/store/auth";
import { accents, colors, fonts, radius, spacing, type AccentName } from "../../src/theme";

type Tab = "upcoming" | "previous";

const RSVP_OPTIONS: { key: "yes" | "maybe" | "no"; accent: AccentName; icon: string; labelKey: string }[] = [
  { key: "yes", accent: "primary", icon: "heart", labelKey: "events.yes" },
  { key: "maybe", accent: "meals", icon: "help-circle", labelKey: "events.maybe" },
  { key: "no", accent: "health", icon: "close-circle", labelKey: "events.no" },
];

export default function EventsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("upcoming");
  const user = useAuthStore((s) => s.user);
  const { child } = useActiveChild();

  const events = useEvents(tab);
  const rsvp = useRsvp();

  const myResponse = (event: EventItem) => event.rsvps?.find((r) => r.user_id === user?.id)?.response;

  const renderUpcoming = (event: EventItem) => {
    const starts = new Date(event.starts_at);
    const mine = myResponse(event);
    return (
      <Card key={event.id} style={styles.eventCard}>
        <Pressable onPress={() => router.push(`/events/${event.id}` as never)} style={styles.eventTop}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateMonth}>{starts.toLocaleDateString(i18n.language, { month: "short" })}</Text>
            <Text style={styles.dateDay}>{starts.getDate()}</Text>
            <Text style={styles.dateWeekday}>{starts.toLocaleDateString(i18n.language, { weekday: "short" })}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={styles.metaRow}>
              <IconCircle name="time" accent="hydration" size={22} />
              <Text style={styles.metaText}>
                {formatTime(event.starts_at, i18n.language)}
                {event.ends_at ? ` – ${formatTime(event.ends_at, i18n.language)}` : ""}
              </Text>
            </View>
            {event.location ? (
              <View style={styles.metaRow}>
                <IconCircle name="location" accent="events" size={22} />
                <Text style={styles.metaText}>{event.location}</Text>
              </View>
            ) : null}
          </View>
          {event.cover_media?.url && (
            <Image source={{ uri: event.cover_media.url }} style={styles.cover} contentFit="cover" />
          )}
        </Pressable>
        {event.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}

        {/* RSVP */}
        <View style={styles.rsvpBox}>
          <Text style={styles.rsvpTitle}>{t("events.willYouJoin")}</Text>
          <Text style={styles.rsvpSub}>{t("events.willYouJoinSub")}</Text>
          <View style={styles.rsvpRow}>
            {RSVP_OPTIONS.map((o) => {
              const active = mine === o.key;
              const a = accents[o.accent];
              return (
                <Pressable
                  key={o.key}
                  disabled={rsvp.isPending}
                  onPress={() => rsvp.mutate({ eventId: event.id, response: o.key, childId: child?.id })}
                  style={[
                    styles.rsvpBtn,
                    {
                      borderColor: active ? a.main : colors.border,
                      backgroundColor: active ? a.main : colors.card,
                    },
                  ]}
                >
                  <Text style={[styles.rsvpLabel, { color: active ? "#fff" : a.dark }]}>{t(o.labelKey)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>
    );
  };

  const renderPrevious = (event: EventItem) => (
    <Pressable key={event.id} onPress={() => router.push(`/events/${event.id}` as never)}>
      <Card style={styles.prevCard}>
        {event.cover_media?.url ? (
          <Image source={{ uri: event.cover_media.url }} style={styles.prevCover} contentFit="cover" />
        ) : (
          <IconCircle name="calendar" accent="events" size={56} squircle />
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          <Text style={styles.metaText}>
            {new Date(event.starts_at).toLocaleDateString(i18n.language, { month: "short", day: "numeric", year: "numeric" })}
            {" · "}
            {formatTime(event.starts_at, i18n.language)}
          </Text>
          {event.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {event.description}
            </Text>
          ) : null}
        </View>
        <IconCircle name="chevron-forward" accent="neutral" size={28} />
      </Card>
    </Pressable>
  );

  return (
    <Screen refreshing={events.isRefetching} onRefresh={() => void events.refetch()}>
      <SegmentTabs
        tabs={[
          { key: "upcoming", label: t("events.upcoming") },
          { key: "previous", label: t("events.previous") },
        ]}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
      />

      {events.isLoading ? (
        <Loading />
      ) : (events.data ?? []).length === 0 ? (
        <EmptyState icon="calendar" title={tab === "upcoming" ? t("events.empty") : t("events.emptyPrevious")} />
      ) : (
        (events.data ?? []).map((e) => (tab === "upcoming" ? renderUpcoming(e) : renderPrevious(e)))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eventCard: { gap: spacing.md },
  eventTop: { flexDirection: "row", gap: spacing.md },
  dateBlock: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  dateMonth: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.primary, textTransform: "uppercase" },
  dateDay: { fontSize: 22, fontFamily: fonts.extrabold, color: colors.primaryDark },
  dateWeekday: { fontSize: 10, fontFamily: fonts.bold, color: colors.textMuted, textTransform: "uppercase" },
  eventTitle: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  cover: { width: 84, height: 84, borderRadius: radius.md },
  description: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted, lineHeight: 18 },
  rsvpBox: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  rsvpTitle: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  rsvpSub: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  rsvpRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  rsvpBtn: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 10,
  },
  rsvpLabel: { fontSize: 12, fontFamily: fonts.bold },
  prevCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  prevCover: { width: 56, height: 56, borderRadius: radius.md },
});
