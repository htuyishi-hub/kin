import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@workspace/i18n";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

interface LeaderboardEntry {
  id: string;
  rank: number | null;
  firstName: string;
  zone: string;
  popularityScore: number;
  isSpotlight: boolean;
  isVerified: boolean;
  photoUrl: string | null;
}

const ZONES = [
  { key: "All", labelKey: "leaderboard.allRwanda" },
  { key: "UR_Huye", label: "UR Huye" },
  { key: "UR_Gikondo", label: "UR Gikondo" },
  { key: "Kigali", label: "Kigali" },
];

export default function TrendingScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useTranslation();

  const [zone, setZone] = useState("All");
  const [spotlight, setSpotlight] = useState<LeaderboardEntry[]>([]);
  const [topPodium, setTopPodium] = useState<LeaderboardEntry[]>([]);
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [boosting, setBoosting] = useState(false);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  const fetchBoard = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/leaderboard?zone=${encodeURIComponent(zone)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSpotlight(Array.isArray(d.spotlight) ? d.spotlight : []);
        setTopPodium(Array.isArray(d.topPodium) ? d.topPodium : []);
        setRankings(Array.isArray(d.rankings) ? d.rankings : []);
      }
    } finally {
      setLoading(false);
    }
  }, [token, zone]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  async function handleVote(targetUserId: string, voteType: "free" | "rose") {
    if (!token) return;
    setVotingId(targetUserId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/leaderboard/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId, voteType }),
      });
      if (res.ok) {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
        await fetchBoard();
      }
    } finally {
      setVotingId(null);
    }
  }

  async function handleJoinSpotlight() {
    if (!token) return;
    setBoosting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/leaderboard/spotlight`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
        await fetchBoard();
      }
    } finally {
      setBoosting(false);
    }
  }

  async function handleShareStatus() {
    try {
      await Share.share({ message: t("leaderboard.shareText") });
    } catch {}
  }

  const podiumOrder = [topPodium[1], topPodium[0], topPodium[2]].filter(Boolean) as LeaderboardEntry[];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="award" size={20} color={Colors.gold} />
          <Text style={styles.title}>{t("leaderboard.mostWanted")}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShareStatus} activeOpacity={0.85}>
            <Feather name="share-2" size={14} color="#3FB950" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.spotlightBtn}
            onPress={handleJoinSpotlight}
            disabled={boosting}
            activeOpacity={0.85}
          >
            <Text style={styles.spotlightBtnText}>{t("leaderboard.boostSpotlight")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zonesRow}>
        {ZONES.map((z) => {
          const active = zone === z.key;
          return (
            <TouchableOpacity
              key={z.key}
              onPress={() => setZone(z.key)}
              style={[styles.zonePill, active && styles.zonePillActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.zoneText, active && styles.zoneTextActive]}>
                {z.labelKey ? t(z.labelKey) : z.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 100 }}>
          {spotlight.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={styles.sectionLabel}>{t("leaderboard.spotlight")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {spotlight.map((s) => (
                  <View key={s.id} style={{ alignItems: "center", gap: 4 }}>
                    <View style={styles.spotlightRing}>
                      {s.photoUrl ? (
                        <Image source={{ uri: s.photoUrl }} style={styles.spotlightAvatar} />
                      ) : (
                        <View style={[styles.spotlightAvatar, { backgroundColor: Colors.inkRaised }]} />
                      )}
                    </View>
                    <Text style={styles.spotlightName}>{s.firstName}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {podiumOrder.length > 0 && (
            <View style={styles.podiumRow}>
              {podiumOrder.map((p) => {
                const isFirst = p.rank === 1;
                const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : "🥉";
                return (
                  <View key={p.id} style={[styles.podiumCard, isFirst && styles.podiumCardFirst]}>
                    <Text style={{ fontSize: 18 }}>{medal}</Text>
                    {p.photoUrl ? (
                      <Image
                        source={{ uri: p.photoUrl }}
                        style={isFirst ? styles.podiumAvatarFirst : styles.podiumAvatar}
                      />
                    ) : (
                      <View style={[isFirst ? styles.podiumAvatarFirst : styles.podiumAvatar, { backgroundColor: Colors.inkRaised }]} />
                    )}
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {p.firstName}
                    </Text>
                    <Text style={styles.podiumPts}>
                      {p.popularityScore} {t("leaderboard.points")}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 4, width: "100%" }}>
                      <TouchableOpacity
                        style={styles.voteSmallBtn}
                        onPress={() => handleVote(p.id, "free")}
                        disabled={votingId === p.id}
                      >
                        <Text style={styles.voteSmallText}>+1</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.roseSmallBtn}
                        onPress={() => handleVote(p.id, "rose")}
                        disabled={votingId === p.id}
                      >
                        <Text style={styles.roseSmallText}>🌹+5</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {rankings.map((r) => (
            <View key={r.id} style={styles.rankRow}>
              <Text style={styles.rankNum}>#{r.rank}</Text>
              {r.photoUrl ? (
                <Image source={{ uri: r.photoUrl }} style={styles.rankAvatar} />
              ) : (
                <View style={[styles.rankAvatar, { backgroundColor: Colors.inkRaised }]} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rankName} numberOfLines={1}>
                  {r.firstName}
                </Text>
                <Text style={styles.rankMeta}>
                  {r.zone} · {r.popularityScore} {t("leaderboard.points")}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.voteBtn}
                onPress={() => handleVote(r.id, "free")}
                disabled={votingId === r.id}
              >
                <Text style={styles.voteBtnText}>{t("leaderboard.voteFree")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.roseBtn}
                onPress={() => handleVote(r.id, "rose")}
                disabled={votingId === r.id}
              >
                <Text style={styles.roseBtnText}>🌹 100</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.night },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: { color: Colors.bone, fontSize: 19, fontFamily: "Inter_700Bold" },
  shareBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(63,185,80,0.15)",
    borderWidth: 1,
    borderColor: "rgba(63,185,80,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  spotlightBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  spotlightBtnText: { color: "#0D1117", fontSize: 11, fontFamily: "Inter_700Bold" },
  zonesRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  zonePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  zonePillActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  zoneText: { color: Colors.boneDim, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  zoneTextActive: { color: "#0D1117" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionLabel: { color: Colors.gold, fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase" },
  spotlightRing: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  spotlightAvatar: { width: "100%", height: "100%", borderRadius: 27 },
  spotlightName: { color: Colors.bone, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  podiumRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 8 },
  podiumCard: {
    flex: 1,
    backgroundColor: Colors.ink,
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  podiumCardFirst: { borderColor: Colors.gold, paddingVertical: 14 },
  podiumAvatar: { width: 48, height: 48, borderRadius: 24 },
  podiumAvatarFirst: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: Colors.gold },
  podiumName: { color: Colors.bone, fontSize: 12, fontFamily: "Inter_700Bold" },
  podiumPts: { color: Colors.gold, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  voteSmallBtn: { flex: 1, backgroundColor: Colors.inkRaised, paddingVertical: 5, borderRadius: 8, alignItems: "center" },
  voteSmallText: { color: Colors.bone, fontSize: 10, fontFamily: "Inter_700Bold" },
  roseSmallBtn: {
    flex: 1,
    backgroundColor: "rgba(255,107,107,0.18)",
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: "center",
  },
  roseSmallText: { color: "#FF6B6B", fontSize: 10, fontFamily: "Inter_700Bold" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.ink,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  rankNum: { color: Colors.boneDim, fontSize: 12, fontFamily: "Inter_700Bold", width: 24 },
  rankAvatar: { width: 40, height: 40, borderRadius: 20 },
  rankName: { color: Colors.bone, fontSize: 14, fontFamily: "Inter_700Bold" },
  rankMeta: { color: Colors.boneDim, fontSize: 11 },
  voteBtn: { backgroundColor: Colors.inkRaised, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  voteBtnText: { color: Colors.bone, fontSize: 11, fontFamily: "Inter_700Bold" },
  roseBtn: {
    backgroundColor: "rgba(255,107,107,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  roseBtnText: { color: "#FF6B6B", fontSize: 11, fontFamily: "Inter_700Bold" },
});
