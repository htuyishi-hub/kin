import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
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
  caption: string;
  locationName: string;
  likesCount: number;
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
  const lastTapRef = useRef<{ id: string; time: number }>({ id: "", time: 0 });

  const fetchFeed = useCallback(
    async (isRefresh = false) => {
      if (!token) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/feed?limit=15&offset=0`, {
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
    [apiBaseUrl, token],
  );

  useEffect(() => {
    fetchFeed(false);
  }, [fetchFeed]);

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
    <FlatList
      data={posts}
      keyExtractor={(item) => item.postId}
      refreshing={refreshing}
      onRefresh={() => fetchFeed(true)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 110 }}
      renderItem={({ item }) => (
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
                <Text style={styles.sub} numberOfLines={1}>
                  📍 {item.user.neighborhood}
                  {item.user.campus ? ` • 🎓 ${item.user.campus}` : ""}
                </Text>
              </View>
            </View>
          </View>

          {/* Photo with Double-Tap */}
          <TouchableOpacity activeOpacity={0.95} onPress={() => handlePhotoTap(item)} style={styles.photoWrap}>
            <Image source={{ uri: item.photoUrl }} style={styles.photo} contentFit="cover" transition={200} />
            {burstPostId === item.postId && (
              <View style={styles.burstOverlay}>
                <Text style={{ fontSize: 72 }}>❤️</Text>
              </View>
            )}
          </TouchableOpacity>

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

          {/* Caption & Tags */}
          <View style={styles.captionBox}>
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
      )}
    />
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
