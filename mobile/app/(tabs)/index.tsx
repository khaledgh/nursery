import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorMessage } from "../../src/api/client";
import {
  useClassroomSchedule,
  useDashboard,
  useRequestAttendance,
  useUnreadCount,
  useChildMedia,
} from "../../src/api/hooks";
import { ChildAvatar } from "../../src/components/ChildAvatar";
import { ChildSwitcher } from "../../src/components/ChildSwitcher";
import { HeroCard } from "../../src/components/HeroCard";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { PhotoStrip, type StripPhoto } from "../../src/components/PhotoStrip";
import { PrimaryButton } from "../../src/components/Buttons";
import { SectionHeader } from "../../src/components/SectionHeader";
import { TimelineItem } from "../../src/components/Timeline";
import { Card, Screen } from "../../src/components/ui";
import { childAgeLabel, formatTime, relationshipLabel, toISODate } from "../../src/lib/stats";
import { useRefreshAll } from "../../src/lib/useRefreshAll";
import { useActiveChild } from "../../src/store/activeChild";
import { useAuthStore } from "../../src/store/auth";
import { colors, fonts, radius, safeIcon, spacing, type AccentName } from "../../src/theme";

type AttendanceAction = "absent" | "late" | "early_pickup";

const QUICK_ACCESS: { icon: string; accent: AccentName; key: string; href: string }[] = [
  { icon: "book", accent: "primary", key: "tabs.diary", href: "/diary" },
  { icon: "images", accent: "activity", key: "home.gallery", href: "/child/gallery" },
  { icon: "restaurant", accent: "meals", key: "home.meals", href: "/child/feed" },
  { icon: "calendar", accent: "events", key: "home.events", href: "/events" },
  { icon: "chatbubbles", accent: "hydration", key: "tabs.messages", href: "/messages" },
  { icon: "card", accent: "payments", key: "home.payments", href: "/payments" },
  { icon: "heart", accent: "health", key: "home.health", href: "/child/health" },
  { icon: "briefcase", accent: "community", key: "home.whatToBring", href: "/reminders" },
  { icon: "people", accent: "activity", key: "home.community", href: "/community" },
  { icon: "school", accent: "diaper", key: "home.classroom", href: "/classroom" },
];

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { child } = useActiveChild();

  const dashboard = useDashboard(child?.id);
  const schedule = useClassroomSchedule(child?.classroom_id);
  const unread = useUnreadCount();
  const mediaQuery = useChildMedia(child?.id, 1);
  const { refreshing, onRefresh } = useRefreshAll(dashboard, schedule, unread, mediaQuery);
  const requestAttendance = useRequestAttendance(child?.id);

  const [action, setAction] = useState<AttendanceAction | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("home.goodMorning") : hour < 17 ? t("home.goodAfternoon") : t("home.goodEvening");
  const unreadCount = unread.data?.unread ?? 0;

  // Today's classroom routine with a time-derived status.
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todaySchedule = (schedule.data ?? []).filter((s) => s.weekday === now.getDay());

  const recentPhotos: StripPhoto[] = (dashboard.data?.diary ?? [])
    .flatMap((entry) =>
      (entry.media ?? [])
        .filter((m) => m.media?.url)
        .map((m) => ({ url: m.media!.url, caption: entry.title })),
    )
    .slice(0, 10);

  const submitAttendance = () => {
    if (!action) return;
    setSendError("");
    requestAttendance.mutate(
      { date: toISODate(new Date()), status: action, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setSent(true);
          setTimeout(() => {
            setAction(null);
            setSent(false);
            setNote("");
          }, 1600);
        },
        onError: (err) => setSendError(errorMessage(err)),
      },
    );
  };

  const presence = child?.present_status;
  const presencePill =
    presence === "checked_in" ? (
      <PillBadge label={t("home.checkedIn")} accent="activity" dot />
    ) : presence === "absent" ? (
      <PillBadge label={t("home.absent")} accent="health" dot />
    ) : (
      <PillBadge label={t("home.checkedOut")} accent="neutral" dot />
    );

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* Greeting header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.welcome}>
            {t("home.welcomeBack", { name: relationshipLabel(child?.guardians, user?.id) })}
          </Text>
        </View>
        <Pressable onPress={() => router.push("/notifications")} style={styles.bell} hitSlop={8}>
          <IconCircle name="notifications" accent="primary" size={42} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
        <ChildAvatar url={user?.avatar?.url} name={user?.name ?? "?"} size={42} />
      </View>

      <ChildSwitcher />

      {!child ? (
        <Card>
          <Text style={styles.noChildren}>{t("home.noChildren")}</Text>
        </Card>
      ) : (
        <>
          {/* Child hero */}
          <HeroCard
            photoUrl={child.avatar?.url}
            name={child.first_name}
            title={`${child.first_name} ${child.last_name}`}
            subtitle={`${childAgeLabel(child.dob)} · ${child.classroom?.name ?? ""}`}
          >
            <View style={styles.heroPills}>
              {presencePill}
              {presence === "checked_in" && child.checked_in_at ? (
                <Text style={styles.heroSince}>
                  {t("home.inSince", { time: formatTime(child.checked_in_at, i18n.language) })}
                </Text>
              ) : null}
            </View>
          </HeroCard>

          {/* Unread banner */}
          {unreadCount > 0 && (
            <Pressable onPress={() => router.push("/notifications")}>
              <Card style={styles.unreadBanner}>
                <IconCircle name="mail-unread" accent="primary" size={34} />
                <Text style={styles.unreadText}>{t("home.unreadBanner", { count: unreadCount })}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Card>
            </Pressable>
          )}

          {/* Attendance actions */}
          <SectionHeader title={t("home.letUsKnow")} />
          <View style={styles.actionRow}>
            {(
              [
                { key: "absent", icon: "sad-outline", accent: "health", label: t("home.absentToday") },
                { key: "late", icon: "time-outline", accent: "meals", label: t("home.willBeLate") },
                { key: "early_pickup", icon: "exit-outline", accent: "hydration", label: t("home.pickUpEarly") },
              ] as { key: AttendanceAction; icon: string; accent: AccentName; label: string }[]
            ).map((a) => (
              <Pressable key={a.key} onPress={() => setAction(a.key)} style={styles.actionTile}>
                <IconCircle name={a.icon} accent={a.accent} size={40} />
                <Text style={styles.actionLabel}>{a.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Today at a glance */}
          {todaySchedule.length > 0 && (
            <>
              <SectionHeader
                title={t("home.todayGlance")}
                actionLabel={t("common.viewAll")}
                onAction={() => router.push("/classroom")}
              />
              <Card>
                {todaySchedule.map((item, i) => {
                  const started = item.starts_at <= hhmm;
                  const isNow =
                    started && (i === todaySchedule.length - 1 || todaySchedule[i + 1].starts_at > hhmm);
                  return (
                    <TimelineItem
                      key={item.id}
                      time={item.starts_at}
                      timeSub={isNow ? t("home.now") : undefined}
                      icon={safeIcon(item.icon, "sparkles")}
                      accent={started ? "activity" : "neutral"}
                      last={i === todaySchedule.length - 1}
                    >
                      <Text style={styles.scheduleTitle}>{item.title}</Text>
                      {item.description ? <Text style={styles.scheduleSub}>{item.description}</Text> : null}
                    </TimelineItem>
                  );
                })}
              </Card>
            </>
          )}

          {/* Recent updates */}
          {recentPhotos.length > 0 && (
            <>
              <SectionHeader
                title={t("home.recentUpdates")}
                actionLabel={t("common.viewAll")}
                onAction={() => router.push("/diary")}
              />
              <PhotoStrip photos={recentPhotos} />
            </>
          )}

          {/* Gallery preview */}
          {mediaQuery.data && mediaQuery.data.length > 0 && (
            <>
              <SectionHeader
                title={t("gallery.title")}
                actionLabel={t("common.viewAll")}
                onAction={() => router.push("/child/gallery")}
              />
              <PhotoStrip
                photos={mediaQuery.data.map((m) => ({ url: m.url }))}
                onPressMore={() => router.push("/child/gallery")}
              />
            </>
          )}

          {/* Quick access */}
          <SectionHeader title={t("home.quickAccess")} />
          <View style={styles.grid}>
            {QUICK_ACCESS.map((q) => (
              <Pressable
                key={q.key}
                style={styles.gridTile}
                onPress={() => router.push(q.href as Parameters<typeof router.push>[0])}
              >
                <IconCircle name={q.icon} accent={q.accent} size={46} squircle />
                <Text style={styles.gridLabel} numberOfLines={1}>
                  {t(q.key)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Attendance modal */}
      <Modal visible={action !== null} transparent animationType="fade" onRequestClose={() => setAction(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {sent ? (
              <View style={styles.sentWrap}>
                <IconCircle name="checkmark-circle" accent="activity" size={56} />
                <Text style={styles.sentText}>{t("home.attendanceSent")}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>
                  {action === "absent"
                    ? t("home.absentToday")
                    : action === "late"
                      ? t("home.willBeLate")
                      : t("home.pickUpEarly")}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t("home.attendanceNote")}
                  placeholderTextColor={colors.textMuted}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
                {sendError ? <Text style={styles.modalError}>{sendError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setAction(null)} style={styles.modalCancel}>
                    <Text style={styles.modalCancelText}>{t("common.cancel")}</Text>
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label={t("home.send")}
                      onPress={submitAttendance}
                      loading={requestAttendance.isPending}
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  greeting: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  welcome: { fontSize: 20, fontFamily: fonts.extrabold, color: colors.text },
  bell: { position: "relative" },
  bellBadge: {
    position: "absolute",
    top: -2,
    insetInlineEnd: -2,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: "#fff", fontSize: 10, fontFamily: fonts.extrabold },
  noChildren: { fontFamily: fonts.semibold, color: colors.textMuted, textAlign: "center" },
  heroPills: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
  heroSince: { fontSize: 11, fontFamily: fonts.semibold, color: "rgba(255,255,255,0.85)" },
  unreadBanner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  unreadText: { flex: 1, fontSize: 13, fontFamily: fonts.bold, color: colors.text },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actionTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  actionLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.text, textAlign: "center" },
  scheduleTitle: { fontSize: 14, fontFamily: fonts.bold, color: colors.text },
  scheduleSub: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  gridTile: {
    width: "31%",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.md,
  },
  gridLabel: { fontSize: 11, fontFamily: fonts.bold, color: colors.text },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(30,27,46,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md },
  modalTitle: { fontSize: 17, fontFamily: fonts.extrabold, color: colors.text },
  modalInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 70,
    textAlignVertical: "top",
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  modalError: { color: colors.danger, fontSize: 13, fontFamily: fonts.semibold },
  modalActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modalCancel: { paddingHorizontal: spacing.md, paddingVertical: 12 },
  modalCancelText: { fontFamily: fonts.bold, color: colors.textMuted },
  sentWrap: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  sentText: { fontFamily: fonts.bold, color: colors.text, textAlign: "center" },
});
