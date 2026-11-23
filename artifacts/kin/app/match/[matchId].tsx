import { Feather } from "@expo/vector-icons";
import {
  useGetMatch,
  useGetMessages,
  useMarkPhaseComplete,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useTranslation } from "@workspace/i18n";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { getVoiceSignedUrl } from "@/services/voiceIntroService";
import { encryptMessage, decryptMessage } from "@/services/e2eeService";

type MessageItem = {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  phase: number;
  promptKey?: string | null;
  promptText?: string | null;
  isSystem: boolean;
  readAt?: string | null;
  createdAt: string;
};

type OptimisticMessage = MessageItem & {
  status: "sending" | "sent" | "failed";
  localPlaintext: string;
};

function getDateKey(isoDateStr: string): string {
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateDivider(isoDateStr: string, t: (key: string) => string): string {
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  const dateKey = getDateKey(isoDateStr);
  if (dateKey === todayKey) return t("matches.today");
  if (dateKey === yesterdayKey) return t("matches.yesterday");

  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatMessageTime(isoDateStr: string): string {
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MatchVoicePlayer({
  path,
  durationMs,
  colors,
}: {
  path: string;
  durationMs?: number | null;
  colors: any;
}) {
  const { t } = useTranslation();
  const [audioUri, setAudioUri] = useState<string | null>(() => {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return null;
  });

  const loadVoice = async (forceRefresh = false) => {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      setAudioUri(path);
      return;
    }
    const signed = await getVoiceSignedUrl(path, forceRefresh);
    if (signed) setAudioUri(signed);
  };

  useEffect(() => {
    loadVoice();
  }, [path]);

  const player = useAudioPlayer(audioUri);
  const status = useAudioPlayerStatus(player);
  const isPlaying = Boolean(status.playing);

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      if (!audioUri) {
        loadVoice(true).then(() => player.play());
      } else {
        player.play();
      }
    }
  };

  const seconds = durationMs ? Math.round(durationMs / 1000) : Math.round(status.duration || 5);

  return (
    <TouchableOpacity
      style={[styles.voiceHeaderPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}
      onPress={togglePlay}
      activeOpacity={0.8}
    >
      <Feather name={isPlaying ? "pause" : "play"} size={13} color={colors.primary} />
      <Feather name="volume-2" size={13} color={colors.mutedForeground} />
      <Text style={[styles.voiceHeaderText, { color: colors.foreground }]}>
        {t("profile.voiceDuration", { seconds: Math.max(1, seconds) })}
      </Text>
    </TouchableOpacity>
  );
}

function useMatchWebSocket(matchId: string, token: string | null, onNewIncoming?: () => void) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [isConnected, setIsConnected] = useState(true);

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;

    const apiBaseUrl =
      process.env.EXPO_PUBLIC_API_URL ??
      process.env.VITE_API_URL ??
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "https://kin-x81d.onrender.com");

    const wsUrl = apiBaseUrl.replace(/^http/, "ws") + "/ws";

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(JSON.stringify({ type: "auth", token }));
        ws.send(JSON.stringify({ type: "subscribe", matchId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; message?: MessageItem };
          if (msg.type === "new_message" && msg.message) {
            const incoming = msg.message;
            onNewIncoming?.();
            queryClient.setQueryData<MessageItem[]>(
              ["getMessages", matchId],
              (prev) => {
                if (!prev) return [incoming];
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
        setIsConnected(false);
        wsRef.current = null;
        if (mountedRef.current) {
          reconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, [matchId, token, queryClient, onNewIncoming]);

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

  return { isConnected };
}

type ListItem =
  | {
      type: "date_divider";
      id: string;
      text: string;
    }
  | {
      type: "message";
      id: string;
      message: MessageItem & { status?: "sending" | "sent" | "failed"; localPlaintext?: string };
      isLastInGroup: boolean;
      timeText: string;
    };

export default function MatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { userId, token } = useAuth();
  const { t } = useTranslation();

  const phaseLabels: Record<number, string> = {
    1: t("matches.phaseValues"),
    2: t("matches.phaseVision"),
    3: t("matches.phaseFreeTalk"),
  };

  const [content, setContent] = useState("");
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const handleIncomingMessage = useCallback(() => {
    if (!isNearBottom) {
      setShowNewMessagesPill(true);
    }
  }, [isNearBottom]);

  const { isConnected } = useMatchWebSocket(String(matchId), token, handleIncomingMessage);

  const { data: match, isLoading: matchLoading } = useGetMatch(String(matchId), {
    query: { refetchInterval: 10000 } as any,
  });
  const { data: messages = [], refetch: refetchMessages } = useGetMessages(
    String(matchId),
    {},
    { query: { refetchInterval: 5000 } as any },
  );

  useEffect(() => {
    let isMounted = true;
    async function decryptAll() {
      const updates: Record<string, string> = {};
      for (const m of messages) {
        if (m.content && !decryptedMap[m.id]) {
          updates[m.id] = await decryptMessage(m.content, String(matchId));
        }
      }
      if (isMounted && Object.keys(updates).length > 0) {
        setDecryptedMap((prev) => ({ ...prev, ...updates }));
      }
    }
    if (messages.length > 0) {
      decryptAll();
    }
    return () => {
      isMounted = false;
    };
  }, [messages, matchId]);

  const { mutate: markPhaseComplete, isPending: isPhasing } = useMarkPhaseComplete({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    },
  });

  const phase = match?.conversationPhase ?? 1;

  async function handleSendMessage(textToSend?: string, retryLocalId?: string) {
    const raw = (textToSend ?? content).trim();
    if (!raw) return;

    const localId = retryLocalId || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tempMsg: OptimisticMessage = {
      id: localId,
      matchId: String(matchId),
      senderId: userId || "me",
      content: raw,
      localPlaintext: raw,
      phase,
      promptKey: null,
      isSystem: false,
      readAt: null,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    if (retryLocalId) {
      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === retryLocalId ? { ...m, status: "sending" } : m))
      );
    } else {
      setContent("");
      setOptimisticMessages((prev) => [...prev, tempMsg]);
    }

    try {
      const encrypted = await encryptMessage(raw, String(matchId));
      const apiBaseUrl =
        process.env.EXPO_PUBLIC_API_URL ??
        process.env.VITE_API_URL ??
        (process.env.EXPO_PUBLIC_DOMAIN
          ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
          : "https://kin-x81d.onrender.com");

      const res = await fetch(`${apiBaseUrl}/api/matches/${matchId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: encrypted }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const savedMessage = await res.json();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, id: savedMessage.id, status: "sent" } : m))
      );
      refetchMessages();
    } catch {
      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, status: "failed" } : m))
      );
    }
  }

  // Combined messages
  const combinedMessages = useMemo(() => {
    const serverIds = new Set(messages.map((m) => m.id));
    const pendingOptimistic = optimisticMessages.filter((m) => !serverIds.has(m.id));
    return [
      ...messages.map((m) => ({ ...m, status: "sent" as const })),
      ...pendingOptimistic,
    ];
  }, [messages, optimisticMessages]);

  const listItems: ListItem[] = useMemo(() => {
    if (combinedMessages.length === 0) return [];

    const sorted = [...combinedMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const items: ListItem[] = [];
    let lastDateKey = "";

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const dateKey = getDateKey(m.createdAt);

      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        items.push({
          type: "date_divider",
          id: `divider-${dateKey}-${i}`,
          text: formatDateDivider(m.createdAt, t),
        });
      }

      const next = sorted[i + 1];
      const isLastInGroup =
        !next ||
        next.senderId !== m.senderId ||
        Math.abs(new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime()) > 120000 ||
        getDateKey(next.createdAt) !== dateKey;

      items.push({
        type: "message",
        id: m.id,
        message: m,
        isLastInGroup,
        timeText: formatMessageTime(m.createdAt),
      });
    }

    return items.reverse();
  }, [combinedMessages, t]);

  if (matchLoading || !match) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

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
          <View style={styles.headerNameRow}>
            <Text style={[styles.headerName, { color: colors.foreground }]}>
              {match.otherUserName}
            </Text>
            {!!(match as any).otherUser?.voiceIntroPath && (
              <MatchVoicePlayer
                path={(match as any).otherUser.voiceIntroPath}
                durationMs={(match as any).otherUser.voiceIntroDurationMs}
                colors={colors}
              />
            )}
          </View>
          <View style={styles.subHeaderRow}>
            <View style={[styles.phasePill, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.phaseText, { color: colors.primary }]}>
                {t("matches.phase", { phase })}: {phaseLabels[phase] ?? ""}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.phaseBtn,
            {
              backgroundColor: match.myPhaseComplete ? colors.accent + "22" : colors.secondary,
              borderColor: match.myPhaseComplete ? colors.accent : colors.border,
              borderWidth: 1,
            },
          ]}
          onPress={() => markPhaseComplete({ matchId: String(matchId) })}
          disabled={isPhasing || match.myPhaseComplete}
          accessibilityLabel={match.myPhaseComplete ? t("matches.phaseCompleted") : t("matches.completePhase")}
          accessibilityHint={t("matches.completePhase")}
          accessibilityRole="button"
        >
          {isPhasing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather
              name={match.myPhaseComplete ? "check-circle" : "check"}
              size={18}
              color={match.myPhaseComplete ? colors.accent : colors.mutedForeground}
            />
          )}
        </TouchableOpacity>
      </View>

      {!isConnected && (
        <View style={[styles.reconnectingBar, { backgroundColor: colors.secondary, borderBottomColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.7 }] }} />
          <Text style={[styles.reconnectingText, { color: colors.mutedForeground }]}>
            {t("matches.reconnecting")}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, position: "relative" }}>
          <FlatList
            ref={flatRef}
            data={listItems}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              const offsetY = e.nativeEvent.contentOffset.y;
              const near = offsetY < 120;
              setIsNearBottom(near);
              if (near) setShowNewMessagesPill(false);
            }}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Feather name="message-circle" size={40} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {t("matches.noMessages")}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.type === "date_divider") {
                return (
                  <View style={styles.dateDividerRow}>
                    <View style={[styles.dateDividerPill, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.dateDividerText, { color: colors.mutedForeground }]}>
                        {item.text}
                      </Text>
                    </View>
                  </View>
                );
              }

              const isMe = item.message.senderId === userId || item.message.senderId === "me";
              const textContent =
                item.message.localPlaintext ??
                decryptedMap[item.message.id] ??
                (item.message.content.startsWith("e2ee:v1:") ? "..." : item.message.content);

              return (
                <View style={[styles.messageRow, { marginBottom: item.isLastInGroup ? 8 : 2 }]}>
                  <View
                    style={[
                      styles.bubble,
                      isMe
                        ? [styles.bubbleMe, { backgroundColor: colors.primary }]
                        : [styles.bubbleThem, { backgroundColor: colors.card, borderColor: colors.border }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isMe ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {textContent}
                    </Text>
                  </View>

                  {item.isLastInGroup && (
                    <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowThem]}>
                      <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
                        {item.timeText}
                      </Text>
                      {isMe && (
                        <View style={styles.statusIconWrap}>
                          {item.message.status === "sending" ? (
                            <Feather name="clock" size={11} color={colors.mutedForeground} />
                          ) : item.message.status === "failed" ? (
                            <TouchableOpacity
                              onPress={() =>
                                handleSendMessage(
                                  item.message.localPlaintext || item.message.content,
                                  item.message.id
                                )
                              }
                              style={styles.retryBtn}
                              accessibilityLabel={t("matches.retry")}
                            >
                              <Feather name="alert-circle" size={13} color="#EF4444" />
                            </TouchableOpacity>
                          ) : (
                            <Feather name="check" size={13} color={colors.mutedForeground} />
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            }}
          />

          {showNewMessagesPill && (
            <TouchableOpacity
              style={[styles.newMessagesPill, { backgroundColor: colors.primary }]}
              onPress={() => {
                flatRef.current?.scrollToOffset({ offset: 0, animated: true });
                setShowNewMessagesPill(false);
              }}
              activeOpacity={0.85}
            >
              <Feather name="arrow-down" size={14} color={colors.primaryForeground} />
              <Text style={[styles.newMessagesPillText, { color: colors.primaryForeground }]}>
                {t("matches.newMessages")}
              </Text>
            </TouchableOpacity>
          )}
        </View>

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
                {t("matches.waitingFirstMessage")}
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={t("matches.typeMessage")}
                placeholderTextColor={colors.mutedForeground}
                value={content}
                onChangeText={setContent}
                multiline
                maxLength={1000}
                blurOnSubmit={false}
                returnKeyType="default"
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: !content.trim() ? 0.4 : 1,
                  },
                ]}
                onPress={() => handleSendMessage()}
                disabled={!content.trim()}
                activeOpacity={0.85}
              >
                <Feather name="send" size={18} color={colors.primaryForeground} />
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
  headerNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerName: { fontFamily: "Inter_700Bold", fontSize: 18 },
  voiceHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  voiceHeaderText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  phasePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
  },
  subHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 2,
  },
  phaseText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  phaseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  reconnectingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  reconnectingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  dateDividerRow: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateDividerPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateDividerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  messageRow: {},
  bubble: {
    maxWidth: "78%",
    padding: 12,
    borderRadius: 18,
  },
  bubbleMe: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  metaRowMe: {
    alignSelf: "flex-end",
    marginRight: 4,
  },
  metaRowThem: {
    alignSelf: "flex-start",
    marginLeft: 4,
  },
  timeText: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
  statusIconWrap: {
    marginLeft: 2,
  },
  retryBtn: {
    padding: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 10,
    transform: [{ scaleY: -1 }], // Counteract inverted FlatList so empty state is right side up
  },
  emptyText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  newMessagesPill: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  newMessagesPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
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
    minHeight: 40,
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
