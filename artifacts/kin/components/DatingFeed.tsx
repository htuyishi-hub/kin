import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "@workspace/i18n";
import { Colors } from "../constants/colors";
import { ProfilePhoto } from "./ProfilePhoto";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface MobileFeedPost {
  postId: string;
  photoUrl: string;
  photoUrls?: string[];
  caption: string;
  locationName: string;
  musicTitle?: string | null;
  likesCount: number;
  viewsCount?: number;
  createdAt: string;
  hasLiked: boolean;
  user: {
    id: string;
    displayName: string;
    age: number | null;
    avatarUrl: string | null;
    isVerified: boolean;
    campus: string | null;
    neighborhood: string;
    primaryIntent: string;
    tags: string[];
  };
}

export function DatingFeed({
  apiBaseUrl,
  token,
  onMatched,
  onCompliment,
}: {
  apiBaseUrl: string;
  token: string | null;
  onMatched?: (matchId: string, partnerName?: string) => void;
  onCompliment?: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<MobileFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [burstPostId, setBurstPostId] = useState<string | null>(null);
  const [carouselIdx, setCarouselIdx] = useState<Record<string, number>>({});
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });

  const fetchFeed = useCallback(
    async (isRefresh = false, locFilter: string | null = locationFilter) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "15", offset: "0" });
        if (locFilter) params.set("location", locFilter);
        const res = await fetch(`${apiBaseUrl}/api/feed?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.posts)) setPosts(data.posts);
        }
      } catch {}
      setLoading(false);
      setRefreshing(false);
    },
    [apiBaseUrl, token, locationFilter],
  );

  useEffect(() => {
    fetchFeed(false, locationFilter);
  }, [fetchFeed, locationFilter]);

  const handleLikePost = async (post: MobileFeedPost, showBurst = false) => {
    if (!token) return;
    if (showBurst) {
      setBurstPostId(post.postId);
      setTimeout(() => setBurstPostId((cur) => (cur === post.postId ? null : cur)), 700);
    }
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);

    if (!post.hasLiked) {
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === post.postId
            ? { ...p, hasLiked: true, likesCount: p.likesCount + 1 }
            : p,
        ),
      );
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/feed/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: post.postId, targetUserId: post.user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.isMatch && data?.matchId) {
          Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
          onMatched?.(data.matchId, data.partnerProfile?.displayName || post.user.displayName);
        }
      }
    } catch {}
  };

  const handlePhotoTap = (post: MobileFeedPost) => {
    const now = Date.now();
    if (lastTapRef.current.id === post.postId && now - lastTapRef.current.time < 320) {
      handleLikePost(post, true);
      lastTapRef.current = { id: "", time: 0 };
    } else {
      lastTapRef.current = { id: post.postId, time: now };
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {locationFilter && (
        <TouchableOpacity
          onPress={() => setLocationFilter(null)}
          style={{
            marginHorizontal: 14,
            marginBottom: 6,
            alignSelf: "flex-start",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: "rgba(56,189,248,0.16)",
            borderWidth: 1,
            borderColor: "rgba(56,189,248,0.45)",
          }}
        >
          <Text style={{ color: "#38BDF8", fontSize: 11, fontFamily: "Inter_700Bold" }}>
            📍 {locationFilter} ×
          </Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.postId}
        refreshing={refreshing}
        onRefresh={() => fetchFeed(true, locationFilter)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={({ item }) => {
          const photos = item.photoUrls && item.photoUrls.length > 0 ? item.photoUrls : [item.photoUrl];
          const idx = carouselIdx[item.postId] ?? 0;

          return (
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.avatarRing}>
                    <ProfilePhoto url={item.user.avatarUrl} size={36} borderRadius={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.user.displayName}
                        {item.user.age ? `, ${item.user.age}` : ""}
                      </Text>
                      {item.user.isVerified && <Feather name="check-circle" size={13} color="#38BDF8" />}
                    </View>
                    <TouchableOpacity onPress={() => setLocationFilter(item.locationName || item.user.neighborhood)}>
                      <Text style={styles.sub} numberOfLines={1}>
                        📍 {item.locationName || item.user.neighborhood}
                        {item.user.campus ? ` • 🎓 ${item.user.campus}` : ""}
                      </Text>
                    </TouchableOpacity>
                    {!!item.musicTitle && (
                      <View
                        style={{
                          marginTop: 4,
                          alignSelf: "flex-start",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 999,
                          backgroundColor: "#1A1A2E",
                          borderWidth: 1,
                          borderColor: "rgba(201,168,76,0.35)",
                        }}
                      >
                        <Text style={{ fontSize: 10, color: Colors.gold, fontFamily: "Inter_600SemiBold" }} numberOfLines={1}>
                          🎵 {item.musicTitle}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Multi-Photo Carousel with Double-Tap */}
              <View style={styles.photoWrap}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setCarouselIdx((prev) => ({ ...prev, [item.postId]: page }));
                  }}
                >
                  {photos.map((uri, pIdx) => (
                    <TouchableOpacity
                      key={pIdx}
                      activeOpacity={0.95}
                      onPress={() => handlePhotoTap(item)}
                      style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.15 }}
                    >
                      <Image source={{ uri }} style={styles.photo} contentFit="cover" transition={200} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {photos.length > 1 && (
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>
                      {idx + 1} / {photos.length}
                    </Text>
                  </View>
                )}
                {burstPostId === item.postId && (
                  <View style={styles.burstOverlay} pointerEvents="none">
                    <Text style={{ fontSize: 76 }}>❤️</Text>
                    <Text style={{ position: "absolute", top: "34%", left: "26%", fontSize: 24 }}>💖</Text>
                    <Text style={{ position: "absolute", top: "36%", right: "26%", fontSize: 22 }}>✨</Text>
                    <Text style={{ position: "absolute", bottom: "34%", left: "30%", fontSize: 22 }}>💗</Text>
                    <Text style={{ position: "absolute", bottom: "36%", right: "30%", fontSize: 20 }}>❤️</Text>
                    <Text style={{ position: "absolute", top: "26%", fontSize: 18 }}>✨</Text>
                  </View>
                )}
              </View>

              {/* Carousel Dots */}
              {photos.length > 1 && (
                <View style={styles.dotsRow}>
                  {photos.map((_, dIdx) => (
                    <View
                      key={dIdx}
                      style={[
                        styles.dot,
                        { width: dIdx === idx ? 14 : 6, backgroundColor: dIdx === idx ? "#38BDF8" : "#30363D" },
                      ]}
                    />
                  ))}
                </View>
              )}

              {/* Action Bar */}
              <View style={styles.actionBar}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                  <TouchableOpacity
                    onPress={() => handleLikePost(item, true)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                  >
                    <Feather name="heart" size={20} color={item.hasLiked ? "#FF6B6B" : Colors.bone} />
                    <Text style={{ color: item.hasLiked ? "#FF6B6B" : Colors.bone, fontSize: 12, fontFamily: "Inter_700Bold" }}>
                      {t("discover.like")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onCompliment?.(item.user.id)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                  >
                    <Feather name="message-circle" size={19} color={Colors.gold} />
                    <Text style={{ color: Colors.gold, fontSize: 12, fontFamily: "Inter_700Bold" }}>200 RWF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      fetch(`${apiBaseUrl}/api/deck/drink`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ targetUserId: item.user.id, drinkType: "coffee" }),
                      }).then(() => Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success)).catch(() => {});
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Text style={{ fontSize: 16 }}>☕</Text>
                    <Text style={{ color: Colors.bone, fontSize: 12, fontFamily: "Inter_700Bold" }}>100 RWF</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => Share.share({ message: `https://kinn.ink/p/${item.user.id}` }).catch(() => {})}
                >
                  <Feather name="share-2" size={18} color={Colors.boneDim} />
                </TouchableOpacity>
              </View>

              {/* Views, Likes, Caption & Tags */}
              <View style={styles.captionBox}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 }}>
                  <Text style={{ color: Colors.boneDim, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                    {item.likesCount} ♥
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="eye" size={12} color={Colors.boneDim} />
                    <Text style={{ color: Colors.boneDim, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                      {t("discover.views", { count: item.viewsCount ?? 1 })}
                    </Text>
                  </View>
                </View>
                {!!item.caption && (
                  <Text style={styles.caption} numberOfLines={3}>
                    <Text style={{ fontFamily: "Inter_700Bold" }}>{item.user.displayName} </Text>
                    {item.caption}
                  </Text>
                )}
                {item.user.tags.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    {item.user.tags.slice(0, 4).map((tag) => (
                      <Text key={tag} style={{ color: "#38BDF8", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                        #{t(`tags.${tag}`, { defaultValue: tag })}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    borderBottomWidth: 1,
    borderBottomColor: "#21262D",
    backgroundColor: Colors.night,
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#3FB950",
  },
  name: {
    color: Colors.bone,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  sub: {
    color: Colors.boneDim,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  photoWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.15,
    backgroundColor: Colors.inkRaised,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  countPill: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    paddingTop: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  burstOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  actionBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  captionBox: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  caption: {
    color: Colors.bone,
    fontSize: 13,
    lineHeight: 18,
  },
});
