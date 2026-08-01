import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMessages, useSendMessage } from "../../src/api/hooks";
import type { ChatMessage } from "../../src/api/types";
import { IconCircle } from "../../src/components/IconCircle";
import { Loading, Screen } from "../../src/components/ui";
import { formatTime } from "../../src/lib/stats";
import { useAuthStore } from "../../src/store/auth";
import { colors, fonts, radius, spacing } from "../../src/theme";

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [text, setText] = useState("");
  const messagesQuery = useMessages(conversationId);
  const sendMsg = useSendMessage(conversationId);
  const flatListRef = useRef<FlatList>(null);

  if (messagesQuery.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const messages = messagesQuery.data ?? [];

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
      }
    );
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMine = item.sender_user_id === user?.id;
    return (
      <View style={[styles.bubbleWrap, isMine ? styles.myWrap : styles.theirWrap]}>
        {!isMine && (
          <Text style={styles.senderName}>{item.sender_user?.name || "User"}</Text>
        )}
        <View style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.bodyText, isMine ? styles.myText : styles.theirText]}>
            {item.body}
          </Text>
          <Text style={[styles.timeText, isMine ? styles.myTime : styles.theirTime]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <Pressable
            style={[styles.sendButton, !text.trim() && styles.disabledSend]}
            onPress={handleSend}
            disabled={!text.trim() || sendMsg.isPending}
          >
            <IconCircle name="send" accent="primary" size={36} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  bubbleWrap: { marginVertical: 4, maxWidth: "80%" },
  myWrap: { alignSelf: "flex-end" },
  theirWrap: { alignSelf: "flex-start" },
  senderName: { fontSize: 11, fontFamily: fonts.bold, color: colors.textMuted, marginBottom: 2, marginLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  myBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 2 },
  bodyText: { fontSize: 15, fontFamily: fonts.semibold },
  myText: { color: "#ffffff" },
  theirText: { color: colors.text },
  timeText: { fontSize: 10, fontFamily: fonts.semibold, alignSelf: "flex-end", marginTop: 4 },
  myTime: { color: "rgba(255,255,255,0.7)" },
  theirTime: { color: colors.textMuted },
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
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    maxHeight: 100,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: { justifyContent: "center", alignItems: "center" },
  disabledSend: { opacity: 0.4 },
});
