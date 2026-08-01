import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useConversations, useGetOrCreateConversation } from "../../src/api/hooks";
import type { Conversation } from "../../src/api/types";
import { PrimaryButton, SecondaryButton } from "../../src/components/Buttons";
import { IconCircle } from "../../src/components/IconCircle";
import { PillBadge } from "../../src/components/PillBadge";
import { SectionHeader } from "../../src/components/SectionHeader";
import { Card, Loading, Screen } from "../../src/components/ui";
import { formatDate, formatTime } from "../../src/lib/stats";
import { useRefreshAll } from "../../src/lib/useRefreshAll";
import { useAuthStore } from "../../src/store/auth";
import { colors, fonts, radius, spacing } from "../../src/theme";

export default function ConversationsScreen() {
  const { t } = useTranslation();
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
          <View style={styles.buttonRow}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Chat with Teacher"
                icon="chatbubbles-outline"
                loading={startConv.isPending}
                onPress={handleStartTeacherChat}
              />
            </View>
            <View style={{ flex: 1 }}>
              <SecondaryButton
                label="Chat with Admin"
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
          <IconCircle name="chatbubble-ellipses-outline" accent="neutral" size={48} />
          <Text style={styles.emptyText}>No conversation history yet.</Text>
        </Card>
      ) : (
        convs.map((c) => {
          const name = getRecipientName(c);
          return (
            <Pressable key={c.id} onPress={() => router.push(`/chat/${c.id}`)}>
              <Card style={styles.convCard}>
                <IconCircle
                  name={c.type === "parent_admin" ? "shield-checkmark" : "person"}
                  accent={c.type === "parent_admin" ? "primary" : "activity"}
                  size={44}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{name}</Text>
                    {c.unread_count && c.unread_count > 0 ? (
                      <PillBadge label={`${c.unread_count} new`} accent="danger" />
                    ) : null}
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {c.last_message_preview || "No messages yet"}
                  </Text>
                  {c.last_message_at ? (
                    <Text style={styles.time}>
                      {formatDate(c.last_message_at)} · {formatTime(c.last_message_at)}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionCard: { gap: spacing.sm, backgroundColor: "#f0f9ff", borderColor: "#bae6fd" },
  actionTitle: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  buttonRow: { flexDirection: "row", gap: spacing.sm },
  emptyCard: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { fontFamily: fonts.semibold, color: colors.textMuted },
  convCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  preview: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted },
  time: { fontSize: 11, fontFamily: fonts.semibold, color: colors.textMuted, marginTop: 2 },
});
