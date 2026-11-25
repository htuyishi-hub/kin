import { Feather } from "@expo/vector-icons";
import {
  useGetMatchQueue,
  useGetMe,
  useGetPendingRequests,
  useAcceptTalkRequest,
  useDeclineTalkRequest,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KLogo } from "@/components/KLogo";
import { TeaserCandidate, TeaserSwipeDeck } from "@/components/TeaserSwipeDeck";
import { PostsFeed } from "@/components/PostsFeed";
import { PeopleList } from "@/components/PeopleList";
import { PendingRequestCard, type PendingRequestItem } from "@/components/PendingRequestCard";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@workspace/i18n";

type ReactionType = "campus" | "coffee" | "serious";

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { token, userId } = useAuth();
  const { t } = useTranslation();
  const [selectedSegment, setSelectedSegment] = useState<"deck" | "posts" | "people">("deck");

  const isFeedEnabled =
    process.env.EXPO_PUBLIC_FEED_ENABLED === "true" ||
    process.env.FEED_ENABLED === "true" ||
    process.env.VITE_FEED_ENABLED === "true";
  const isPeopleEnabled =
    process.env.EXPO_PUBLIC_PEOPLE_ENABLED === "true" ||
    process.env.PEOPLE_ENABLED === "true";
  const isRequestsEnabled =
    process.env.EXPO_PUBLIC_REQUESTS_ENABLED === "true" ||
    process.env.REQUESTS_ENABLED === "true";

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  const { data: myProfile } = useGetMe();
  const {
    data: queue = [],
    isLoading,
    refetch,
  } = useGetMatchQueue(
    {},
    {
      query: {
        staleTime: 30_000,
        refetchOnMount: true,
      } as any,
    }
  );

  const {
    data: pendingRequests = [],
    refetch: refetchRequests,
  } = useGetPendingRequests(
    {
      query: {
        enabled: isRequestsEnabled && Boolean(token),
        staleTime: 30_000,
        refetchOnMount: true,
      } as any,
    }
  );

  const { mutate: acceptRequest, isPending: isAcceptingRequest } = useAcceptTalkRequest();
  const { mutate: declineRequest, isPending: isDecliningRequest } = useDeclineTalkRequest();

  const currentPendingRequest =
    isRequestsEnabled && Array.isArray(pendingRequests) && pendingRequests.length > 0
      ? (pendingRequests[0] as PendingRequestItem)
      : null;

  const handleAcceptRequest = (requestId: string) => {
    acceptRequest(
      { requestId },
      {
        onSuccess: (data: any) => {
          refetchRequests();
          refetch();
          if (data?.matchId) {
            router.push(`/match/${data.matchId}`);
          }
        },
      }
    );
  };

  const handleDeclineRequest = (requestId: string) => {
    declineRequest(
      { requestId },
      {
        onSuccess: () => {
          refetchRequests();
        },
      }
    );
  };

  const [matchNotification, setMatchNotification] = useState<string | null>(null);
  const [swipesRemaining, setSwipesRemaining] = useState<number>(25);
  const [outOfSwipesVisible, setOutOfSwipesVisible] = useState(false);
  const [claimingBonus, setClaimingBonus] = useState(false);

  const [pendingLocation, setPendingLocation] = useState<{
    detectedNeighborhood: string;
    latitude: number;
    longitude: number;
    isTravelShift?: boolean;
  } | null>(null);
  const [locationUnsupported, setLocationUnsupported] = useState(false);

  const handleConfirmLocation = async () => {
    if (!token || !pendingLocation) return;
    const res = await fetch(`${apiBaseUrl}/api/me/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        latitude: pendingLocation.latitude,
        longitude: pendingLocation.longitude,
        confirm: true,
      }),
    });
    if (res.ok) {
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
      setPendingLocation(null);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBaseUrl}/api/swipes/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.remaining === "number") setSwipesRemaining(d.remaining);
      })
      .catch(() => {});

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const res = await fetch(`${apiBaseUrl}/api/me/location`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        });
        if (res.status === 403) {
          setLocationUnsupported(true);
          return;
        }
        if (res.ok) {
          const d = await res.json();
          if (d.requiresConfirmation && d.detectedNeighborhood) {
            setPendingLocation({
              detectedNeighborhood: d.detectedNeighborhood,
              latitude: d.latitude,
              longitude: d.longitude,
              isTravelShift: Boolean(d.isTravelShift),
            });
          }
        }
      } catch {}
    })();
  }, [token]);

  const candidates: TeaserCandidate[] = (queue as any[]).map((item) => ({
    id: item.id,
    firstName: item.firstName ?? item.fullName?.split(" ")[0] ?? "Member",
    fullName: item.fullName,
    age: item.age ?? null,
    location: item.location ?? item.campusName ?? item.city ?? null,
    occupation: item.occupation ?? null,
    isUrStudent: Boolean(item.isUrStudent),
    isVerified: Boolean(item.isVerified),
    photos: item.photos?.length > 0 ? item.photos : item.primaryPhotoPath ? [item.primaryPhotoPath] : [],
    primaryPhotoPath: item.primaryPhotoPath ?? item.photos?.[0] ?? null,
    is_golden_bid: Boolean(item.is_golden_bid),
    incoming_reaction: item.incoming_reaction ?? null,
    intent_class: item.intent_class ?? item.primaryIntent,
    primaryIntent: item.primaryIntent ?? item.intent_class,
    trustScore: item.trustScore ?? 1,
    bio: item.bio ?? null,
    tags: item.tags ?? [],
    voiceIntroPath: item.voiceIntroPath ?? null,
    voiceIntroDurationMs: item.voiceIntroDurationMs ?? null,
  }));

  const goldenBidsRemaining = (myProfile as any)?.goldenBidsRemaining ?? (myProfile as any)?.golden_bids_remaining ?? 3;
  const myIntentClass = (myProfile as any)?.intentClass ?? (myProfile as any)?.primaryIntent ?? "Serious";
  const myInviteCode = (myProfile as any)?.inviteCode ?? (myProfile as any)?.invite_code ?? "KINN";
  const isApproverActive = Boolean(
    myProfile?.idVerified ||
    (myProfile as any)?.is_verified ||
    (myProfile as any)?.isVerified ||
    (myProfile as any)?.accountStatus === "active"
  );
  const isCommunityVotingEnabled =
    process.env.EXPO_PUBLIC_COMMUNITY_VOTING_ENABLED === "true" ||
    Boolean((myProfile as any)?.communityVotingEnabled);

  // Swipe Right = Categorized Like & Golden Bid
  async function handleSwipeRight(
    candidate: TeaserCandidate,
    reaction: ReactionType,
    isGoldenBid: boolean
  ) {
    if (swipesRemaining <= 0) {
      setOutOfSwipesVisible(true);
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/interests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          toUserId: candidate.id,
          reactionType: reaction,
          isGoldenBid,
        }),
      });

      if (res.status === 429) {
        setSwipesRemaining(0);
        setOutOfSwipesVisible(true);
        return;
      }

      setSwipesRemaining((prev) => Math.max(0, prev - 1));
      const data = await res.json();
      if (data.matchCreated && data.matchId) {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
        setMatchNotification(t("discover.matchAlert", { name: candidate.firstName }));
        setTimeout(() => {
          setMatchNotification(null);
          router.push(`/match/${data.matchId}`);
        }, 1800);
      }
    } catch {
      // non-fatal
    }
  }

  // Swipe Left = Hard Reject (Permanent)
  async function handleSwipeLeft(candidate: TeaserCandidate) {
    if (swipesRemaining <= 0) {
      setOutOfSwipesVisible(true);
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/passes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId: candidate.id,
          action: "hard_reject",
        }),
      });
      if (res.status === 429) {
        setSwipesRemaining(0);
        setOutOfSwipesVisible(true);
        return;
      }
      setSwipesRemaining((prev) => Math.max(0, prev - 1));
    } catch {
      // non-fatal
    }
  }

  // Swipe Down = Soft Pass (14-day temporary hide)
  async function handleSwipeDown(candidate: TeaserCandidate) {
    if (swipesRemaining <= 0) {
      setOutOfSwipesVisible(true);
      return;
    }
    try {
      const res = await fetch(`${apiBaseUrl}/api/passes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserId: candidate.id,
          action: "soft_pass",
        }),
      });
      if (res.status === 429) {
        setSwipesRemaining(0);
        setOutOfSwipesVisible(true);
        return;
      }
      setSwipesRemaining((prev) => Math.max(0, prev - 1));
    } catch {
      // non-fatal
    }
  }

  async function handleRewind(candidate: TeaserCandidate) {
    try {
      const res = await fetch(`${apiBaseUrl}/api/swipes/rewind`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: candidate.id }),
      });
      if (res.ok) {
        const d = await res.json();
        if (typeof d.remaining === "number") setSwipesRemaining(d.remaining);
      }
    } catch {}
  }

  async function handleClaimWhatsAppBonus() {
    const inviteLink = `https://kinn.ink/invite/${myInviteCode}`;
    const text = encodeURIComponent(t("discover.whatsappInviteText", { link: inviteLink }));
    Linking.openURL(`https://wa.me/?text=${text}`).catch(() => {});

    setClaimingBonus(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/swipes/whatsapp-bonus`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (typeof d.remaining === "number") setSwipesRemaining(d.remaining);
      }
      setOutOfSwipesVisible(false);
    } finally {
      setClaimingBonus(false);
    }
  }

  const paddingT = insets.top + 12;

  return (
    <View style={[styles.container, { backgroundColor: Colors.night, paddingTop: paddingT }]}>
      {/* Top Header with Intent Gating Indicator and Moderation Deck Shortcut */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <KLogo size={24} color={Colors.trust} />
          <View style={styles.intentPill}>
            <Text style={styles.intentPillLabel}>{t("profile.statsIntent")}:</Text>
            <Text style={styles.intentPillValue}>{myIntentClass}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Community Review Deck Shortcut for active users */}
          {isApproverActive && isCommunityVotingEnabled && (
            <TouchableOpacity
              style={styles.moderationBtn}
              onPress={() => router.push("/moderation/review")}
              activeOpacity={0.8}
            >
              <Feather name="shield" size={14} color={Colors.gold} />
              <Text style={styles.moderationBtnText}>{t("moderation.reviewQueue")}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()} activeOpacity={0.8}>
            <Feather name="rotate-cw" size={16} color={Colors.boneDim} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Control (Deck, Posts, People) */}
      {(isFeedEnabled || isPeopleEnabled) && (
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, selectedSegment === "deck" && styles.segmentBtnActive]}
            onPress={() => setSelectedSegment("deck")}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.segmentBtnText, selectedSegment === "deck" && styles.segmentBtnTextActive]}
            >
              {t("posts.deck")}
            </Text>
          </TouchableOpacity>

          {isFeedEnabled && (
            <TouchableOpacity
              style={[styles.segmentBtn, selectedSegment === "posts" && styles.segmentBtnActive]}
              onPress={() => setSelectedSegment("posts")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  selectedSegment === "posts" && styles.segmentBtnTextActive,
                ]}
              >
                {t("posts.title")}
              </Text>
            </TouchableOpacity>
          )}

          {isPeopleEnabled && (
            <TouchableOpacity
              style={[styles.segmentBtn, selectedSegment === "people" && styles.segmentBtnActive]}
              onPress={() => setSelectedSegment("people")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  selectedSegment === "people" && styles.segmentBtnTextActive,
                ]}
              >
                {t("posts.people")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* MATCH NOTIFICATION OVERLAY */}
      {matchNotification && (
        <View style={styles.matchToast}>
          <Feather name="heart" size={18} color={Colors.coral} />
          <Text style={styles.matchToastText}>{matchNotification}</Text>
        </View>
      )}

      {/* Main Content Area */}
      {selectedSegment === "posts" && isFeedEnabled ? (
        <PostsFeed apiBaseUrl={apiBaseUrl} token={token} userId={userId ?? null} />
      ) : selectedSegment === "people" && isPeopleEnabled ? (
        <PeopleList apiBaseUrl={apiBaseUrl} token={token} userId={userId ?? null} />
      ) : currentPendingRequest ? (
        <PendingRequestCard
          request={currentPendingRequest}
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
          isAccepting={isAcceptingRequest}
          isDeclining={isDecliningRequest}
        />
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.trust} size="large" />
          <Text style={styles.loadingText}>Curating intent-gated matches...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {locationUnsupported && (
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: "rgba(255,107,107,0.16)",
                borderWidth: 1,
                borderColor: "rgba(255,107,107,0.5)",
              }}
            >
              <Text style={{ color: "#FF6B6B", fontSize: 12, fontFamily: "Inter_700Bold" }}>
                🚫 {t("location.unsupported")}
              </Text>
            </View>
          )}
          {pendingLocation && !locationUnsupported && (
            <View
              style={{
                marginHorizontal: 16,
                marginBottom: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: Colors.ink,
                borderWidth: 1,
                borderColor: "rgba(56,189,248,0.4)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Text style={{ color: Colors.bone, fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 }} numberOfLines={1}>
                📍 {pendingLocation.detectedNeighborhood}
              </Text>
              <TouchableOpacity
                onPress={handleConfirmLocation}
                style={{ backgroundColor: "#38BDF8", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
              >
                <Text style={{ color: "#0D1117", fontSize: 11, fontFamily: "Inter_700Bold" }}>
                  {pendingLocation.isTravelShift ? t("location.updateLocation") : t("location.confirmCta")}
                </Text>
              </TouchableOpacity>
              {pendingLocation.isTravelShift && (
                <TouchableOpacity
                  onPress={() => setPendingLocation(null)}
                  style={{ backgroundColor: Colors.inkRaised, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 }}
                >
                  <Text style={{ color: Colors.boneDim, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                    {t("location.keepCurrent")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.push("/rush" as any)}
            activeOpacity={0.85}
            style={{
              marginHorizontal: 16,
              marginBottom: 8,
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 14,
              backgroundColor: "rgba(255,107,107,0.16)",
              borderWidth: 1,
              borderColor: "rgba(255,107,107,0.4)",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="zap" size={14} color="#FF6B6B" />
              <Text style={{ color: Colors.bone, fontSize: 12, fontFamily: "Inter_700Bold" }}>
                {t("rush.liveBanner")}
              </Text>
            </View>
            <Text style={{ color: Colors.gold, fontSize: 11, fontFamily: "Inter_700Bold" }}>
              {t("rush.joinQueue")} →
            </Text>
          </TouchableOpacity>
          <TeaserSwipeDeck
            candidates={candidates}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            onSwipeDown={handleSwipeDown}
            onRewind={handleRewind}
            goldenBidsRemaining={goldenBidsRemaining}
            onRefresh={refetch}
          />
        </View>
      )}

      {/* OUT OF SWIPES MODAL */}
      <Modal
        visible={outOfSwipesVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOutOfSwipesVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 360, backgroundColor: "#161B22", borderRadius: 24, padding: 24, alignItems: "center", gap: 16, borderWidth: 1, borderColor: "#21262D" }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(37,99,235,0.2)", alignItems: "center", justifyContent: "center" }}>
              <Feather name="zap" size={28} color="#38BDF8" />
            </View>
            <Text style={{ fontFamily: "Fraunces_700Bold", fontSize: 22, color: Colors.bone, textAlign: "center" }}>
              {t("discover.outOfSwipesTitle")}
            </Text>
            <TouchableOpacity
              onPress={handleClaimWhatsAppBonus}
              disabled={claimingBonus}
              style={{ width: "100%", backgroundColor: "#25D366", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
              activeOpacity={0.85}
            >
              <Feather name="share-2" size={18} color="#0D1117" />
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#0D1117", flexShrink: 1, textAlign: "center" }}>
                {t("discover.inviteWhatsAppButton")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOutOfSwipesVisible(false)}>
              <Text style={{ color: Colors.boneDim, fontSize: 13 }}>{t("chat.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  intentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.inkRaised,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  intentPillLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.boneDim,
  },
  intentPillValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.bone,
  },
  moderationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.inkRaised,
    borderColor: Colors.goldDim,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  moderationBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.gold,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.inkRaised,
    justifyContent: "center",
    alignItems: "center",
  },
  matchToast: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    zIndex: 100,
    backgroundColor: Colors.obsidianNavy,
    borderColor: Colors.coral,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: Colors.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  matchToastText: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 15,
    color: Colors.bone,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.boneDim,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: Colors.inkRaised,
    borderRadius: 14,
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: Colors.night,
    borderWidth: 1,
    borderColor: Colors.goldDim,
  },
  segmentBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.boneDim,
  },
  segmentBtnTextActive: {
    color: Colors.gold,
    fontWeight: "700",
  },
});
