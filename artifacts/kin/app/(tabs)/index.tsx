import { Feather } from "@expo/vector-icons";
import {
  useGetMatchQueue,
  useGetMe,
  useGetPendingRequests,
  useAcceptTalkRequest,
  useDeclineTalkRequest,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

  const candidates: TeaserCandidate[] = (queue as any[]).map((item) => ({
    id: item.id,
    firstName: item.firstName ?? item.fullName?.split(" ")[0] ?? "Member",
    fullName: item.fullName,
    photos: item.photos?.length > 0 ? item.photos : item.primaryPhotoPath ? [item.primaryPhotoPath] : [],
    primaryPhotoPath: item.primaryPhotoPath ?? item.photos?.[0] ?? null,
    is_golden_bid: Boolean(item.is_golden_bid),
    incoming_reaction: item.incoming_reaction ?? null,
    intent_class: item.intent_class ?? item.primaryIntent,
    trustScore: item.trustScore ?? 1,
    bio: item.bio ?? null,
    tags: item.tags ?? [],
    voiceIntroPath: item.voiceIntroPath ?? null,
    voiceIntroDurationMs: item.voiceIntroDurationMs ?? null,
  }));

  const goldenBidsRemaining = (myProfile as any)?.goldenBidsRemaining ?? (myProfile as any)?.golden_bids_remaining ?? 3;
  const myIntentClass = (myProfile as any)?.intentClass ?? (myProfile as any)?.primaryIntent ?? "Serious";
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
    try {
      await fetch(`${apiBaseUrl}/api/passes`, {
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
    } catch {
      // non-fatal
    }
  }

  // Swipe Down = Soft Pass (14-day temporary hide)
  async function handleSwipeDown(candidate: TeaserCandidate) {
    try {
      await fetch(`${apiBaseUrl}/api/passes`, {
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
    } catch {
      // non-fatal
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
        <TeaserSwipeDeck
          candidates={candidates}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
          onSwipeDown={handleSwipeDown}
          goldenBidsRemaining={goldenBidsRemaining}
          onRefresh={refetch}
        />
      )}
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
