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
  Modal,
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
  replyToId?: string | null;
  replyTo?: { id?: string; senderId?: string; content?: string } | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  deliveredAt?: string | null;
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

function MessageTicks({
  status,
  deliveredAt,
  readAt,
  onRetry,
}: {
  status?: "sending" | "sent" | "failed";
  deliveredAt?: string | null;
  readAt?: string | null;
  onRetry?: () => void;
}) {
  if (status === "failed") {
    return (
      <TouchableOpacity onPress={onRetry} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        <Feather name="alert-circle" size={13} color="#EF4444" />
      </TouchableOpacity>
    );
  }
  if (status === "sending") {
    return <Feather name="clock" size={11} color="#94A3B8" />;
  }
  if (readAt) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Feather name="check" size={12} color="#22C55E" />
        <Feather name="check" size={12} color="#22C55E" style={{ marginLeft: -6 }} />
      </View>
    );
  }
  if (deliveredAt) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Feather name="check" size={12} color="#94A3B8" />
        <Feather name="check" size={12} color="#94A3B8" style={{ marginLeft: -6 }} />
      </View>
    );
  }
  return <Feather name="check" size={12} color="#94A3B8" />;
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

  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  const togglePlay = async () => {
    if (!audioUri) {
      await loadVoice(true);
    }
    if (!player) return;
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const seconds = Math.round((durationMs || 5000) / 1000);

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

function useMatchWebSocket(
  matchId: string,
  token: string | null,
  userId: string | null,
  onNewIncoming?: () => void,
  onTyping?: (typingUserId: string) => void
) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const [isConnected, setIsConnected] = useState(true);

  const sendWsMessage = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

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
        ws.send(JSON.stringify({ type: "delivered", matchId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<string, any>;
          if (msg.type === "new_message" && msg.message) {
            const incoming = msg.message as MessageItem;
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
            if (incoming.senderId !== userId) {
              fetch(`${apiBaseUrl}/api/matches/${matchId}/read`, {
                method: "POST",
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              }).catch(() => {});
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "delivered", matchId }));
              }
            }
          } else if (msg.type === "typing" && msg.matchId === matchId && msg.userId !== userId) {
            onTyping?.(msg.userId);
          } else if (msg.type === "messages_delivered" && msg.matchId === matchId) {
            queryClient.setQueryData<MessageItem[]>(
              ["getMessages", matchId],
              (prev) =>
                prev?.map((m) =>
                  m.senderId === userId && !m.deliveredAt ? { ...m, deliveredAt: msg.deliveredAt } : m
                )
            );
          } else if (msg.type === "messages_read" && msg.matchId === matchId) {
            queryClient.setQueryData<MessageItem[]>(
              ["getMessages", matchId],
              (prev) =>
                prev?.map((m) =>
                  m.senderId === userId && !m.readAt
                    ? { ...m, readAt: msg.readAt, deliveredAt: m.deliveredAt || msg.readAt }
                    : m
                )
            );
          } else if (msg.type === "message_edited" && msg.message && msg.message.matchId === matchId) {
            const updated = msg.message;
            queryClient.setQueryData<MessageItem[]>(
              ["getMessages", matchId],
              (prev) => prev?.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
            );
          } else if (msg.type === "message_deleted" && msg.matchId === matchId) {
            queryClient.setQueryData<MessageItem[]>(
              ["getMessages", matchId],
              (prev) =>
                prev?.map((m) =>
                  m.id === msg.messageId
                    ? { ...m, deletedAt: msg.deletedAt || new Date().toISOString(), content: "" }
                    : m
                )
            );
          } else if (msg.type === "phase_updated" && msg.match) {
            queryClient.setQueryData(["getMatch", matchId], msg.match);
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
  }, [matchId, token, userId, queryClient, onNewIncoming, onTyping]);

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

  return { isConnected, sendWsMessage };
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

  // Part 2 state: replies, edits, actions, reporting, typing
  const [replyingToMessage, setReplyingToMessage] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [actionTargetMessage, setActionTargetMessage] = useState<MessageItem | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>("harassment");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const flatRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const handleIncomingMessage = useCallback(() => {
    if (!isNearBottom) {
      setShowNewMessagesPill(true);
    }
  }, [isNearBottom]);

  const handleTypingEvent = useCallback((typingUserId: string) => {
    if (typingUserId !== userId) {
      setIsOtherTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setIsOtherTyping(false), 3500);
    }
  }, [userId]);

  const { isConnected, sendWsMessage } = useMatchWebSocket(
    String(matchId),
    token,
    userId ?? null,
    handleIncomingMessage,
    handleTypingEvent
  );

  const { data: match, isLoading: matchLoading } = useGetMatch(String(matchId), {
    query: { refetchInterval: 10000 } as any,
  });
  const { data: messages = [], refetch: refetchMessages } = useGetMessages(
    String(matchId),
    {},
    { query: { refetchInterval: 5000 } as any },
  );

  // Acknowledge read receipt on mount
  useEffect(() => {
    if (!token || !matchId) return;
    const apiBaseUrl =
      process.env.EXPO_PUBLIC_API_URL ??
      process.env.VITE_API_URL ??
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "https://kin-x81d.onrender.com");

    fetch(`${apiBaseUrl}/api/matches/${matchId}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [matchId, token]);

  useEffect(() => {
    let isMounted = true;
    async function decryptAll() {
      const updates: Record<string, string> = {};
      for (const m of messages) {
        if (m.content && !decryptedMap[m.id] && !m.deletedAt) {
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

    const apiBaseUrl =
      process.env.EXPO_PUBLIC_API_URL ??
      process.env.VITE_API_URL ??
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "https://kin-x81d.onrender.com");

    // Handle Edit Mode
    if (editingMessage) {
      const msgId = editingMessage.id;
      setEditingMessage(null);
      setContent("");

      try {
        const encrypted = await encryptMessage(raw, String(matchId));
        await fetch(`${apiBaseUrl}/api/messages/${msgId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content: encrypted }),
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refetchMessages();
      } catch {
        // non-fatal
      }
      return;
    }

    const currentReply = replyingToMessage;
    setReplyingToMessage(null);

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
      replyToId: currentReply?.id ?? null,
      replyTo: currentReply
        ? {
            id: currentReply.id,
            senderId: currentReply.senderId,
            content: decryptedMap[currentReply.id] || currentReply.content,
          }
        : null,
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
      const res = await fetch(`${apiBaseUrl}/api/matches/${matchId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          content: encrypted,
          replyToId: currentReply?.id ?? null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const savedMessage = await res.json();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.id === localId
            ? { ...m, id: savedMessage.id, status: "sent", replyTo: tempMsg.replyTo }
            : m
        )
      );
      refetchMessages();
    } catch {
      setOptimisticMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, status: "failed" } : m))
      );
    }
  }

  const handleDeleteMessage = async (msgId: string) => {
    setActionTargetMessage(null);
    const apiBaseUrl =
      process.env.EXPO_PUBLIC_API_URL ??
      process.env.VITE_API_URL ??
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "https://kin-x81d.onrender.com");

    try {
      await fetch(`${apiBaseUrl}/api/messages/${msgId}`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchMessages();
    } catch {}
  };

  const handleSubmitReport = async () => {
    if (!match) return;
    setIsSubmittingReport(true);
    const apiBaseUrl =
      process.env.EXPO_PUBLIC_API_URL ??
      process.env.VITE_API_URL ??
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "https://kin-x81d.onrender.com");

    try {
      await fetch(`${apiBaseUrl}/api/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          reportedUserId: match.otherUserId,
          matchId: String(matchId),
          reason: reportReason,
        }),
      });
      setReportSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setReportModalOpen(false);
        setReportSuccess(false);
        setIsSubmittingReport(false);
      }, 1500);
    } catch {
      setIsSubmittingReport(false);
    }
  };

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
            {isOtherTyping ? (
              <View style={styles.typingIndicatorRow}>
                <View style={[styles.typingDot, { backgroundColor: "#22C55E" }]} />
                <Text style={[styles.typingText, { color: "#22C55E" }]}>
                  {t("chat.typing")}
                </Text>
              </View>
            ) : (
              <View style={[styles.phasePill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.phaseText, { color: colors.primary }]}>
                  {t("matches.phase", { phase })}: {phaseLabels[phase] ?? ""}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.headerActionsRow}>
          {/* Report Button in Header */}
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => setReportModalOpen(true)}
            accessibilityLabel={t("chat.report")}
            accessibilityRole="button"
          >
            <Feather name="flag" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Phase Completion Button */}
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
              const isDeleted = Boolean(item.message.deletedAt);
              const textContent = isDeleted
                ? t("chat.deletedMessage")
                : item.message.localPlaintext ??
                  decryptedMap[item.message.id] ??
                  (item.message.content.startsWith("e2ee:v1:") ? "..." : item.message.content);

              return (
                <View style={[styles.messageRow, { marginBottom: item.isLastInGroup ? 8 : 2 }]}>
                  <TouchableOpacity
                    onLongPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setActionTargetMessage(item.message);
                    }}
                    activeOpacity={0.88}
                    style={[
                      styles.bubble,
                      isMe
                        ? [styles.bubbleMe, { backgroundColor: colors.primary }]
                        : [styles.bubbleThem, { backgroundColor: colors.card, borderColor: colors.border }],
                      isDeleted && styles.bubbleDeleted,
                    ]}
                  >
                    {!isDeleted && item.message.replyTo && (
                      <View
                        style={[
                          styles.quotedBubble,
                          {
                            borderLeftColor: isMe ? colors.primaryForeground : colors.primary,
                            backgroundColor: isMe ? "rgba(0,0,0,0.18)" : colors.secondary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.quotedSender,
                            { color: isMe ? colors.primaryForeground : colors.primary },
                          ]}
                        >
                          {item.message.replyTo.senderId === userId
                            ? t("chat.replyingTo")
                            : t("chat.reply")}
                        </Text>
                        <Text
                          style={[
                            styles.quotedText,
                            { color: isMe ? colors.primaryForeground : colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {item.message.replyTo.content || t("chat.deletedMessage")}
                        </Text>
                      </View>
                    )}

                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isMe ? colors.primaryForeground : colors.foreground },
                        isDeleted && styles.bubbleTextDeleted,
                      ]}
                    >
                      {textContent}
                    </Text>
                  </TouchableOpacity>

                  {item.isLastInGroup && (
                    <View style={[styles.metaRow, isMe ? styles.metaRowMe : styles.metaRowThem]}>
                      <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
                        {item.timeText}
                      </Text>
                      {item.message.editedAt && !isDeleted && (
                        <Text style={[styles.editedIndicator, { color: colors.mutedForeground }]}>
                          ({t("chat.edited")})
                        </Text>
                      )}
                      {isMe && (
                        <View style={styles.statusIconWrap}>
                          <MessageTicks
                            status={item.message.status}
                            deliveredAt={item.message.deliveredAt}
                            readAt={item.message.readAt}
                            onRetry={() =>
                              handleSendMessage(
                                item.message.localPlaintext || item.message.content,
                                item.message.id
                              )
                            }
                          />
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

        {/* Replying Banner */}
        {replyingToMessage && (
          <View
            style={[
              styles.inputBanner,
              { backgroundColor: colors.card, borderLeftColor: colors.primary, borderColor: colors.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputBannerTitle, { color: colors.primary }]}>
                {t("chat.replyingTo")}
              </Text>
              <Text style={[styles.inputBannerSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                {decryptedMap[replyingToMessage.id] || replyingToMessage.content}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingToMessage(null)} style={styles.bannerCloseBtn}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* Editing Banner */}
        {editingMessage && (
          <View
            style={[
              styles.inputBanner,
              { backgroundColor: colors.card, borderLeftColor: colors.accent, borderColor: colors.border },
            ]}
          >
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="edit-2" size={14} color={colors.accent} />
              <Text style={[styles.inputBannerTitle, { color: colors.accent }]}>
                {t("chat.editing")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingMessage(null);
                setContent("");
              }}
              style={styles.bannerCloseBtn}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

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
                onChangeText={(text) => {
                  setContent(text);
                  const now = Date.now();
                  if (now - lastTypingSentRef.current > 3000) {
                    lastTypingSentRef.current = now;
                    sendWsMessage({ type: "typing", matchId: String(matchId) });
                  }
                }}
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

      {/* Message Context Action Modal */}
      <Modal
        visible={!!actionTargetMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTargetMessage(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActionTargetMessage(null)}
        >
          <View style={[styles.actionSheetContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Reply */}
            <TouchableOpacity
              style={[styles.actionSheetBtn, { borderBottomColor: colors.border }]}
              onPress={() => {
                const target = actionTargetMessage;
                setActionTargetMessage(null);
                if (target) {
                  setEditingMessage(null);
                  setReplyingToMessage(target);
                  inputRef.current?.focus();
                }
              }}
            >
              <Feather name="corner-up-left" size={18} color={colors.primary} />
              <Text style={[styles.actionSheetText, { color: colors.foreground }]}>{t("chat.reply")}</Text>
            </TouchableOpacity>

            {/* Edit (if own, not deleted, within 15 min) */}
            {actionTargetMessage &&
              (actionTargetMessage.senderId === userId || actionTargetMessage.senderId === "me") &&
              !actionTargetMessage.deletedAt &&
              Date.now() - new Date(actionTargetMessage.createdAt).getTime() <= 15 * 60 * 1000 && (
                <TouchableOpacity
                  style={[styles.actionSheetBtn, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    const target = actionTargetMessage;
                    setActionTargetMessage(null);
                    if (target) {
                      setReplyingToMessage(null);
                      setEditingMessage(target);
                      setContent(decryptedMap[target.id] || target.content);
                      inputRef.current?.focus();
                    }
                  }}
                >
                  <Feather name="edit-2" size={18} color={colors.accent} />
                  <Text style={[styles.actionSheetText, { color: colors.foreground }]}>{t("chat.edit")}</Text>
                </TouchableOpacity>
              )}

            {/* Delete (if own, not deleted) */}
            {actionTargetMessage &&
              (actionTargetMessage.senderId === userId || actionTargetMessage.senderId === "me") &&
              !actionTargetMessage.deletedAt && (
                <TouchableOpacity
                  style={[styles.actionSheetBtn, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (actionTargetMessage) handleDeleteMessage(actionTargetMessage.id);
                  }}
                >
                  <Feather name="trash-2" size={18} color="#EF4444" />
                  <Text style={[styles.actionSheetText, { color: "#EF4444" }]}>{t("chat.delete")}</Text>
                </TouchableOpacity>
              )}

            {/* Report */}
            <TouchableOpacity
              style={[styles.actionSheetBtn, { borderBottomColor: colors.border }]}
              onPress={() => {
                setActionTargetMessage(null);
                setReportModalOpen(true);
              }}
            >
              <Feather name="flag" size={18} color="#EF4444" />
              <Text style={[styles.actionSheetText, { color: "#EF4444" }]}>{t("chat.report")}</Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={styles.actionSheetBtn}
              onPress={() => setActionTargetMessage(null)}
            >
              <Feather name="x" size={18} color={colors.mutedForeground} />
              <Text style={[styles.actionSheetText, { color: colors.mutedForeground }]}>{t("chat.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Reason Modal */}
      <Modal
        visible={reportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.reportHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather name="flag" size={18} color="#EF4444" />
                <Text style={[styles.reportTitle, { color: colors.foreground }]}>{t("chat.report")}</Text>
              </View>
              <TouchableOpacity onPress={() => setReportModalOpen(false)}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {reportSuccess ? (
              <View style={styles.reportSuccessBox}>
                <Feather name="check-circle" size={32} color="#22C55E" />
                <Text style={[styles.reportSuccessText, { color: colors.foreground }]}>
                  {t("chat.reportSubmitted")}
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.reportSubtitle, { color: colors.mutedForeground }]}>
                  {t("chat.selectReason")}
                </Text>

                <View style={styles.reasonList}>
                  {(["harassment", "wrong_intent", "fake_profile", "other"] as const).map((r) => {
                    const labelKey =
                      r === "harassment"
                        ? "chat.reasonHarassment"
                        : r === "wrong_intent"
                        ? "chat.reasonInappropriate"
                        : r === "fake_profile"
                        ? "chat.reasonFake"
                        : "chat.reasonOther";
                    const isSelected = reportReason === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => setReportReason(r)}
                        style={[
                          styles.reasonBtn,
                          {
                            backgroundColor: isSelected ? colors.primary + "18" : colors.secondary,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.reasonText,
                            { color: isSelected ? colors.primary : colors.foreground },
                          ]}
                        >
                          {t(labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.reportModalActions}>
                  <TouchableOpacity
                    style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                    onPress={() => setReportModalOpen(false)}
                  >
                    <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                      {t("chat.cancel")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalSubmitBtn, { backgroundColor: "#EF4444" }]}
                    onPress={handleSubmitReport}
                    disabled={isSubmittingReport}
                  >
                    {isSubmittingReport ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSubmitText}>{t("chat.report")}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  typingIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  typingText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    fontStyle: "italic",
  },
  phaseText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
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
  bubbleDeleted: {
    opacity: 0.75,
  },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  bubbleTextDeleted: {
    fontStyle: "italic",
    fontSize: 13,
  },
  quotedBubble: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  quotedSender: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    marginBottom: 2,
  },
  quotedText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
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
  editedIndicator: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    fontStyle: "italic",
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
    transform: [{ scaleY: -1 }],
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
  inputBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 4,
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputBannerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  inputBannerSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 1,
  },
  bannerCloseBtn: {
    padding: 4,
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

  // Action Sheet Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  actionSheetContainer: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  actionSheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionSheetText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },

  // Report Modal
  reportCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reportTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  reportSubtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  reasonList: {
    gap: 8,
  },
  reasonBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  reasonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  reportModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubmitText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  reportSuccessBox: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  reportSuccessText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
