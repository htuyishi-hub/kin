import { Feather } from "@expo/vector-icons";
import {
  useGetMatch,
  useGetMessages,
  useMarkPhaseComplete,
  useSendMessage,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const PHASE_LABELS = ["", "Values", "Vision", "Free"];
const PHASE_SUBTITLES = [
  "",
  "Share what you value in life and relationships.",
  "Share your hopes for the future.",
  "The conversation is yours now.",
];

type MessageItem = {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  phase: number;
  promptKey: string | null;
  isSystem: boolean;
  readAt: string | null;
  createdAt: string;
};

function useMatchWebSocket(matchId: string, token: string | null) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;

    const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
    const wsUrl = `wss://${domain}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token }));
        ws.send(JSON.stringify({ type: "subscribe", matchId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; message?: MessageItem };
          if (msg.type === "new_message" && msg.message) {
            const incoming = msg.message;
            // Append to React Query cache without triggering a network refetch
            queryClient.setQueryData<MessageItem[]>(
              ["getMessages", matchId],
              (prev) => {
                if (!prev) return [incoming];
                // Deduplicate by id
                const exists = prev.some((m) => m.id === incoming.id);
                if (exists) return prev;
                return [...prev, incoming];
              }
            );
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (mountedRef.current) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not available (web dev mode etc.) — polling fallback active
    }
  }, [matchId, token, queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}

export default function MatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { userId, token } = useAuth();

  const [content, setContent] = useState("");
  const flatRef = useRef<FlatList>(null);

  useMatchWebSocket(String(matchId), token);

  const { data: match, isLoading: matchLoading } = useGetMatch(String(matchId), {
    query: { refetchInterval: 10000 } as any,
  });
  const { data: messages = [], refetch: refetchMessages } = useGetMessages(
    String(matchId),
    {},
    { query: { refetchInterval: 5000 } as any },
  );

  const { mutate: sendMessage, isPending: isSending } = useSendMessage({
    mutation: {
      onSuccess: () => {
        setContent("");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        refetchMessages();
      },
    },
  });

  const { mutate: markPhaseComplete, isPending: isPhasing } = useMarkPhaseComplete({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  function handleSend() {
    if (!content.trim()) return;
    sendMessage({ matchId: String(matchId), data: { content: content.trim() } });
  }

  if (matchLoading || !match) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const phase = match.conversationPhase ?? 1;
  const canSendFirst = !match.firstMessageSent && match.assignedFirstUserId === userId;
  const isMyTurnFirst = !match.firstMessageSent && match.assignedFirstUserId !== userId;
  const paddingTop = isWeb ? 67 : insets.top;
  const paddingBottom = isWeb ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: paddingTop + 12, borderBottomColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.foreground }]}>
            {match.otherUserName}
          </Text>
          <View style={[styles.phasePill, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.phaseText, { color: colors.primary }]}>
              Phase {phase}: {PHASE_LABELS[phase]}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.phaseBtn, { backgroundColor: colors.secondary }]}
          onPress={() => markPhaseComplete({ matchId: String(matchId) })}
          disabled={isPhasing || match.myPhaseComplete}
        >
          {isPhasing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather
              name="check"
              size={18}
              color={match.myPhaseComplete ? colors.accent : colors.mutedForeground}
            />
          )}
        </TouchableOpacity>
      </View>

      {phase <= 2 && (
        <View style={[styles.phaseGuide, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
          <Text style={[styles.phaseGuideText, { color: colors.mutedForeground }]}>
            {PHASE_SUBTITLES[phase]}
          </Text>
        </View>
      )}

      {messages.length === 0 && !match.firstMessageSent && (
        <View style={[styles.intro, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Text style={[styles.introTitle, { color: colors.foreground }]}>
            You have been introduced
          </Text>
          <Text style={[styles.introBody, { color: colors.mutedForeground }]}>
            {canSendFirst
              ? "The system has assigned you to send the first message."
              : "The system has assigned the other person to send the first message. Wait for them."}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={[...messages].reverse()}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isMe = item.senderId === userId;
            return (
              <View
                style={[
                  styles.bubble,
                  isMe
                    ? [styles.bubbleMe, { backgroundColor: colors.primary }]
                    : [styles.bubbleThem, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
              >
                {item.promptKey && (
                  <Text style={[styles.bubblePrompt, { color: isMe ? colors.primaryForeground : colors.mutedForeground, opacity: 0.7 }]}>
                    Prompt
                  </Text>
                )}
                <Text
                  style={[
                    styles.bubbleText,
                    { color: isMe ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {item.content}
                </Text>
              </View>
            );
          }}
        />

        <View
          style={[
            styles.inputBar,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.card,
              paddingBottom: paddingBottom + 8,
            },
          ]}
        >
          {isMyTurnFirst ? (
            <View style={styles.waitRow}>
              <Feather name="clock" size={16} color={colors.mutedForeground} />
              <Text style={[styles.waitText, { color: colors.mutedForeground }]}>
                Waiting for them to send the first message
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Write something sincere..."
                placeholderTextColor={colors.mutedForeground}
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={1000}
                returnKeyType="default"
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: isSending || !content.trim() ? 0.5 : 1 }]}
                onPress={handleSend}
                disabled={isSending || !content.trim()}
                activeOpacity={0.85}
              >
                {isSending ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <Feather name="send" size={18} color={colors.primaryForeground} />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1, gap: 4 },
  headerName: { fontFamily: "Inter_700Bold", fontSize: 18 },
  phasePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
  },
  phaseText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  phaseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  phaseGuide: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  phaseGuideText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  intro: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  introTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  introBody: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  bubble: {
    maxWidth: "78%",
    padding: 12,
    borderRadius: 18,
    gap: 3,
  },
  bubbleMe: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1 },
  bubblePrompt: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.5 },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  waitRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14 },
  waitText: { fontFamily: "Inter_400Regular", fontSize: 14, flex: 1 },
});
