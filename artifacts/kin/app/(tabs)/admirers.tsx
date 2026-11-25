import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@workspace/i18n";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

type AdmirerItem = {
  id: string;
  displayName: string | null;
  age: number | null;
  photoUrl: string | null;
  primaryIntent: string;
  occupation: string | null;
  campus: string;
  isVerified: boolean;
};

export default function AdmirersScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useTranslation();

  const [admirers, setAdmirers] = useState<AdmirerItem[]>([]);
  const [count, setCount] = useState(0);
  const [isUnblurred, setIsUnblurred] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unblurring, setUnblurring] = useState(false);
  const [matchingId, setMatchingId] = useState<string | null>(null);

  const [searchCount, setSearchCount] = useState(0);
  const [searchesUnmasked, setSearchesUnmasked] = useState(false);
  const [searchers, setSearchers] = useState<{ id: string; firstName: string; campus: string }[]>([]);
  const [revealingSearches, setRevealingSearches] = useState(false);
  const [photoCompliments, setPhotoCompliments] = useState<{ id: string; senderId?: string; senderFirstName: string; commentText: string; giftType?: string }[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "likes" | "compliments" | "searches">("all");

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  const fetchAdmirers = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [likesRes, searchRes, complimentsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/likes/received`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/api/notifications/searches`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiBaseUrl}/api/photos/compliments`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (likesRes.ok) {
        const data = await likesRes.json();
        setAdmirers(Array.isArray(data.admirers) ? data.admirers : []);
        setCount(data.count ?? 0);
        setIsUnblurred(Boolean(data.isUnblurred));
      }
      if (searchRes.ok) {
        const sData = await searchRes.json();
        setSearchCount(sData.count ?? 0);
        setSearchesUnmasked(Boolean(sData.isUnmasked));
        setSearchers(Array.isArray(sData.searchers) ? sData.searchers : []);
      }
      if (complimentsRes.ok) {
        const cData = await complimentsRes.json();
        if (Array.isArray(cData)) setPhotoCompliments(cData);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAdmirers();
  }, [fetchAdmirers]);

  async function handleRevealSearches() {
    if (!token) return;
    setRevealingSearches(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/notifications/searches/reveal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
        setSearchesUnmasked(true);
        setSearchers(Array.isArray(data.searchers) ? data.searchers : []);
        if (typeof data.count === "number") setSearchCount(data.count);
      }
    } finally {
      setRevealingSearches(false);
    }
  }

  async function handleUnblur() {
    if (!token) return;
    setUnblurring(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/likes/unblur`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
        setIsUnblurred(true);
        await fetchAdmirers();
      }
    } finally {
      setUnblurring(false);
    }
  }

  async function handleInstantMatch(admirerId: string) {
    if (!token) return;
    setMatchingId(admirerId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/likes/instant-match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ admirerId }),
      });
      if (res.ok) {
        const data = await res.json();
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
        await fetchAdmirers();
        if (data.matchId) {
          router.push(`/match/${data.matchId}`);
        }
      }
    } finally {
      setMatchingId(null);
    }
  }

  function getIntentLabel(intent: string) {
    const v = intent.toLowerCase();
    if (v.includes("marriage")) return t("intent.marriage");
    if (v.includes("casual")) return t("intent.casual");
    return t("intent.serious");
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.night, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="bell" size={20} color={Colors.gold} />
          <Text style={styles.title}>{t("activity.title")}</Text>
          {(count + photoCompliments.length + searchCount) > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{count + photoCompliments.length + searchCount}</Text>
            </View>
          )}
        </View>
        {isUnblurred && (
          <View style={styles.unblurredPill}>
            <Text style={styles.unblurredText}>{t("admirers.unblurredBadge")}</Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10 }}>
        {(
          [
            { key: "all", label: t("activity.all") },
            { key: "likes", label: t("activity.likes") },
            { key: "compliments", label: t("activity.compliments") },
            { key: "searches", label: t("activity.searches") },
          ] as const
        ).map((pill) => {
          const active = activityFilter === pill.key;
          return (
            <TouchableOpacity
              key={pill.key}
              onPress={() => setActivityFilter(pill.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: active ? Colors.gold : Colors.ink,
                borderWidth: 1,
                borderColor: active ? Colors.gold : "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ color: active ? "#0D1117" : Colors.boneDim, fontSize: 12, fontFamily: "Inter_700Bold" }}>
                {pill.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {(activityFilter === "all" || activityFilter === "searches") && searchCount > 0 && (
        <View style={styles.searchBanner}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Feather name="search" size={16} color={Colors.gold} />
              <Text style={styles.searchBannerTitle}>{t("search.searchedYouCount", { count: searchCount })}</Text>
            </View>
            {!searchesUnmasked && (
              <TouchableOpacity
                style={styles.revealBtn}
                onPress={handleRevealSearches}
                disabled={revealingSearches}
                activeOpacity={0.85}
              >
                {revealingSearches ? (
                  <ActivityIndicator size="small" color="#0D1117" />
                ) : (
                  <Text style={styles.revealBtnText}>{t("search.revealCta")}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {searchesUnmasked && searchers.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {searchers.map((s) => (
                <View key={s.id} style={styles.searcherChip}>
                  <Text style={styles.searcherChipText}>
                    {s.firstName} · {s.campus}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {(activityFilter === "all" || activityFilter === "compliments") && photoCompliments.length > 0 && (
        <View style={{ marginHorizontal: 16, marginBottom: 8, gap: 6 }}>
          {photoCompliments.map((c) => {
            const isDrink = c.giftType === "coffee" || c.giftType === "cocktail";
            return (
              <View
                key={c.id}
                style={{
                  backgroundColor: "rgba(201,168,76,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(201,168,76,0.45)",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: Colors.gold, fontSize: 12, fontFamily: "Inter_700Bold" }}>
                    {isDrink ? (c.giftType === "cocktail" ? "🍸" : "☕") : "💬"} {c.senderFirstName}
                  </Text>
                  <Text style={{ color: Colors.bone, fontSize: 12, fontStyle: "italic" }} numberOfLines={1}>
                    "{c.commentText}"
                  </Text>
                </View>
                {c.senderId && (
                  <TouchableOpacity
                    onPress={() => handleInstantMatch(c.senderId!)}
                    style={{ backgroundColor: "#3FB950", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}
                  >
                    <Text style={{ color: "#0D1117", fontSize: 11, fontFamily: "Inter_700Bold" }}>
                      {t("activity.matchReply")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {(activityFilter === "all" || activityFilter === "likes") && (loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.trust} size="large" />
        </View>
      ) : admirers.length === 0 ? (
        <View style={styles.center}>
          <Feather name="heart" size={44} color={Colors.boneGhost} />
          <Text style={styles.emptyTitle}>{t("admirers.emptyTitle")}</Text>
        </View>
      ) : (
        <FlatList
          data={admirers}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.imageWrap}>
                {item.photoUrl ? (
                  <Image
                    source={{ uri: item.photoUrl }}
                    style={styles.cardImage}
                    blurRadius={isUnblurred ? 0 : 28}
                  />
                ) : (
                  <View style={[styles.cardImage, styles.placeholder]}>
                    <Feather name="user" size={32} color={Colors.boneGhost} />
                  </View>
                )}
                {!isUnblurred && (
                  <View style={styles.lockOverlay}>
                    <View style={styles.lockCircle}>
                      <Feather name="lock" size={16} color={Colors.gold} />
                    </View>
                  </View>
                )}
                <View style={styles.intentChip}>
                  <Text style={styles.intentText}>{getIntentLabel(item.primaryIntent)}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {isUnblurred
                      ? `${item.displayName || t("admirers.secretAdmirer")}${item.age ? `, ${item.age}` : ""}`
                      : t("admirers.secretAdmirer")}
                  </Text>
                  {item.isVerified && <Feather name="check-circle" size={12} color="#38BDF8" />}
                </View>
                <Text style={styles.campusText} numberOfLines={1}>
                  {item.campus}
                </Text>
                {isUnblurred && (
                  <TouchableOpacity
                    style={styles.matchBtn}
                    onPress={() => handleInstantMatch(item.id)}
                    disabled={matchingId === item.id}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.matchBtnText}>
                      {matchingId === item.id ? "..." : t("admirers.matchInstantly")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      ))}

      {!isUnblurred && admirers.length > 0 && (
        <View style={[styles.ctaBar, { bottom: 16 }]}>
          <Text style={styles.momoText}>{t("admirers.momoPay")}</Text>
          <TouchableOpacity
            style={styles.unblurBtn}
            onPress={handleUnblur}
            disabled={unblurring}
            activeOpacity={0.85}
          >
            <Text style={styles.unblurBtnText}>
              {unblurring ? "..." : t("admirers.unblurCta")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#21262D",
  },
  title: { fontFamily: "Fraunces_700Bold", fontSize: 22, color: Colors.bone },
  countBadge: {
    backgroundColor: "rgba(255,107,107,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countText: { color: "#FF6B6B", fontSize: 12, fontFamily: "Inter_700Bold" },
  unblurredPill: {
    backgroundColor: "rgba(63,185,80,0.15)",
    borderColor: "rgba(63,185,80,0.4)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  unblurredText: { color: "#3FB950", fontSize: 11, fontFamily: "Inter_700Bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10 },
  emptyTitle: { color: Colors.boneDim, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  card: {
    flex: 1,
    backgroundColor: "#1A1A2E",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#21262D",
    overflow: "hidden",
  },
  imageWrap: { height: 170, width: "100%", backgroundColor: "#242438", position: "relative" },
  cardImage: { width: "100%", height: "100%" },
  placeholder: { justifyContent: "center", alignItems: "center" },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(13,17,23,0.85)",
    borderWidth: 1,
    borderColor: Colors.gold,
    justifyContent: "center",
    alignItems: "center",
  },
  intentChip: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(13,17,23,0.8)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  intentText: { color: Colors.bone, fontSize: 9, fontFamily: "Inter_600SemiBold" },
  cardBody: { padding: 10, gap: 4 },
  nameText: { color: Colors.bone, fontSize: 13, fontFamily: "Inter_700Bold", flexShrink: 1 },
  campusText: { color: Colors.boneDim, fontSize: 11 },
  matchBtn: {
    marginTop: 6,
    backgroundColor: "#3FB950",
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
  },
  matchBtnText: { color: "#0D1117", fontSize: 12, fontFamily: "Inter_700Bold" },
  ctaBar: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#161B22",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.5)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  momoText: { color: Colors.gold, fontSize: 12, fontFamily: "Inter_700Bold" },
  unblurBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  unblurBtnText: { color: "#0D1117", fontSize: 12, fontFamily: "Inter_700Bold" },
  searchBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#161B22",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.4)",
  },
  searchBannerTitle: { color: Colors.bone, fontSize: 13, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  revealBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  revealBtnText: { color: "#0D1117", fontSize: 11, fontFamily: "Inter_700Bold" },
  searcherChip: {
    backgroundColor: Colors.inkRaised,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  searcherChipText: { color: Colors.bone, fontSize: 11, fontFamily: "Inter_500Medium" },
});
