import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@workspace/i18n";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

interface RushPartner {
  id: string;
  age: number | null;
  campus: string;
  primaryIntent: string;
  passions: string[];
}

interface RushMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export default function RushScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { t } = useTranslation();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [partner, setPartner] = useState<RushPartner | null>(null);
  const [endsAt, setEndsAt] = useState(Date.now() + 180000);
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [messages, setMessages] = useState<RushMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("joining");
  const [matchId, setMatchId] = useState<string | null>(null);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/api/rush/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.sessionId) {
          setSessionId(d.sessionId);
          setPartner(d.partner);
          setEndsAt(new Date(d.endsAt).getTime());
          setStatus("active");
        } else {
          setStatus("waiting");
        }
      })
      .catch(() => setStatus("waiting"));
  }, [token]);

  useEffect(() => {
    if (status !== "active") return;
    const id = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [status, endsAt]);

  useEffect(() => {
    if (!sessionId || !token) return;
    const poll = setInterval(() => {
      fetch(`${apiBaseUrl}/api/rush/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          if (Array.isArray(d.messages)) setMessages(d.messages);
          if (d.status === "matched" && d.matchId) {
            Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
            setStatus("matched");
            setMatchId(d.matchId);
          } else if (d.status === "passed") {
            router.back();
          }
        })
        .catch(() => {});
    }, 1500);
    return () => clearInterval(poll);
  }, [sessionId, token]);

  async function handleSend() {
    if (!sessionId || !token || !input.trim()) return;
    const text = input.trim();
    setInput("");
    const res = await fetch(`${apiBaseUrl}/api/rush/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, text }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
    }
  }

  async function handleDecision(decision: "reveal" | "pass") {
    if (!sessionId || !token) return;
    const res = await fetch(`${apiBaseUrl}/api/rush/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, decision }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.status === "matched" && d.matchId) {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
        setStatus("matched");
        setMatchId(d.matchId);
      } else if (decision === "pass") {
        router.back();
      }
    }
  }

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.bone} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("rush.title")}</Text>
        <View style={styles.timerPill}>
          <Text style={styles.timerText}>
            {mins}:{secs}
          </Text>
        </View>
      </View>

      {status === "joining" || status === "waiting" ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF6B6B" size="large" />
          <Text style={{ color: Colors.bone, marginTop: 12, fontFamily: "Inter_600SemiBold" }}>
            {t("rush.waitingPartner")}
          </Text>
        </View>
      ) : status === "matched" && matchId ? (
        <View style={styles.center}>
          <Feather name="heart" size={48} color="#3FB950" />
          <Text style={{ color: Colors.bone, fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 14 }}>
            {t("rush.itIsAMatch")}
          </Text>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={() => router.replace(`/match/${matchId}`)}
          >
            <Text style={styles.continueBtnText}>{t("rush.continueChat")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {partner && (
            <View style={styles.partnerCard}>
              <View style={styles.blurAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.partnerTitle}>
                  {partner.age ? `${partner.age} · ` : ""}
                  {partner.campus}
                </Text>
                <Text style={styles.partnerIntent}>{partner.primaryIntent}</Text>
              </View>
            </View>
          )}

          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => {
              const mine = item.senderId === user?.id;
              return (
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  <Text style={styles.bubbleText}>{item.text}</Text>
                </View>
              );
            }}
          />

          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="..."
              placeholderTextColor={Colors.boneGhost}
              style={styles.input}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Feather name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.decisionRow}>
            <TouchableOpacity style={styles.passBtn} onPress={() => handleDecision("pass")}>
              <Text style={styles.passBtnText}>{t("rush.pass")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.revealBtn} onPress={() => handleDecision("reveal")}>
              <Text style={styles.revealBtnText}>{t("rush.reveal")}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.night },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { color: Colors.bone, fontSize: 18, fontFamily: "Inter_700Bold" },
  timerPill: { backgroundColor: "rgba(201,168,76,0.2)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  timerText: { color: Colors.gold, fontSize: 13, fontFamily: "Inter_700Bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  continueBtn: { marginTop: 18, backgroundColor: "#3FB950", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  continueBtnText: { color: "#0D1117", fontSize: 14, fontFamily: "Inter_700Bold" },
  partnerCard: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.ink,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  blurAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.trust, opacity: 0.5 },
  partnerTitle: { color: Colors.bone, fontSize: 14, fontFamily: "Inter_700Bold" },
  partnerIntent: { color: Colors.gold, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  bubble: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: Colors.trust },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: Colors.ink },
  bubbleText: { color: Colors.bone, fontSize: 13 },
  inputRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  input: {
    flex: 1,
    backgroundColor: Colors.ink,
    color: Colors.bone,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendBtn: { backgroundColor: Colors.trust, width: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  decisionRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10 },
  passBtn: { flex: 1, backgroundColor: Colors.ink, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  passBtnText: { color: Colors.bone, fontSize: 13, fontFamily: "Inter_700Bold" },
  revealBtn: { flex: 1, backgroundColor: "#3FB950", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  revealBtnText: { color: "#0D1117", fontSize: 13, fontFamily: "Inter_700Bold" },
});
