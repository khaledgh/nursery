import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAnnouncements, useArchiveAnnouncement } from "../../src/api/hooks";
import { EmptyState } from "../../src/components/EmptyState";
import { IconCircle } from "../../src/components/IconCircle";
import { SegmentTabs } from "../../src/components/SegmentTabs";
import { Card, Loading, Screen, UnreadDot } from "../../src/components/ui";
import { formatDate } from "../../src/lib/stats";
import { colors, fonts, gradients, NOTIFICATION_CATEGORY, radius, spacing } from "../../src/theme";

type Tab = "all" | "unread" | "archived";

export default function MessagesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");

  const announcements = useAnnouncements(tab);
  const archive = useArchiveAnnouncement();

  return (
    <Screen refreshing={announcements.isRefetching} onRefresh={() => void announcements.refetch()}>
      {/* Stay informed hero */}
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <IconCircle name="megaphone" accent={{ main: "#fff", tint: "rgba(255,255,255,0.2)", dark: "#fff" }} size={46} />
        <View style={{ flex: 1 }}>
          <Text style={styles.heroTitle}>{t("messages.stayInformed")}</Text>
          <Text style={styles.heroSub}>{t("messages.stayInformedSub")}</Text>
        </View>
      </LinearGradient>

      <SegmentTabs
        tabs={[
          { key: "all", label: t("messages.all") },
          { key: "unread", label: t("messages.unread") },
          { key: "archived", label: t("messages.archived") },
        ]}
        active={tab}
        onChange={(k) => setTab(k as Tab)}
      />

      {announcements.isLoading ? (
        <Loading />
      ) : (announcements.data ?? []).length === 0 ? (
        <EmptyState icon="mail-open" title={t("messages.empty")} />
      ) : (
        (announcements.data ?? []).map((row) => {
          const a = row.announcement;
          const visual = NOTIFICATION_CATEGORY[a.category] ?? NOTIFICATION_CATEGORY.general;
          return (
            <Pressable key={a.id} onPress={() => router.push(`/message/${a.id}` as never)}>
              <Card style={styles.messageCard}>
                <IconCircle name={visual.icon} accent={visual.accent} size={46} squircle />
                <View style={styles.messageTexts}>
                  <View style={styles.messageTitleRow}>
                    <Text style={styles.messageTitle} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <UnreadDot visible={!row.read_at} />
                  </View>
                  <Text style={styles.messageBody} numberOfLines={2}>
                    {a.body}
                  </Text>
                  <View style={styles.messageFooter}>
                    <Text style={styles.readMore}>{t("messages.readMore")} ›</Text>
                    <Text style={styles.messageDate}>
                      {a.published_at ? formatDate(a.published_at, i18n.language) : ""}
                    </Text>
                  </View>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => archive.mutate({ id: a.id, archived: tab !== "archived" })}
                  style={styles.archiveBtn}
                >
                  <IconCircle name={tab === "archived" ? "arrow-undo" : "archive"} accent="neutral" size={28} />
                </Pressable>
              </Card>
            </Pressable>
          );
        })
      )}

      <Pressable onPress={() => router.push("/notifications")}>
        <Card style={styles.settingsBanner}>
          <IconCircle name="notifications" accent="primary" size={38} />
          <View style={{ flex: 1 }}>
            <Text style={styles.settingsTitle}>{t("messages.neverMiss")}</Text>
            <Text style={styles.settingsSub}>{t("messages.neverMissSub")}</Text>
          </View>
        </Card>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.md + 2,
  },
  heroTitle: { fontSize: 17, fontFamily: fonts.extrabold, color: "#fff" },
  heroSub: { fontSize: 12, fontFamily: fonts.semibold, color: "rgba(255,255,255,0.85)" },
  messageCard: { flexDirection: "row", gap: spacing.sm + 4 },
  messageTexts: { flex: 1, gap: 4 },
  messageTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  messageTitle: { flex: 1, fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  messageBody: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted, lineHeight: 18 },
  messageFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  readMore: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
  messageDate: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  archiveBtn: { alignSelf: "flex-start" },
  settingsBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, backgroundColor: colors.primaryLight },
  settingsTitle: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.text },
  settingsSub: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
});
