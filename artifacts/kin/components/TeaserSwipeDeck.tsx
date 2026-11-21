import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Colors } from "@/constants/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = 120;

export type TeaserCandidate = {
  id: string;
  firstName: string;
  fullName?: string;
  photos: string[];
  primaryPhotoPath?: string | null;
  is_golden_bid?: boolean;
  incoming_reaction?: "campus" | "coffee" | "serious" | null;
  intent_class?: string;
  trustScore?: number;
  approvedBy?: { fullName: string; firstName: string; isVerified: boolean } | null;
  vouchedBy?: { fullName: string; firstName: string; isVerified: boolean } | null;
};

type ReactionType = "campus" | "coffee" | "serious";

interface TeaserSwipeDeckProps {
  candidates: TeaserCandidate[];
  onSwipeRight: (candidate: TeaserCandidate, reaction: ReactionType, isGoldenBid: boolean) => void;
  onSwipeLeft: (candidate: TeaserCandidate) => void;
  onSwipeDown: (candidate: TeaserCandidate) => void;
  goldenBidsRemaining?: number;
  onRefresh?: () => void;
}

export function TeaserSwipeDeck({
  candidates,
  onSwipeRight,
  onSwipeLeft,
  onSwipeDown,
  goldenBidsRemaining = 3,
  onRefresh,
}: TeaserSwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Categorized Like Modal State
  const [likeModalVisible, setLikeModalVisible] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<TeaserCandidate | null>(null);
  const [useGoldenBid, setUseGoldenBid] = useState(false);

  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);

  const currentCandidate = candidates[currentIndex];
  const nextCandidate = candidates[currentIndex + 1];

  const resetPosition = () => {
    "worklet";
    translationX.value = withSpring(0, { damping: 15 });
    translationY.value = withSpring(0, { damping: 15 });
  };

  const advanceNextCard = () => {
    setCurrentIndex((prev) => prev + 1);
    setPhotoIndex(0);
    translationX.value = 0;
    translationY.value = 0;
  };

  const triggerLikeVibeSelect = (candidate: TeaserCandidate) => {
    setPendingCandidate(candidate);
    setLikeModalVisible(true);
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleHardReject = (candidate: TeaserCandidate) => {
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    onSwipeLeft(candidate);
    advanceNextCard();
  };

  const handleSoftPass = (candidate: TeaserCandidate) => {
    Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Warning);
    onSwipeDown(candidate);
    advanceNextCard();
  };

  const confirmLikeReaction = (reaction: ReactionType) => {
    if (!pendingCandidate) return;
    onSwipeRight(pendingCandidate, reaction, useGoldenBid);
    setLikeModalVisible(false);
    setPendingCandidate(null);
    setUseGoldenBid(false);
    Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    advanceNextCard();
  };

  // Pan Gesture Configuration
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translationX.value = event.translationX;
      translationY.value = event.translationY;
    })
    .onEnd((event) => {
      if (!currentCandidate) return;

      // 1. Swipe Right = Like (Open Categorized Vibe Menu)
      if (event.translationX > SWIPE_THRESHOLD) {
        translationX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(triggerLikeVibeSelect)(currentCandidate);
        });
      }
      // 2. Swipe Left = Hard Reject
      else if (event.translationX < -SWIPE_THRESHOLD) {
        translationX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(handleHardReject)(currentCandidate);
        });
      }
      // 3. Swipe Down = Soft Pass (14-day snooze)
      else if (event.translationY > SWIPE_THRESHOLD && Math.abs(event.translationX) < SWIPE_THRESHOLD) {
        translationY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
          runOnJS(handleSoftPass)(currentCandidate);
        });
      }
      // Cancel / Return to center
      else {
        resetPosition();
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translationX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-12, 0, 12]
    );

    return {
      transform: [
        { translateX: translationX.value },
        { translateY: translationY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  // Stamp indicator opacities
  const likeBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translationX.value, [20, SWIPE_THRESHOLD], [0, 1]),
  }));

  const rejectBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translationX.value, [-20, -SWIPE_THRESHOLD], [0, 1]),
  }));

  const passBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translationY.value, [20, SWIPE_THRESHOLD], [0, 1]),
  }));

  if (!currentCandidate) {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="compass" size={48} color={Colors.gold} />
        <Text style={styles.emptyTitle}>Deck Cleared</Text>
        <Text style={styles.emptySubtitle}>
          You've reviewed all active members matching your current Intent Class. Check back soon or adjust your settings.
        </Text>
        {onRefresh && (
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.85}>
            <Feather name="rotate-cw" size={16} color={Colors.bone} />
            <Text style={styles.refreshButtonText}>Refresh Stack</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const photos = currentCandidate.photos.slice(0, 2); // Strict maximum of 2 photos
  const currentPhotoUrl = photos[photoIndex] ?? currentCandidate.primaryPhotoPath;
  const isGoldenBid = Boolean(currentCandidate.is_golden_bid);
  const approver = currentCandidate.approvedBy ?? currentCandidate.vouchedBy;

  return (
    <View style={styles.container}>
      {/* Background card preview */}
      {nextCandidate && (
        <View style={[styles.card, styles.nextCard]}>
          <Image
            source={{ uri: nextCandidate.photos[0] ?? nextCandidate.primaryPhotoPath ?? "" }}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <View style={styles.cardOverlay}>
            <Text style={styles.candidateName}>{nextCandidate.firstName}</Text>
          </View>
        </View>
      )}

      {/* Interactive Top Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.card,
            isGoldenBid ? styles.goldenBidCard : null,
            cardAnimatedStyle,
          ]}
        >
          {/* Photos (Strict Maximum 2 photos) */}
          {currentPhotoUrl ? (
            <Image source={{ uri: currentPhotoUrl }} style={styles.cardImage} resizeMode="cover" />
          ) : (
            <View style={styles.noPhotoPlaceholder}>
              <Feather name="user" size={64} color={Colors.boneDim} />
            </View>
          )}

          {/* Photo Pagination Indicator (If 2 photos exist) */}
          {photos.length > 1 && (
            <View style={styles.photoPagination}>
              {photos.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.paginationSegment,
                    idx === photoIndex && styles.paginationSegmentActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync?.();
                    setPhotoIndex(idx);
                  }}
                  activeOpacity={0.8}
                />
              ))}
            </View>
          )}

          {/* Tap Zones to toggle between Photo 1 and Photo 2 */}
          {photos.length > 1 && (
            <View style={styles.photoTapZones} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.tapLeft}
                onPress={() => setPhotoIndex(0)}
                activeOpacity={1}
              />
              <TouchableOpacity
                style={styles.tapRight}
                onPress={() => setPhotoIndex(1)}
                activeOpacity={1}
              />
            </View>
          )}

          {/* GOLDEN BID BADGE (Obsidian Navy + Coral Glowing Border) */}
          {isGoldenBid && (
            <View style={styles.goldenBidRibbon}>
              <Feather name="zap" size={13} color="#FFF" />
              <Text style={styles.goldenBidRibbonText}>GOLDEN PRIORITY BID</Text>
              {currentCandidate.incoming_reaction && (
                <View style={styles.reactionTag}>
                  <Text style={styles.reactionTagText}>
                    {currentCandidate.incoming_reaction.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* STAMP INDICATORS */}
          <Animated.View style={[styles.stampBadge, styles.likeBadge, likeBadgeStyle]}>
            <Text style={styles.likeBadgeText}>LIKE</Text>
          </Animated.View>

          <Animated.View style={[styles.stampBadge, styles.rejectBadge, rejectBadgeStyle]}>
            <Text style={styles.rejectBadgeText}>PASS</Text>
          </Animated.View>

          <Animated.View style={[styles.stampBadge, styles.softPassBadge, passBadgeStyle]}>
            <Text style={styles.softPassBadgeText}>14-DAY SNOOZE</Text>
          </Animated.View>

          {/* TEASER DATA OVERLAY: FIRST NAME ONLY (Demographics strictly hidden) */}
          <View style={styles.cardOverlay}>
            <View style={styles.nameRow}>
              <Text style={styles.candidateName}>{currentCandidate.firstName}</Text>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* QUICK ACTION BUTTONS */}
      <View style={styles.actionButtonsRow}>
        {/* Hard Reject (Left) */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => handleHardReject(currentCandidate)}
          activeOpacity={0.8}
        >
          <Feather name="x" size={24} color={Colors.danger} />
        </TouchableOpacity>

        {/* Soft Pass 14 Days (Down) */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.softPassBtn]}
          onPress={() => handleSoftPass(currentCandidate)}
          activeOpacity={0.8}
        >
          <Feather name="clock" size={20} color={Colors.gold} />
        </TouchableOpacity>

        {/* Golden Bid Instant Like */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.goldenBidBtn]}
          onPress={() => {
            setUseGoldenBid(true);
            triggerLikeVibeSelect(currentCandidate);
          }}
          activeOpacity={0.8}
        >
          <Feather name="zap" size={22} color={Colors.coral} />
        </TouchableOpacity>

        {/* Categorized Silent Like (Right) */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.likeBtn]}
          onPress={() => triggerLikeVibeSelect(currentCandidate)}
          activeOpacity={0.8}
        >
          <Feather name="heart" size={24} color={Colors.success} />
        </TouchableOpacity>
      </View>

      {/* CATEGORIZED 'SILENT' LIKE BOTTOM SHEET MODAL (3 ICON-ONLY VIBES) */}
      <Modal
        visible={likeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setLikeModalVisible(false);
          resetPosition();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a Silent Vibe</Text>
              <Text style={styles.modalSubtitle}>
                No text comments allowed. Send an authentic non-verbal vibe to{" "}
                {pendingCandidate?.firstName}.
              </Text>
            </View>

            {/* 3 Icon-Only Vibe Options */}
            <View style={styles.vibesContainer}>
              {/* Vibe 1: Campus */}
              <TouchableOpacity
                style={styles.vibeCard}
                onPress={() => confirmLikeReaction("campus")}
                activeOpacity={0.85}
              >
                <View style={[styles.vibeIconCircle, { backgroundColor: "#1A2E26" }]}>
                  <Feather name="award" size={28} color={Colors.gold} />
                </View>
                <Text style={styles.vibeLabel}>Campus</Text>
                <Text style={styles.vibeSub}>Study & Student Life</Text>
              </TouchableOpacity>

              {/* Vibe 2: Coffee */}
              <TouchableOpacity
                style={styles.vibeCard}
                onPress={() => confirmLikeReaction("coffee")}
                activeOpacity={0.85}
              >
                <View style={[styles.vibeIconCircle, { backgroundColor: "#2E2419" }]}>
                  <Feather name="coffee" size={28} color="#E0A96D" />
                </View>
                <Text style={styles.vibeLabel}>Coffee</Text>
                <Text style={styles.vibeSub}>Casual Kigali Meetup</Text>
              </TouchableOpacity>

              {/* Vibe 3: Serious */}
              <TouchableOpacity
                style={styles.vibeCard}
                onPress={() => confirmLikeReaction("serious")}
                activeOpacity={0.85}
              >
                <View style={[styles.vibeIconCircle, { backgroundColor: "#162038" }]}>
                  <Feather name="shield" size={28} color={Colors.trust} />
                </View>
                <Text style={styles.vibeLabel}>Serious</Text>
                <Text style={styles.vibeSub}>Intentional Partnership</Text>
              </TouchableOpacity>
            </View>

            {/* Golden Bid Boost Toggle */}
            <TouchableOpacity
              style={[styles.goldenToggle, useGoldenBid && styles.goldenToggleActive]}
              onPress={() => {
                Haptics.selectionAsync?.();
                setUseGoldenBid(!useGoldenBid);
              }}
              activeOpacity={0.85}
            >
              <Feather name="zap" size={18} color={useGoldenBid ? Colors.coral : Colors.boneDim} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.goldenToggleTitle, useGoldenBid && { color: Colors.coral }]}>
                  Boost as Golden Bid
                </Text>
                <Text style={styles.goldenToggleSub}>
                  Sorts your card to the absolute top of their stack ({goldenBidsRemaining} left)
                </Text>
              </View>
              <View
                style={[
                  styles.toggleCheck,
                  useGoldenBid && { backgroundColor: Colors.coral, borderColor: Colors.coral },
                ]}
              >
                {useGoldenBid && <Feather name="check" size={14} color="#FFF" />}
              </View>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setLikeModalVisible(false);
                setPendingCandidate(null);
                setUseGoldenBid(false);
                resetPosition();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.65,
    borderRadius: 24,
    backgroundColor: Colors.ink,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  nextCard: {
    position: "absolute",
    transform: [{ scale: 0.94 }, { translateY: 12 }],
    opacity: 0.7,
  },
  goldenBidCard: {
    borderColor: Colors.coral,
    borderWidth: 2,
    backgroundColor: Colors.obsidianNavy,
    shadowColor: Colors.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  noPhotoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.inkRaised,
  },
  photoPagination: {
    position: "absolute",
    top: 12,
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 6,
    zIndex: 10,
  },
  paginationSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  paginationSegmentActive: {
    backgroundColor: Colors.bone,
  },
  photoTapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 5,
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 1,
  },
  goldenBidRibbon: {
    position: "absolute",
    top: 26,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.coral,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    zIndex: 15,
  },
  goldenBidRibbonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: "#FFF",
    letterSpacing: 0.5,
  },
  reactionTag: {
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  reactionTagText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    color: "#FFF",
  },
  stampBadge: {
    position: "absolute",
    top: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 3,
    zIndex: 20,
  },
  likeBadge: {
    left: 20,
    borderColor: Colors.success,
    backgroundColor: "rgba(20, 50, 30, 0.8)",
    transform: [{ rotate: "-15deg" }],
  },
  likeBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.success,
  },
  rejectBadge: {
    right: 20,
    borderColor: Colors.danger,
    backgroundColor: "rgba(50, 20, 20, 0.8)",
    transform: [{ rotate: "15deg" }],
  },
  rejectBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.danger,
  },
  softPassBadge: {
    bottom: 120,
    alignSelf: "center",
    borderColor: Colors.gold,
    backgroundColor: "rgba(50, 40, 20, 0.85)",
  },
  softPassBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: Colors.gold,
  },
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 40,
    backgroundColor: "rgba(10, 14, 23, 0.85)",
    gap: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  candidateName: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 30,
    color: Colors.bone,
  },
  approvedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.inkRaised,
    borderColor: Colors.trustDim,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  approvedPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.bone,
  },
  actionButtonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    marginTop: 18,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    backgroundColor: Colors.ink,
  },
  rejectBtn: {
    borderColor: "rgba(229, 83, 75, 0.4)",
  },
  softPassBtn: {
    borderColor: "rgba(201, 168, 76, 0.4)",
  },
  goldenBidBtn: {
    borderColor: Colors.coral,
    backgroundColor: "#201217",
  },
  likeBtn: {
    borderColor: "rgba(63, 185, 80, 0.4)",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
    gap: 14,
  },
  emptyTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 24,
    color: Colors.bone,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.boneDim,
    textAlign: "center",
    lineHeight: 21,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.trust,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 10,
  },
  refreshButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.bone,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.ink,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 1,
    borderColor: Colors.divider,
    gap: 18,
  },
  modalHeader: {
    gap: 6,
  },
  modalTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 20,
    color: Colors.bone,
  },
  modalSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.boneDim,
    lineHeight: 18,
  },
  vibesContainer: {
    flexDirection: "row",
    gap: 10,
  },
  vibeCard: {
    flex: 1,
    backgroundColor: Colors.inkRaised,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  vibeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  vibeLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.bone,
  },
  vibeSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.boneDim,
    textAlign: "center",
  },
  goldenToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.inkRaised,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  goldenToggleActive: {
    borderColor: Colors.coral,
    backgroundColor: "#201217",
  },
  goldenToggleTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: Colors.bone,
  },
  goldenToggleSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.boneDim,
    marginTop: 2,
  },
  toggleCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.boneDim,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.boneDim,
  },
});
