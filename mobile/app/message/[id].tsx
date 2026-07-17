import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useAcknowledge, useAnnouncement } from "../../src/api/hooks";
import type { AnnouncementRow } from "../../src/api/types";
import { GhostButton } from "../../src/components/Buttons";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { SectionHeader } from "../../src/components/SectionHeader";
import { Card, Loading, Screen } from "../../src/components/ui";
import { formatDate, formatTime } from "../../src/lib/stats";
import { colors, fonts, NOTIFICATION_CATEGORY, radius, spacing } from "../../src/theme";

export default function MessageDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const announcementId = Number(id);
  const qc = useQueryClient();

  const announcement = useAnnouncement(announcementId);
  const ack = useAcknowledge();

  // The detail GET lacks per-user state; read it from any cached list row.
  const cachedRows = qc
    .getQueriesData<AnnouncementRow[]>({ queryKey: ["announcements"] })
    .flatMap(([, rows]) => rows ?? []);
  const myRow = cachedRows.find((r) => r.announcement.id === announcementId);
  const acknowledged = !!myRow?.acknowledged_at || ack.isSuccess;

  if (announcement.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  const a = announcement.data;
  if (!a) {
    return (
      <Screen>
        <Text style={styles.body}>{t("common.error")}</Text>
      </Screen>
    );
  }

  const visual = NOTIFICATION_CATEGORY[a.category] ?? NOTIFICATION_CATEGORY.general;
  const images = (a.attachments ?? []).filter((x) => x.media?.mime?.startsWith("image/"));
  const files = (a.attachments ?? []).filter((x) => x.media && !x.media.mime?.startsWith("image/"));

  return (
    <Screen>
      <Card style={styles.headerCard}>
        <IconCircle name={visual.icon} accent={visual.accent} size={52} squircle />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{a.title}</Text>
            {a.badge ? <PillBadge label={a.badge} accent="primary" /> : null}
          </View>
          {a.published_at ? (
            <Text style={styles.date}>
              {formatDate(a.published_at, i18n.language)} · {formatTime(a.published_at, i18n.language)}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <Text style={styles.body}>{a.body}</Text>
      </Card>

      {images.length > 0 && (
        <View style={styles.imageGrid}>
          {images.map((img, i) => (
            <Image key={i} source={{ uri: img.media!.url }} style={styles.image} contentFit="cover" />
          ))}
        </View>
      )}

      {files.length > 0 && (
        <>
          <SectionHeader title={t("messages.attachments")} />
          {files.map((f, i) => (
            <Pressable key={i} onPress={() => void Linking.openURL(f.media!.url)}>
              <Card style={styles.fileRow}>
                <IconCircle name="document-attach" accent="primary" size={38} />
                <Text style={styles.fileName} numberOfLines={1}>
                  {f.media!.url.split("/").pop()}
                </Text>
                <IconCircle name="download" accent="neutral" size={30} />
              </Card>
            </Pressable>
          ))}
        </>
      )}

      {/* Acknowledge */}
      <Card style={styles.ackCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ackTitle}>{t("messages.ackPrompt")}</Text>
          <Text style={styles.ackSub}>{t("messages.ackPromptSub")}</Text>
        </View>
        {acknowledged ? (
          <PillBadge label={t("messages.acknowledged")} accent="activity" icon="checkmark" />
        ) : (
          <GhostButton
            label={t("messages.gotIt")}
            icon="checkmark"
            accent="activity"
            loading={ack.isPending}
            onPress={() => ack.mutate(announcementId)}
          />
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  title: { fontSize: 18, fontFamily: fonts.extrabold, color: colors.text },
  date: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  body: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, lineHeight: 22 },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  image: { width: "31.5%", aspectRatio: 1, borderRadius: radius.md },
  fileRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2 },
  fileName: { flex: 1, fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  ackCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#d1fae5",
    borderColor: "#a7f3d0",
  },
  ackTitle: { fontSize: 13, fontFamily: fonts.extrabold, color: "#047857" },
  ackSub: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
});
