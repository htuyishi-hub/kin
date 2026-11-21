import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";
import { useTranslation } from "@workspace/i18n";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = 120;

type ModerationCandidate = {
  id: string;
  firstName: string;
  photos: string[];
  approvalScore: number;
  approverCount?: number;
  minApproversNeeded?: number;
  approvalThreshold?: number;
  accountStatus: string;
};

export default function ModerationReviewScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<ModerationCandidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);

  // Trust UX Confirmation Modal State
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<ModerationCandidate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  useEffect(() => {
    loadModerationQueue();
  }, [token]);

  async function loadModerationQueue() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/moderation/queue`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load moderation queue");
      }

      const data: ModerationCandidate[] = await res.json();
      setCandidates(data);
      setCurrentIndex(0);
      setPhotoIndex(0);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

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

  const triggerApprovePrompt = (candidate: ModerationCandidate) => {
    setPendingCandidate(candidate);
    setConfirmModalVisible(true);
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium);
  };

  async function handleConfirmApprove() {
    if (!pendingCandidate || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/moderation/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidateId: pendingCandidate.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to approve candidate");

      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
      setFeedbackBanner(
        data.activated
          ? t("moderation.activatedStatus", { name: pendingCandidate.firstName })
          : t("moderation.approvedStatus", { name: pendingCandidate.firstName })
      );

      setTimeout(() => setFeedbackBanner(null), 3000);
      setConfirmModalVisible(false);
      setPendingCandidate(null);
      advanceNextCard();
    } catch (err: any) {
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Error);
      alert(err?.message || t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeny(candidate: ModerationCandidate) {
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    try {
      await fetch(`${apiBaseUrl}/api/moderation/deny`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidateId: candidate.id }),
      });
    } catch {
      // non-fatal
    }
    advanceNextCard();
  }

  // Swipe Gestures: Right = Approve Prompt, Left = Deny
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translationX.value = event.translationX;
      translationY.value = event.translationY;
    })
    .onEnd((event) => {
      if (!currentCandidate) return;

      if (event.translationX > SWIPE_THRESHOLD) {
        translationX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(triggerApprovePrompt)(currentCandidate);
        });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translationX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(handleDeny)(currentCandidate);
        });
      } else {
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

  const approveBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translationX.value, [20, SWIPE_THRESHOLD], [0, 1]),
  }));

  const denyBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translationX.value, [-20, -SWIPE_THRESHOLD], [0, 1]),
  }));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.night }]}>
        <ActivityIndicator size="large" color={Colors.trust} />
        <Text style={[styles.loadingText, { color: Colors.boneDim }]}>
          {t("common.loading")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.night, paddingTop: insets.top + 16 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={20} color={Colors.bone} />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>{t("moderation.title")}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Feedback Banner */}
      {feedbackBanner && (
        <View style={styles.feedbackCard}>
          <Feather name="check-circle" size={18} color={Colors.success} />
          <Text style={styles.feedbackText}>{feedbackBanner}</Text>
        </View>
      )}

      {/* Main Review Area */}
      {!currentCandidate ? (
        <View style={styles.emptyContainer}>
          <Feather name="shield" size={54} color={Colors.gold} />
          <Text style={styles.emptyTitle}>{t("moderation.emptyTitle")}</Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadModerationQueue}
            activeOpacity={0.85}
          >
            <Feather name="rotate-cw" size={16} color={Colors.bone} />
            <Text style={styles.btnText}>{t("moderation.refresh")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.deckArea}>
          {/* Background Card */}
          {nextCandidate && (
            <View style={[styles.card, styles.nextCard]}>
              <Image
                source={{ uri: nextCandidate.photos[0] ?? "" }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              <View style={styles.cardOverlay}>
                <Text style={styles.candidateName}>{nextCandidate.firstName}</Text>
              </View>
            </View>
          )}

          {/* Active Card */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.card, cardAnimatedStyle]}>
              {currentCandidate.photos[photoIndex] ? (
                <Image
                  source={{ uri: currentCandidate.photos[photoIndex] }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noPhotoPlaceholder}>
                  <Feather name="user" size={64} color={Colors.boneDim} />
                </View>
              )}

              {/* Photo Pagination (Strictly max 2 photos) */}
              {currentCandidate.photos.length > 1 && (
                <View style={styles.photoPagination}>
                  {currentCandidate.photos.map((_, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.paginationSegment,
                        idx === photoIndex && styles.paginationSegmentActive,
                      ]}
                      onPress={() => setPhotoIndex(idx)}
                      activeOpacity={0.8}
                    />
                  ))}
                </View>
              )}

              {/* Stamp Badges */}
              <Animated.View style={[styles.stampBadge, styles.approveBadge, approveBadgeStyle]}>
                <Text style={styles.approveBadgeText}>{t("moderation.approve").toUpperCase()}</Text>
              </Animated.View>

              <Animated.View style={[styles.stampBadge, styles.denyBadge, denyBadgeStyle]}>
                <Text style={styles.denyBadgeText}>{t("moderation.deny").toUpperCase()}</Text>
              </Animated.View>

              {/* Teaser Overlay: FIRST NAME ONLY */}
              <View style={styles.cardOverlay}>
                <Text style={styles.candidateName}>{currentCandidate.firstName}</Text>
              </View>
            </Animated.View>
          </GestureDetector>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.denyBtn]}
              onPress={() => handleDeny(currentCandidate)}
              activeOpacity={0.85}
            >
              <Feather name="x" size={26} color={Colors.danger} />
              <Text style={styles.actionBtnText}>{t("moderation.deny")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => triggerApprovePrompt(currentCandidate)}
              activeOpacity={0.85}
            >
              <Feather name="check" size={26} color={Colors.success} />
              <Text style={styles.actionBtnText}>{t("moderation.approve")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* TRUST UX CONFIRMATION MODAL */}
      <Modal
        visible={confirmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setConfirmModalVisible(false);
          resetPosition();
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Feather name="alert-triangle" size={32} color={Colors.gold} />
            </View>

            <Text style={styles.modalTitle}>
              {t("moderation.confirmTitle", { name: pendingCandidate?.firstName ?? "" })}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => {
                  setConfirmModalVisible(false);
                  setPendingCandidate(null);
                  resetPosition();
                }}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelModalBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmApproveBtn}
                onPress={handleConfirmApprove}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.bone} size="small" />
                ) : (
                  <Text style={styles.confirmApproveBtnText}>{t("moderation.confirmButton")}</Text>
                )}
              </TouchableOpacity>
            </View>
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.inkRaised,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleBlock: {
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 18,
    color: Colors.bone,
  },
  feedbackCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#132D1F",
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  feedbackText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.bone,
    flex: 1,
  },
  deckArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: SCREEN_WIDTH - 36,
    height: SCREEN_HEIGHT * 0.62,
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
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 36,
    backgroundColor: "rgba(10, 14, 23, 0.88)",
    gap: 8,
  },
  candidateName: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 30,
    color: Colors.bone,
  },
  stampBadge: {
    position: "absolute",
    top: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 3,
    zIndex: 20,
  },
  approveBadge: {
    left: 20,
    borderColor: Colors.success,
    backgroundColor: "rgba(20, 50, 30, 0.8)",
    transform: [{ rotate: "-15deg" }],
  },
  approveBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.success,
  },
  denyBadge: {
    right: 20,
    borderColor: Colors.danger,
    backgroundColor: "rgba(50, 20, 20, 0.8)",
    transform: [{ rotate: "15deg" }],
  },
  denyBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.danger,
  },
  actionRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  denyBtn: {
    backgroundColor: Colors.ink,
    borderColor: "rgba(229, 83, 75, 0.4)",
  },
  approveBtn: {
    backgroundColor: Colors.ink,
    borderColor: "rgba(63, 185, 80, 0.4)",
  },
  actionBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.bone,
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
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.trust,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.bone,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: Colors.ink,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.goldDim,
    padding: 24,
    alignItems: "center",
    gap: 14,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2E2419",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  modalTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 20,
    color: Colors.bone,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.inkRaised,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  cancelModalBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.boneDim,
  },
  confirmApproveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.trust,
    alignItems: "center",
  },
  confirmApproveBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: Colors.bone,
  },
});
