import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Share,
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

interface CrushItem {
  id: string;
  targetPhone: string;
  isMatched: boolean;
}

export default function SecretCrushScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useTranslation();

  const [crushes, setCrushes] = useState<CrushItem[]>([]);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [inviteText, setInviteText] = useState<string | null>(null);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  const fetchCrushes = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/crush`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.crushes)) setCrushes(d.crushes);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCrushes();
  }, [fetchCrushes]);

  async function handleAddCrush(target?: string) {
    const val = (target ?? phone).trim();
    if (!token || !val) return;
    setAdding(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/crush/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetPhone: val }),
      });
      if (res.ok) {
        const d = await res.json();
        setPhone("");
        if (d.matched) {
          Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
          setMatchedName(d.partnerProfile?.firstName || "kinn");
        } else if (d.inviteText) {
          setInviteText(d.inviteText);
        }
        await fetchCrushes();
      }
    } finally {
      setAdding(false);
    }
  }

  async function handlePickContact() {
    try {
      const Contacts = await import("expo-contacts");
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") return;
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      const firstNum = data.find((c) => c.phoneNumbers?.[0]?.number)?.phoneNumbers?.[0]?.number;
      if (firstNum) setPhone(firstNum);
    } catch {}
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.bone} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("crush.title")}</Text>
        <Text style={styles.slotsText}>{t("crush.slots", { count: crushes.length })}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {matchedName && (
          <View style={styles.matchBanner}>
            <Text style={styles.matchBannerText}>
              {t("crush.matchedBanner")} ({matchedName})
            </Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t("contacts.placeholder")}
            placeholderTextColor={Colors.boneGhost}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <TouchableOpacity style={styles.addBtn} onPress={() => handleAddCrush()} disabled={adding || !phone.trim()}>
            <Text style={styles.addBtnText}>{t("crush.addCrush")}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.importBtn} onPress={handlePickContact}>
          <Text style={styles.importBtnText}>📖 {t("contacts.importButton")}</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={Colors.gold} />
        ) : (
          crushes.map((c) => (
            <View key={c.id} style={styles.crushRow}>
              <Text style={styles.crushPhone}>
                {c.isMatched ? "💘 " : "🔒 "}
                {c.targetPhone}
              </Text>
              {c.isMatched && <Text style={styles.matchedTag}>MATCHED</Text>}
            </View>
          ))
        )}

        {inviteText && (
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => Share.share({ message: inviteText }).catch(() => {})}
          >
            <Feather name="share-2" size={16} color="#38BDF8" />
            <Text style={styles.inviteBtnText}>{t("crush.inviteSecretly")}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.night },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  title: { color: Colors.bone, fontSize: 18, fontFamily: "Inter_700Bold" },
  slotsText: { color: Colors.gold, fontSize: 12, fontFamily: "Inter_700Bold" },
  matchBanner: { backgroundColor: "rgba(63,185,80,0.2)", borderWidth: 1, borderColor: "#3FB950", padding: 14, borderRadius: 14 },
  matchBannerText: { color: "#3FB950", fontSize: 14, fontFamily: "Inter_700Bold", textAlign: "center" },
  inputRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: Colors.ink, color: Colors.bone, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  addBtn: { backgroundColor: "#FF6B6B", paddingHorizontal: 16, borderRadius: 12, justifyContent: "center" },
  addBtnText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  importBtn: { backgroundColor: "rgba(56,189,248,0.16)", borderWidth: 1, borderColor: "rgba(56,189,248,0.4)", paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  importBtnText: { color: "#38BDF8", fontSize: 12, fontFamily: "Inter_700Bold" },
  crushRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: Colors.ink, padding: 14, borderRadius: 12 },
  crushPhone: { color: Colors.bone, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  matchedTag: { color: "#3FB950", fontSize: 11, fontFamily: "Inter_700Bold" },
  inviteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.ink },
  inviteBtnText: { color: "#38BDF8", fontSize: 13, fontFamily: "Inter_700Bold" },
});
