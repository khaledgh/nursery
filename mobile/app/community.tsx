import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { errorMessage } from "../src/api/client";
import {
  useComment,
  useCommunityPosts,
  useCreatePost,
  useMeetupRsvp,
  useToggleLike,
} from "../src/api/hooks";
import type { CommunityPost } from "../src/api/types";
import { ChildAvatar } from "../src/components/ChildAvatar";
import { EmptyState } from "../src/components/EmptyState";
import { GhostButton, PrimaryButton } from "../src/components/Buttons";
import { IconCircle } from "../src/components/IconCircle";
import { PillBadge } from "../src/components/PillBadge";
import { Card, Loading, Screen } from "../src/components/ui";
import { formatDate, formatTime } from "../src/lib/stats";
import { useAuthStore } from "../src/store/auth";
import { accents, colors, fonts, radius, spacing } from "../src/theme";

type ComposerKind = "moment" | "activity" | null;

function PostCard({ post }: { post: CommunityPost }) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const like = useToggleLike(user?.id);
  const comment = useComment();
  const meetupRsvp = useMeetupRsvp();
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);

  const likes = post.likes ?? [];
  const liked = likes.some((l) => l.user_id === user?.id);
  const comments = post.comments ?? [];
  const shownComments = showAllComments ? comments : comments.slice(0, 2);
  const meetup = post.meetup;
  const going = meetup?.rsvps?.filter((r) => r.response === "going").length ?? 0;
  const interested = meetup?.rsvps?.filter((r) => r.response === "interested").length ?? 0;
  const myMeetup = meetup?.rsvps?.find((r) => r.user_id === user?.id)?.response;

  return (
    <Card style={styles.post}>
      {/* Author */}
      <View style={styles.postHeader}>
        <ChildAvatar url={post.author?.avatar?.url} name={post.author?.name ?? "?"} size={40} />
        <View style={{ flex: 1 }}>
          <View style={styles.authorRow}>
            <Text style={styles.authorName}>{post.author?.name}</Text>
            <PillBadge
              label={post.author?.role === "teacher" ? t("community.teacher") : t("community.parent")}
              accent={post.author?.role === "teacher" ? "primary" : "activity"}
            />
          </View>
          <Text style={styles.postTime}>
            {formatDate(post.created_at, i18n.language)} · {formatTime(post.created_at, i18n.language)}
          </Text>
        </View>
      </View>

      {/* Meetup banner */}
      {meetup && (
        <View style={styles.meetupBox}>
          <View style={styles.meetupTitleRow}>
            <Text style={styles.meetupTitle}>🎈 {meetup.title}</Text>
            <PillBadge label={t("community.invitation")} accent="activity" icon="checkmark" />
          </View>
        </View>
      )}

      <Text style={styles.postBody}>{post.body}</Text>

      {/* Media */}
      {(post.media ?? []).length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
          {(post.media ?? [])
            .filter((m) => m.media?.url)
            .map((m, i) => (
              <Image key={i} source={{ uri: m.media!.url }} style={styles.postPhoto} contentFit="cover" />
            ))}
        </ScrollView>
      )}

      {/* Meetup details + RSVP */}
      {meetup && (
        <View style={styles.meetupDetails}>
          <View style={styles.meetupChips}>
            <PillBadge label={`📅 ${formatDate(meetup.starts_at, i18n.language)} ${formatTime(meetup.starts_at, i18n.language)}`} accent="primary" />
            {meetup.location ? <PillBadge label={`📍 ${meetup.location}`} accent="events" /> : null}
            <PillBadge label={`${t("community.goingCount", { count: going })} · ${t("community.interestedCount", { count: interested })}`} accent="neutral" />
          </View>
          <View style={styles.meetupActions}>
            <View style={{ flex: 1 }}>
              <GhostButton
                label={t("community.interested")}
                accent={myMeetup === "interested" ? "meals" : "neutral"}
                onPress={() => meetupRsvp.mutate({ meetupId: meetup.id, response: "interested" })}
                loading={meetupRsvp.isPending}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={`✓ ${t("community.going")}`}
                accent={myMeetup === "going" ? "activity" : "primary"}
                onPress={() => meetupRsvp.mutate({ meetupId: meetup.id, response: "going" })}
                loading={meetupRsvp.isPending}
              />
            </View>
          </View>
        </View>
      )}

      {/* Like / comment counts */}
      <View style={styles.countsRow}>
        <Pressable onPress={() => like.mutate(post.id)} style={styles.countItem} hitSlop={8}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? accents.events.main : colors.textMuted} />
          <Text style={styles.countText}>{likes.length}</Text>
        </Pressable>
        <View style={styles.countItem}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
          <Text style={styles.countText}>{comments.length}</Text>
        </View>
      </View>

      {/* Comments */}
      {shownComments.length > 0 && (
        <View style={styles.comments}>
          {shownComments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <ChildAvatar url={c.author?.avatar?.url} name={c.author?.name ?? "?"} size={26} />
              <View style={styles.commentBubble}>
                <Text style={styles.commentAuthor}>{c.author?.name}</Text>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            </View>
          ))}
          {comments.length > 2 && !showAllComments && (
            <Pressable onPress={() => setShowAllComments(true)}>
              <Text style={styles.viewAllComments}>{t("community.viewComments", { count: comments.length })}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Comment composer */}
      <View style={styles.commentComposer}>
        <TextInput
          style={styles.commentInput}
          placeholder={t("community.writeComment")}
          placeholderTextColor={colors.textMuted}
          value={commentText}
          onChangeText={setCommentText}
        />
        <Pressable
          disabled={!commentText.trim() || comment.isPending}
          onPress={() =>
            comment.mutate(
              { postId: post.id, body: commentText.trim() },
              { onSuccess: () => setCommentText("") },
            )
          }
          hitSlop={8}
        >
          <IconCircle name="send" accent={commentText.trim() ? "primary" : "neutral"} size={36} />
        </Pressable>
      </View>
    </Card>
  );
}

export default function CommunityScreen() {
  const { t } = useTranslation();
  const posts = useCommunityPosts();
  const createPost = useCreatePost();

  const [composer, setComposer] = useState<ComposerKind>(null);
  const [body, setBody] = useState("");
  const [meetupTitle, setMeetupTitle] = useState("");
  const [meetupLocation, setMeetupLocation] = useState("");
  const [meetupWhen, setMeetupWhen] = useState("");
  const [composeError, setComposeError] = useState("");

  const submitPost = () => {
    setComposeError("");
    const payload: Parameters<typeof createPost.mutate>[0] = { type: composer ?? "moment", body: body.trim() };
    if (composer === "activity") {
      const when = new Date(meetupWhen.replace(" ", "T"));
      if (!meetupTitle.trim() || Number.isNaN(when.getTime())) {
        setComposeError(t("common.error"));
        return;
      }
      payload.meetup = { title: meetupTitle.trim(), location: meetupLocation.trim(), starts_at: when.toISOString() };
    }
    createPost.mutate(payload, {
      onSuccess: () => {
        setComposer(null);
        setBody("");
        setMeetupTitle("");
        setMeetupLocation("");
        setMeetupWhen("");
      },
      onError: (err) => setComposeError(errorMessage(err)),
    });
  };

  return (
    <Screen refreshing={posts.isRefetching} onRefresh={() => void posts.refetch()}>
      <Text style={styles.subtitle}>{t("community.subtitle")}</Text>

      {/* Action cards */}
      <View style={styles.actions}>
        <Pressable style={[styles.actionCard, { backgroundColor: accents.primary.tint }]} onPress={() => setComposer("moment")}>
          <IconCircle name="image" accent="primary" size={40} />
          <Text style={styles.actionTitle}>{t("community.shareMoment")}</Text>
          <Text style={styles.actionSub}>{t("community.shareMomentSub")}</Text>
        </Pressable>
        <Pressable style={[styles.actionCard, { backgroundColor: accents.activity.tint }]} onPress={() => setComposer("activity")}>
          <IconCircle name="calendar" accent="activity" size={40} />
          <Text style={styles.actionTitle}>{t("community.planActivity")}</Text>
          <Text style={styles.actionSub}>{t("community.planActivitySub")}</Text>
        </Pressable>
      </View>

      <Text style={styles.recentTitle}>{t("community.recentPosts")}</Text>

      {posts.isLoading ? (
        <Loading />
      ) : (posts.data ?? []).length === 0 ? (
        <EmptyState icon="people" title={t("community.empty")} />
      ) : (
        (posts.data ?? []).map((post) => <PostCard key={post.id} post={post} />)
      )}

      {/* Composer modal */}
      <Modal visible={composer !== null} transparent animationType="fade" onRequestClose={() => setComposer(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {composer === "activity" ? t("community.planActivity") : t("community.shareMoment")}
            </Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 80 }]}
              placeholder={t("community.whatsHappening")}
              placeholderTextColor={colors.textMuted}
              value={body}
              onChangeText={setBody}
              multiline
            />
            {composer === "activity" && (
              <>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t("community.meetupTitle")}
                  placeholderTextColor={colors.textMuted}
                  value={meetupTitle}
                  onChangeText={setMeetupTitle}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder={t("community.location")}
                  placeholderTextColor={colors.textMuted}
                  value={meetupLocation}
                  onChangeText={setMeetupLocation}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder={t("community.when")}
                  placeholderTextColor={colors.textMuted}
                  value={meetupWhen}
                  onChangeText={setMeetupWhen}
                />
              </>
            )}
            {composeError ? <Text style={styles.modalError}>{composeError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setComposer(null)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label={t("community.post")}
                  onPress={submitPost}
                  disabled={!body.trim()}
                  loading={createPost.isPending}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted, marginTop: -spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionCard: { flex: 1, borderRadius: radius.lg, padding: spacing.md, gap: 5 },
  actionTitle: { fontSize: 13, fontFamily: fonts.extrabold, color: colors.text },
  actionSub: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  recentTitle: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  post: { gap: spacing.sm + 2 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  authorName: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  postTime: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  postBody: { fontSize: 14, fontFamily: fonts.semibold, color: colors.text, lineHeight: 20 },
  mediaRow: { gap: spacing.sm },
  postPhoto: { width: 220, height: 160, borderRadius: radius.md },
  meetupBox: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm + 2 },
  meetupTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 },
  meetupTitle: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.text },
  meetupDetails: { gap: spacing.sm },
  meetupChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  meetupActions: { flexDirection: "row", gap: spacing.sm },
  countsRow: { flexDirection: "row", gap: spacing.md },
  countItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  countText: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
  comments: { gap: spacing.sm },
  commentRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  commentBubble: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.sm },
  commentAuthor: { fontSize: 12, fontFamily: fonts.extrabold, color: colors.text },
  commentBody: { fontSize: 12, fontFamily: fonts.semibold, color: colors.text },
  viewAllComments: { fontSize: 12, fontFamily: fonts.bold, color: colors.primary },
  commentComposer: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  commentInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontFamily: fonts.semibold,
    color: colors.text,
    fontSize: 13,
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(30,27,46,0.5)", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  modalTitle: { fontSize: 17, fontFamily: fonts.extrabold, color: colors.text },
  modalInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontFamily: fonts.semibold,
    color: colors.text,
    textAlignVertical: "top",
  },
  modalError: { color: colors.danger, fontSize: 13, fontFamily: fonts.semibold },
  modalActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modalCancel: { paddingHorizontal: spacing.md, paddingVertical: 12 },
  modalCancelText: { fontFamily: fonts.bold, color: colors.textMuted },
});
