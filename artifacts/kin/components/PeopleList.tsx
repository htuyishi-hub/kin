import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { useTranslation } from "@workspace/i18n";
import { Colors } from "../constants/colors";

export type PersonItem = {
  id: string;
  firstName: string;
  age?: number | null;
  campusName?: string | null;
  faculty?: string | null;
  city?: string | null;
  district?: string | null;
  bio?: string | null;
  tags: string[];
  photoUrl?: string | null;
  isVerified: boolean;
  hasInterested: boolean;
};

export function PeopleList({
  apiBaseUrl,
  token,
  userId,
}: {
  apiBaseUrl: string;
  token: string | null;
  userId: string | null;
}) {
  const { t } = useTranslation();

  // Enable screenshot blocking on mobile
  if (Platform.OS !== "web") {
    ScreenCapture.usePreventScreenCapture();
  }

  const [people, setPeople] = useState<PersonItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [hasMore, setHasMore] = useState(true);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [approachingIds, setApproachingIds] = useState<Set<string>>(new Set());

  // Fetch people list
  const fetchPeople = useCallback(
    async (offset = 0, isRefresh = false) => {
      if (!token) return;
      try {
        if (isRefresh) setIsRefreshing(true);
        else if (offset === 0) setIsLoading(true);
        else setIsLoadingMore(true);

        const url = new URL(`${apiBaseUrl}/api/people`);
        url.searchParams.set("limit", "10");
        url.searchParams.set("offset", String(offset));

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if (res.status === 404) {
            setPeople([]);
            setHasMore(false);
            return;
          }
          throw new Error("Failed to load people");
        }

        const data = await res.json();
        const incoming: PersonItem[] = data.people ?? [];

        if (offset === 0 || isRefresh) {
          setPeople(incoming);
        } else {
          setPeople((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const fresh = incoming.filter((p) => !seen.has(p.id));
            return [...prev, ...fresh];
          });
        }

        setNextOffset(data.nextOffset ?? null);
        setHasMore(Boolean(data.hasMore));
        setDailyLimitReached(Boolean(data.dailyLimitReached));
      } catch (err) {
        console.error("[PeopleList] fetch error", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [apiBaseUrl, token]
  );

  useEffect(() => {
    fetchPeople(0);
  }, [fetchPeople]);

  // Approach / Interested action (reuses POST /interests)
  const handleApproach = async (person: PersonItem) => {
    if (!token || person.hasInterested || approachingIds.has(person.id)) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setApproachingIds((prev) => new Set(prev).add(person.id));

    try {
      const res = await fetch(`${apiBaseUrl}/api/interests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ toUserId: person.id }),
      });

      if (res.status === 429) {
        Alert.alert("", t("errors.interestDailyLimit"));
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        if (errData?.error !== "duplicate") {
          Alert.alert("", t("errors.generic"));
          return;
        }
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setPeople((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, hasInterested: true } : p))
      );
    } catch {
      Alert.alert("", t("errors.generic"));
    } finally {
      setApproachingIds((prev) => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
    }
  };

  const handleLoadMore = () => {
    if (!isLoading && !isLoadingMore && hasMore && nextOffset !== null && !dailyLimitReached) {
      fetchPeople(nextOffset);
    }
  };

  const renderItem = ({ item }: { item: PersonItem }) => {
    const locationStr =
      item.campusName || item.faculty
        ? [item.faculty, item.campusName].filter(Boolean).join(" · ")
        : [item.city, item.district].filter(Boolean).join(" · ");

    const isApproaching = approachingIds.has(item.id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Feather name="user" size={24} color={Colors.boneDim} />
            </View>
          )}

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.firstName}>
                {item.firstName}
                {item.age ? `, ${item.age}` : ""}
              </Text>
              {item.isVerified && (
                <Feather name="check-circle" size={14} color={Colors.trust} style={styles.verifiedIcon} />
              )}
            </View>
            {Boolean(locationStr) && <Text style={styles.locationText}>{locationStr}</Text>}
          </View>
        </View>

        {Boolean(item.bio) && <Text style={styles.bioText}>{item.bio}</Text>}

        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.map((tag, idx) => (
              <View key={`${item.id}-tag-${idx}`} style={styles.tagBadge}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Button: Approach / Interested */}
        <TouchableOpacity
          style={[styles.approachBtn, item.hasInterested && styles.approachBtnDone]}
          onPress={() => handleApproach(item)}
          disabled={item.hasInterested || isApproaching}
          activeOpacity={0.8}
        >
          {isApproaching ? (
            <ActivityIndicator size="small" color={Colors.bone} />
          ) : item.hasInterested ? (
            <>
              <Feather name="check" size={16} color={Colors.boneDim} />
              <Text style={styles.approachBtnTextDone}>{t("people.approached")}</Text>
            </>
          ) : (
            <>
              <Feather name="heart" size={16} color={Colors.bone} />
              <Text style={styles.approachBtnText}>{t("people.approach")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.trust} />
      </View>
    );
  }

  return (
    <FlatList
      data={people}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      onRefresh={() => fetchPeople(0, true)}
      refreshing={isRefreshing}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        isLoadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={Colors.trust} />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Feather name="users" size={40} color={Colors.boneGhost} />
          <Text style={styles.emptyTitle}>{t("people.emptyTitle")}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.ink,
    borderColor: Colors.divider,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.inkRaised,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.inkRaised,
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  firstName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.bone,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  locationText: {
    fontSize: 12,
    color: Colors.boneDim,
    marginTop: 2,
  },
  bioText: {
    fontSize: 14,
    color: Colors.bone,
    lineHeight: 20,
    marginTop: 12,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  tagBadge: {
    backgroundColor: Colors.inkRaised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 11,
    color: Colors.boneDim,
    fontWeight: "500",
  },
  approachBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.trust,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
    gap: 8,
  },
  approachBtnDone: {
    backgroundColor: Colors.inkRaised,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  approachBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.bone,
  },
  approachBtnTextDone: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.boneDim,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.boneDim,
  },
});
