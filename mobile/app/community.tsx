import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { errorMessage } from "../src/api/client";
import {
  useComment,
  useCommunityPosts,
  useCreatePost,
  useDeleteComment,
  useMeetupRsvp,
  usePlatformSettings,
  useToggleLike,
  useUpdatePlatformSettings,
} from "../src/api/hooks";
import type { CommunityPost } from "../src/api/types";
import { ChildAvatar } from "../src/components/ChildAvatar";
import { EmptyState } from "../src/components/EmptyState";
import { GhostButton, PrimaryButton } from "../src/components/Buttons";
import { DateTimeField, withDay, withTime } from "../src/components/form/DateTimeField";
import { PhotoField } from "../src/components/form/PhotoField";
import { IconCircle } from "../src/components/IconCircle";
import { PillBadge } from "../src/components/PillBadge";
import { Card, Loading, Screen } from "../src/components/ui";
import { formatDate, formatTime } from "../src/lib/stats";
import { useAuthStore } from "../src/store/auth";
import { accents, colors, fonts, radius, spacing } from "../src/theme";
import { useClearSectionBadge } from "../src/lib/useClearSectionBadge";
import { remoteImage } from "../src/lib/remoteImage";
import { Tap } from "../src/components/Tap";

type ComposerKind = "moment" | "activity" | null;

const ROLE_ACCENT = { teacher: "primary", admin: "secondary", parent: "activity" } as const;

/** Shows whether an author is a teacher, the nursery office or a parent. */
function RoleBadge({ role }: { role?: string }) {
  const { t } = useTranslation();
  const key = role === "teacher" || role === "admin" ? role : "parent";
  return <PillBadge label={t(`community.roles.${key}`)} accent={ROLE_ACCENT[key]} />;
}

/** Tomorrow at 10:00, the default start for a new activity. */
function defaultMeetupDate() {
  const d = new Date(Date.now() + 86400000);
  d.setHours(10, 0, 0, 0);
  return d;
}

function PostCard({ post }: { post: CommunityPost }) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const like = useToggleLike(user?.id);
  const comment = useComment();
  const deleteComment = useDeleteComment();
  const meetupRsvp = useMeetupRsvp();
  const isStaff = user?.role === "teacher" || user?.role === "admin";

  const confirmDeleteComment = (id: number) =>
    Alert.alert(t("community.deleteComment"), t("community.deleteCommentConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: () => deleteComment.mutate(id) },
    ]);
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
            <RoleBadge role={post.author?.role} />
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
              <Image key={i} source={remoteImage(m.media?.url)} style={styles.postPhoto} contentFit="cover" />
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
        <Tap haptic onPress={() => like.mutate(post.id)} style={styles.countItem} hitSlop={8}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? accents.events.main : colors.textMuted} />
          <Text style={styles.countText}>{likes.length}</Text>
        </Tap>
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
                <View style={styles.commentHead}>
                  <Text style={styles.commentAuthor}>{c.author?.name}</Text>
                  <RoleBadge role={c.author?.role} />
                </View>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
              {(c.author?.id === user?.id || isStaff) && (
                <Tap
                  onPress={() => confirmDeleteComment(c.id)}
                  hitSlop={10}
                  style={styles.commentDelete}
                  accessibilityRole="button"
                  accessibilityLabel={t("community.deleteComment")}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </Tap>
              )}
            </View>
          ))}
          {comments.length > 2 && !showAllComments && (
            <Tap onPress={() => setShowAllComments(true)}>
              <Text style={styles.viewAllComments}>{t("community.viewComments", { count: comments.length })}</Text>
            </Tap>
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
        <Tap
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
        </Tap>
      </View>
    </Card>
  );
}

export default function CommunityScreen() {
  useClearSectionBadge("community");
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const posts = useCommunityPosts();
  const createPost = useCreatePost();
  const platformSettings = usePlatformSettings();
  const updateSettings = useUpdatePlatformSettings();

  const [composer, setComposer] = useState<ComposerKind>(null);
  const [body, setBody] = useState("");
  const [meetupTitle, setMeetupTitle] = useState("");
  const [meetupLocation, setMeetupLocation] = useState("");
  const [meetupAt, setMeetupAt] = useState<Date>(defaultMeetupDate);
  const [mediaIds, setMediaIds] = useState<number[]>([]);
  const [composeError, setComposeError] = useState<string | null>(null);

  const isCommunityOpen = platformSettings.data?.feature_community !== false;
  const isAdmin = user?.role === "admin";

  const handleToggleCommunity = (val: boolean) => {
    updateSettings.mutate({ feature_community: val });
  };

  const submitPost = () => {
    if (!body.trim()) return;
    setComposeError(null);
    createPost.mutate(
      {
        type: composer === "activity" ? "activity" : "moment",
        body: body.trim(),
        media_ids: mediaIds.length > 0 ? mediaIds : undefined,
        meetup:
          composer === "activity" && meetupTitle.trim()
            ? {
                title: meetupTitle.trim(),
                location: meetupLocation.trim(),
                starts_at: meetupAt.toISOString(),
              }
            : undefined,
      },
      {
        onSuccess: () => {
          setComposer(null);
          setBody("");
          setMeetupTitle("");
          setMeetupLocation("");
          setMeetupAt(defaultMeetupDate());
          setMediaIds([]);
        },
        onError: (err) => setComposeError(errorMessage(err)),
      }
    );
  };

  return (
    <Screen refreshing={posts.isRefetching} onRefresh={() => void posts.refetch()}>
      <Text style={styles.subtitle}>{t("community.subtitle")}</Text>

      {/* Admin Toggle Bar */}
      {isAdmin && (
        <Card style={styles.adminToggleCard}>
          <View style={styles.adminToggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminToggleTitle}>Community Control</Text>
              <Text style={styles.adminToggleSub}>
                {isCommunityOpen ? "Community is OPEN for posts" : "Community is CLOSED for non-admins"}
              </Text>
            </View>
            <Switch
              value={isCommunityOpen}
              onValueChange={handleToggleCommunity}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>
      )}

      {/* Closed Banner for Non-Admins */}
      {!isCommunityOpen && !isAdmin && (
        <Card style={styles.closedBanner}>
          <IconCircle name="lock-closed" accent="health" size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.closedTitle}>Community Feed Closed</Text>
            <Text style={styles.closedSub}>Posting and commenting are currently disabled by administration.</Text>
          </View>
        </Card>
      )}

      {/* Action cards */}
      {(isCommunityOpen || isAdmin) && (
        <View style={styles.actions}>
          <Tap style={[styles.actionCard, { backgroundColor: accents.primary.tint }]} onPress={() => setComposer("moment")}>
            <IconCircle name="image" accent="primary" size={40} />
            <Text style={styles.actionTitle}>{t("community.shareMoment")}</Text>
            <Text style={styles.actionSub}>{t("community.shareMomentSub")}</Text>
          </Tap>
          <Tap style={[styles.actionCard, { backgroundColor: accents.activity.tint }]} onPress={() => setComposer("activity")}>
            <IconCircle name="calendar" accent="activity" size={40} />
            <Text style={styles.actionTitle}>{t("community.planActivity")}</Text>
            <Text style={styles.actionSub}>{t("community.planActivitySub")}</Text>
          </Tap>
        </View>
      )}

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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <ScrollView style={styles.modalCard} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
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
                <DateTimeField
                  label={t("community.date")}
                  mode="date"
                  value={meetupAt}
                  minimumDate={new Date()}
                  onChange={(d) => setMeetupAt((cur) => withDay(cur, d))}
                />
                <DateTimeField
                  label={t("community.time")}
                  mode="time"
                  value={meetupAt}
                  onChange={(d) => setMeetupAt((cur) => withTime(cur, d))}
                />
              </>
            )}
            {composer === "moment" && (
              <PhotoField label={t("community.addPhotos")} mediaIds={mediaIds} onChange={setMediaIds} max={6} />
            )}
            {composeError ? <Text style={styles.modalError}>{composeError}</Text> : null}
            <View style={styles.modalActions}>
              <Tap onPress={() => setComposer(null)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
              </Tap>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label={t("community.post")}
                  onPress={submitPost}
                  disabled={!body.trim()}
                  loading={createPost.isPending}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  adminToggleCard: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  adminToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  adminToggleTitle: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.text },
  adminToggleSub: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted, marginTop: 2 },
  closedBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  closedTitle: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.danger },
  closedSub: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted, marginTop: 2 },
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
  commentHead: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 },
  commentAuthor: { fontSize: 12, fontFamily: fonts.extrabold, color: colors.text },
  commentDelete: { paddingTop: spacing.sm },
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
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, flexGrow: 0, maxHeight: "90%" },
  modalContent: { padding: spacing.lg, gap: spacing.sm },
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
