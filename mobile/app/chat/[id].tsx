import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMarkConversationRead, useMessages, useSendMessage } from "../../src/api/hooks";
import type { ChatMessage } from "../../src/api/types";
import { Loading, Screen } from "../../src/components/ui";
import { addDays, formatTime, isSameDay } from "../../src/lib/stats";
import { useAuthStore } from "../../src/store/auth";
import { colors, fonts, radius, spacing } from "../../src/theme";
import { Tap } from "../../src/components/Tap";

/** "Today" / "Yesterday" / short date, for the sticky separator between message groups. */
function dayLabel(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) return "Today";
  if (isSameDay(d, addDays(now, -1))) return "Yesterday";
  return d.toLocaleDateString(locale, { month: "long", day: "numeric" });
}

type Row =
  | { kind: "separator"; id: string; label: string }
  | { kind: "message"; id: string; message: ChatMessage; grouped: boolean };

/** Flattens messages into day separators + grouping ("grouped" hides repeated sender name/gap). */
function buildRows(messages: ChatMessage[], locale: string): Row[] {
  const rows: Row[] = [];
  let lastDay: string | null = null;
  let lastSender: number | null = null;
  for (const m of messages) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) {
      rows.push({ kind: "separator", id: `sep-${day}`, label: dayLabel(m.created_at, locale) });
      lastDay = day;
      lastSender = null;
    }
    rows.push({ kind: "message", id: String(m.id), message: m, grouped: lastSender === m.sender_user_id });
    lastSender = m.sender_user_id;
  }
  return rows;
}

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [text, setText] = useState("");
  const messagesQuery = useMessages(conversationId);
  const sendMsg = useSendMessage(conversationId);
  const markRead = useMarkConversationRead(conversationId);
  const flatListRef = useRef<FlatList>(null);

  // Clear the unread badge once the thread is open. Must run before the loading
  // early-return below, or the hook order changes between renders.
  const markReadMutate = markRead.mutate;
  useEffect(() => {
    if (conversationId > 0) markReadMutate();
  }, [conversationId, markReadMutate]);

  if (messagesQuery.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const messages = messagesQuery.data ?? [];
  const rows = buildRows(messages, i18n.language);
  const isSending = sendMsg.isPending;

  const handleSend = () => {
    if (!text.trim()) return;
    const body = text.trim();
    setText("");
    sendMsg.mutate(
      { body },
      {
        onSuccess: () => {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        },
        onError: () => {
          // Restore the draft so the user doesn't retype it after a failed send.
          setText(body);
        },
      }
    );
  };

  const renderRow = ({ item, index }: { item: Row; index: number }) => {
    if (item.kind === "separator") {
      return (
        <View style={styles.separatorRow}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorLabel}>{item.label}</Text>
          <View style={styles.separatorLine} />
        </View>
      );
    }

    const { message, grouped } = item;
    const isMine = message.sender_user_id === user?.id;
    const isLast = index === rows.length - 1;
    const showTail = !grouped;

    return (
      <View
        style={[
          styles.bubbleWrap,
          isMine ? styles.myWrap : styles.theirWrap,
          grouped ? styles.groupedSpacing : styles.newGroupSpacing,
        ]}
      >
        {!isMine && !grouped && (
          <Text style={styles.senderName}>{message.sender_user?.name || "User"}</Text>
        )}
        <View
          style={[
            styles.bubble,
            isMine ? styles.myBubble : styles.theirBubble,
            isMine && showTail && styles.myBubbleTail,
            !isMine && showTail && styles.theirBubbleTail,
          ]}
        >
          <Text style={[styles.bodyText, isMine ? styles.myText : styles.theirText]}>{message.body}</Text>
          <Text style={[styles.timeText, isMine ? styles.myTime : styles.theirTime]}>
            {formatTime(message.created_at, i18n.language)}
          </Text>
        </View>
        {isMine && isLast && isSending && <Text style={styles.sendingLabel}>Sending…</Text>}
      </View>
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1, marginHorizontal: -spacing.md, marginBottom: -spacing.md }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        {rows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👋</Text>
            <Text style={styles.emptyTitle}>Say hello</Text>
            <Text style={styles.emptySubtitle}>Send the first message to start this conversation.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <Tap
            style={[styles.sendButton, (!text.trim() || isSending) && styles.disabledSend]}
            onPress={handleSend}
            disabled={!text.trim() || isSending}
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </Tap>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  separatorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.sm },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorLabel: { fontSize: 11, fontFamily: fonts.extrabold, color: colors.textMuted },
  bubbleWrap: { maxWidth: "80%" },
  myWrap: { alignSelf: "flex-end" },
  theirWrap: { alignSelf: "flex-start" },
  groupedSpacing: { marginTop: 2 },
  newGroupSpacing: { marginTop: 10 },
  senderName: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, marginBottom: 2, marginLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  myBubble: { backgroundColor: colors.primary, borderBottomRightRadius: radius.lg },
  theirBubble: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: radius.lg },
  myBubbleTail: { borderBottomRightRadius: 4 },
  theirBubbleTail: { borderBottomLeftRadius: 4 },
  bodyText: { fontSize: 15, fontFamily: fonts.semibold },
  myText: { color: "#ffffff" },
  theirText: { color: colors.text },
  timeText: { fontSize: 10, fontFamily: fonts.semibold, alignSelf: "flex-end", marginTop: 4 },
  myTime: { color: "rgba(255,255,255,0.7)" },
  theirTime: { color: colors.textMuted },
  sendingLabel: {
    fontSize: 10,
    fontFamily: fonts.semibold,
    color: colors.textMuted,
    alignSelf: "flex-end",
    marginTop: 2,
    marginRight: 4,
  },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.xs },
  emptyTitle: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.text },
  emptySubtitle: { fontSize: 13, fontFamily: fonts.semibold, color: colors.textMuted, textAlign: "center" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    maxHeight: 100,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledSend: { opacity: 0.4 },
});
