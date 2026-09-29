import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useConversations, useGetOrCreateConversation } from "../../src/api/hooks";
import type { Conversation } from "../../src/api/types";
import { GhostButton, PrimaryButton } from "../../src/components/Buttons";
import { SectionHeader } from "../../src/components/SectionHeader";
import { Card, Loading, Screen } from "../../src/components/ui";
import { addDays, isSameDay } from "../../src/lib/stats";
import { useRefreshAll } from "../../src/lib/useRefreshAll";
import { useAuthStore } from "../../src/store/auth";
import { accents, colors, fonts, spacing } from "../../src/theme";
import { Tap } from "../../src/components/Tap";

/** "2:30 PM" today, "Yesterday", or a short date further back. */
function relativeStamp(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  if (isSameDay(d, addDays(now, -1))) return "Yesterday";
  return d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

export default function ConversationsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const convsQuery = useConversations();
  const startConv = useGetOrCreateConversation();
  const { refreshing, onRefresh } = useRefreshAll(convsQuery);

  if (convsQuery.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const convs = convsQuery.data ?? [];

  const handleStartAdminChat = () => {
    startConv.mutate(
      { type: "parent_admin" },
      {
        onSuccess: (c) => {
          router.push(`/chat/${c.id}`);
        },
      }
    );
  };

  const handleStartTeacherChat = () => {
    startConv.mutate(
      { type: "parent_teacher" },
      {
        onSuccess: (c) => {
          router.push(`/chat/${c.id}`);
        },
      }
    );
  };

  const getRecipientName = (c: Conversation) => {
    if (user?.role === "parent") {
      return c.type === "parent_admin"
        ? "Nursery Administration"
        : c.recipient_user?.name || "Teacher";
    }
    return c.parent_user?.name || "Parent";
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {user?.role === "parent" && (
        <Card style={styles.actionCard}>
          <Text style={styles.actionTitle}>Start a Conversation</Text>
          <Text style={styles.actionSubtitle}>Reach out to your child's teacher or the nursery office.</Text>
          <View style={styles.buttonRow}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Teacher"
                icon="chatbubbles-outline"
                loading={startConv.isPending}
                onPress={handleStartTeacherChat}
              />
            </View>
            <View style={{ flex: 1 }}>
              <GhostButton
                label="Admin"
                icon="shield-checkmark-outline"
                loading={startConv.isPending}
                onPress={handleStartAdminChat}
              />
            </View>
          </View>
        </Card>
      )}

      <SectionHeader title="Your Messages" />

      {convs.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>💬</Text>
          </View>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Start one above to get in touch.</Text>
        </Card>
      ) : (
        convs.map((c) => {
          const name = getRecipientName(c);
          const isAdmin = c.type === "parent_admin";
          const accent = isAdmin ? accents.secondary : accents.primary;
          const hasUnread = !!c.unread_count && c.unread_count > 0;
          return (
            <Tap
              key={c.id}
              onPress={() => router.push(`/chat/${c.id}`)}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Card style={hasUnread ? [styles.convCard, styles.convCardUnread] : styles.convCard}>
                <View style={[styles.avatar, { backgroundColor: accent.tint }]}>
                  <Text style={[styles.avatarText, { color: accent.dark }]}>{initials(name)}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: accent.main }]}>
                    <Text style={styles.roleBadgeIcon}>{isAdmin ? "🛡" : "🎓"}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
                      {name}
                    </Text>
                    {c.last_message_at && (
                      <Text style={[styles.time, hasUnread && styles.timeUnread]}>
                        {relativeStamp(c.last_message_at, i18n.language)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
                      {c.last_message_preview || "No messages yet"}
                    </Text>
                    {hasUnread && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {c.unread_count! > 9 ? "9+" : c.unread_count}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Card>
            </Tap>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionCard: { gap: 4, backgroundColor: "#f0f9ff", borderColor: "#bae6fd" },
  actionTitle: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  actionSubtitle: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textMuted, marginBottom: spacing.xs },
  buttonRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  emptyCard: { alignItems: "center", paddingVertical: spacing.xl, gap: 4 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  emptyIconText: { fontSize: 26 },
  emptyText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  emptySubtext: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  pressed: { opacity: 0.7 },
  convCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  convCardUnread: { borderColor: colors.primary + "40", backgroundColor: colors.primaryLight },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontFamily: fonts.extrabold },
  roleBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.card,
  },
  roleBadgeIcon: { fontSize: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  name: { fontSize: 15, fontFamily: fonts.bold, color: colors.text, flexShrink: 1 },
  nameUnread: { fontFamily: fonts.extrabold },
  time: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted },
  timeUnread: { color: colors.primary, fontFamily: fonts.bold },
  previewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  preview: { flex: 1, fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  previewUnread: { color: colors.text, fontFamily: fonts.bold },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.white },
});
