import { useRouter, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMarkAllRead, useMarkRead, useNotifications } from "../src/api/hooks";
import type { NotificationItem } from "../src/api/types";
import { EmptyState } from "../src/components/EmptyState";
import { FilterChips } from "../src/components/FilterChips";
import { IconCircle } from "../src/components/IconCircle";
import { Card, Loading, Screen, UnreadDot } from "../src/components/ui";
import { formatDate, formatTime, isSameDay, addDays } from "../src/lib/stats";
import { colors, fonts, NOTIFICATION_CATEGORY, spacing } from "../src/theme";

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const [category, setCategory] = useState("all");

  const notifications = useNotifications(category === "all" ? undefined : category);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  // "Mark all as read" lives in the navigation header.
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => markAllRead.mutate()} hitSlop={8}>
          <Text style={styles.markAll}>{t("notifications.markAllRead")}</Text>
        </Pressable>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, t]);

  const open = (item: NotificationItem) => {
    if (!item.read_at) markRead.mutate(item.id);
    const data = item.data ?? {};
    const screen = typeof data.screen === "string" ? data.screen : "";
    if (screen === "announcements" && data.announcement_id) {
      router.push(`/message/${data.announcement_id}` as never);
    } else if (screen === "events" && data.event_id) {
      router.push(`/events/${data.event_id}` as never);
    } else if (screen === "diary") {
      router.push("/diary" as never);
    } else if (screen === "reports") {
      router.push("/child/report" as never);
    } else if (screen === "milestones") {
      router.push("/child/milestones" as never);
    } else if (screen === "community") {
      router.push("/community" as never);
    }
  };

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (isSameDay(d, now)) return t("notifications.today");
    if (isSameDay(d, addDays(now, -1))) return t("notifications.yesterday");
    return formatDate(iso, i18n.language);
  };

  // Group by day, preserving API order (newest first).
  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const item of notifications.data ?? []) {
    const label = dayLabel(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <Screen refreshing={notifications.isRefetching} onRefresh={() => void notifications.refetch()}>
      <FilterChips
        chips={[
          { key: "all", label: t("notifications.all") },
          { key: "updates", label: t("notifications.updates"), icon: "sparkles" },
          { key: "reminders", label: t("notifications.reminders"), icon: "sunny" },
          { key: "events", label: t("notifications.events"), icon: "calendar" },
          { key: "messages", label: t("notifications.messagesTab"), icon: "chatbubble-ellipses" },
        ]}
        active={category}
        onChange={setCategory}
      />

      {notifications.isLoading ? (
        <Loading />
      ) : groups.length === 0 ? (
        <EmptyState icon="notifications-off" title={t("notifications.empty")} />
      ) : (
        groups.map((group) => (
          <View key={group.label} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <Card style={styles.groupCard}>
              {group.items.map((item, i) => {
                const visual = NOTIFICATION_CATEGORY[item.category] ?? NOTIFICATION_CATEGORY.general;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => open(item)}
                    style={[styles.row, i < group.items.length - 1 && styles.rowBorder]}
                  >
                    <IconCircle name={visual.icon} accent={visual.accent} size={40} />
                    <View style={styles.texts}>
                      <Text style={styles.title}>{item.title}</Text>
                      {item.body ? (
                        <Text style={styles.body} numberOfLines={2}>
                          {item.body}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.meta}>
                      <Text style={styles.time}>{formatTime(item.created_at, i18n.language)}</Text>
                      <UnreadDot visible={!item.read_at} />
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  markAll: { color: colors.primary, fontFamily: fonts.bold, fontSize: 13 },
  group: { gap: spacing.sm },
  groupLabel: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  groupCard: { paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, paddingVertical: spacing.sm + 2 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  body: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  meta: { alignItems: "flex-end", gap: 6 },
  time: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
});
