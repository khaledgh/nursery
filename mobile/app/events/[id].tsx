import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useEvent, useEventFeedback, useEventMedia } from "../../src/api/hooks";
import { GhostButton } from "../../src/components/Buttons";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { PhotoStrip } from "../../src/components/PhotoStrip";
import { SectionHeader } from "../../src/components/SectionHeader";
import { TipBanner } from "../../src/components/TipBanner";
import { Card, Loading, Screen } from "../../src/components/ui";
import { formatDate, formatTime } from "../../src/lib/stats";
import { useActiveChild } from "../../src/store/activeChild";
import { colors, fonts, radius, spacing } from "../../src/theme";

export default function EventDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number(id);
  const { child } = useActiveChild();

  const detail = useEvent(eventId);
  const media = useEventMedia(eventId);
  const feedback = useEventFeedback();
  const [comment, setComment] = useState("");
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  if (detail.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  const event = detail.data?.event;
  if (!event) {
    return (
      <Screen>
        <Text style={styles.metaText}>{t("common.error")}</Text>
      </Screen>
    );
  }

  const loved = detail.data?.my_feedback?.loved || feedback.isSuccess;
  const photos = (media.data ?? []).filter((m) => m.media?.url);
  const childMoments = photos.filter((m) => m.child_id === child?.id);
  const albumPhotos = photos.map((m) => ({ url: m.media!.url, caption: m.caption || undefined }));

  return (
    <Screen>
      {/* Header card */}
      <Card style={styles.headerCard}>
        {event.status === "completed" && (
          <PillBadge label={t("events.completed")} accent="activity" icon="checkmark-circle" />
        )}
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.metaCol}>
          <View style={styles.metaRow}>
            <IconCircle name="calendar" accent="primary" size={26} />
            <Text style={styles.metaText}>{formatDate(event.starts_at, i18n.language)}</Text>
          </View>
          <View style={styles.metaRow}>
            <IconCircle name="time" accent="hydration" size={26} />
            <Text style={styles.metaText}>
              {formatTime(event.starts_at, i18n.language)}
              {event.ends_at ? ` – ${formatTime(event.ends_at, i18n.language)}` : ""}
            </Text>
          </View>
          {event.location ? (
            <View style={styles.metaRow}>
              <IconCircle name="location" accent="events" size={26} />
              <Text style={styles.metaText}>{event.location}</Text>
            </View>
          ) : null}
        </View>
        {event.cover_media?.url && (
          <Image source={{ uri: event.cover_media.url }} style={styles.cover} contentFit="cover" />
        )}
      </Card>

      {/* Photo album */}
      {albumPhotos.length > 0 && (
        <>
          <SectionHeader
            title={`📷 ${t("events.photoAlbum")}`}
            actionLabel={albumPhotos.length > 6 && !showAllPhotos ? t("events.viewAll", { count: albumPhotos.length }) : undefined}
            onAction={() => setShowAllPhotos(true)}
          />
          <View style={styles.albumGrid}>
            {(showAllPhotos ? albumPhotos : albumPhotos.slice(0, 6)).map((p, i) => (
              <Image key={i} source={{ uri: p.url }} style={styles.albumPhoto} contentFit="cover" />
            ))}
          </View>
        </>
      )}

      {/* Child's moments */}
      {child && childMoments.length > 0 && (
        <>
          <SectionHeader title={`⭐ ${t("events.childMoments", { name: child.first_name })}`} />
          <Card style={{ gap: spacing.sm }}>
            <Text style={styles.metaText}>{t("events.childMomentsSub", { name: child.first_name })}</Text>
            <PhotoStrip photos={childMoments.map((m) => ({ url: m.media!.url, caption: m.caption || undefined }))} size={88} />
          </Card>
        </>
      )}

      {/* What happened */}
      {event.description ? (
        <>
          <SectionHeader title={`🌿 ${t("events.whatHappened")}`} />
          <Card>
            <Text style={styles.description}>{event.description}</Text>
          </Card>
        </>
      ) : null}

      {/* Feedback */}
      {loved ? (
        <TipBanner icon="heart" accent="events" text={t("events.lovedConfirmed")} />
      ) : (
        <Card style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>💬 {t("events.commentPlaceholder")}</Text>
          <TextInput
            style={styles.commentInput}
            placeholder={t("events.commentPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <View style={styles.feedbackRow}>
            <View style={{ flex: 1 }}>
              <GhostButton
                label={t("events.lovedIt")}
                icon="heart"
                accent="events"
                loading={feedback.isPending}
                onPress={() => feedback.mutate({ eventId, loved: true, comment: comment.trim() || undefined })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <GhostButton
                label={t("events.addComment")}
                icon="chatbubble-ellipses"
                accent="primary"
                disabled={!comment.trim()}
                loading={feedback.isPending}
                onPress={() => feedback.mutate({ eventId, loved: false, comment: comment.trim() })}
              />
            </View>
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: { gap: spacing.sm + 2 },
  title: { fontSize: 20, fontFamily: fonts.extrabold, color: colors.text },
  metaCol: { gap: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaText: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  cover: { width: "100%", height: 170, borderRadius: radius.lg },
  albumGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  albumPhoto: { width: "31.5%", aspectRatio: 1, borderRadius: radius.md },
  description: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, lineHeight: 21 },
  feedbackCard: { gap: spacing.sm + 2 },
  feedbackTitle: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  commentInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: "top",
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  feedbackRow: { flexDirection: "row", gap: spacing.sm },
});
