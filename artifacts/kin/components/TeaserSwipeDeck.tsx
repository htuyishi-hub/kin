import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
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
import { useTranslation } from "@workspace/i18n";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { resolveAudioUrl, getVoiceSignedUrl } from "@/services/voiceIntroService";
import { getPhotoSignedUrl } from "@/services/photoUploadService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_THRESHOLD = 120;

export type TeaserCandidate = {
  id: string;
  firstName: string;
  fullName?: string;
  age?: number | null;
  location?: string | null;
  occupation?: string | null;
  isUrStudent?: boolean;
  isVerified?: boolean;
  photos: string[];
  primaryPhotoPath?: string | null;
  is_golden_bid?: boolean;
  incoming_reaction?: "campus" | "coffee" | "serious" | null;
  intent_class?: string;
  primaryIntent?: string;
  trustScore?: number;
  approvedBy?: { fullName: string; firstName: string; isVerified: boolean } | null;
  vouchedBy?: { fullName: string; firstName: string; isVerified: boolean } | null;
  bio?: string | null;
  tags?: string[];
  voiceIntroPath?: string | null;
  voiceIntroDurationMs?: number | null;
};

type ReactionType = "campus" | "coffee" | "serious";

interface TeaserSwipeDeckProps {
  candidates: TeaserCandidate[];
  onSwipeRight: (candidate: TeaserCandidate, reaction: ReactionType, isGoldenBid: boolean) => void;
  onSwipeLeft: (candidate: TeaserCandidate) => void;
  onSwipeDown: (candidate: TeaserCandidate) => void;
  onRewind?: (candidate: TeaserCandidate) => void;
  goldenBidsRemaining?: number;
  onRefresh?: () => void;
}

function TeaserCardImage({
  photoRef,
  style,
}: {
  photoRef: string | null | undefined;
  style: any;
}) {
  const [uri, setUri] = useState<string | null>(() => {
    if (!photoRef) return null;
    if (photoRef.startsWith("http://") || photoRef.startsWith("https://")) return photoRef;
    return null;
  });

  const loadUrl = async (forceRefresh = false) => {
    if (!photoRef) {
      setUri(null);
      return;
    }
    if (photoRef.startsWith("http://") || photoRef.startsWith("https://")) {
      setUri(photoRef);
      return;
    }
    const signed = await getPhotoSignedUrl(photoRef, forceRefresh);
    if (signed) setUri(signed);
  };

  useEffect(() => {
    loadUrl();
  }, [photoRef]);

  if (!uri) {
    return (
      <View style={[style, styles.noPhotoPlaceholder]}>
        <Feather name="user" size={64} color={Colors.boneDim} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="cover"
      onError={() => loadUrl(true)}
    />
  );
}

function CandidateVoicePlayer({
  candidateId,
  path,
  durationMs,
}: {
  candidateId?: string;
  path: string;
  durationMs?: number | null;
}) {
  const { t } = useTranslation();
  const [audioUri, setAudioUri] = useState<string | null>(() => {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return resolveAudioUrl(path);
  });

  const loadVoice = async (forceRefresh = false) => {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      setAudioUri(path);
      return;
    }
    const target = candidateId || path;
    const signed = await getVoiceSignedUrl(target, forceRefresh);
    if (signed) setAudioUri(signed);
  };

  useEffect(() => {
    loadVoice();
  }, [candidateId, path]);

  const player = useAudioPlayer(audioUri);
  const status = useAudioPlayerStatus(player);
  const isPlaying = Boolean(status.playing);

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      if (!audioUri) {
        loadVoice(true).then(() => player.play());
      } else {
        player.play();
      }
    }
  };

  const seconds = durationMs ? Math.round(durationMs / 1000) : Math.round(status.duration || 5);

  return (
    <TouchableOpacity
      style={styles.voicePill}
      onPress={togglePlay}
      activeOpacity={0.8}
    >
      <Feather
        name={isPlaying ? "pause" : "play"}
        size={13}
        color={Colors.gold}
      />
      <Feather name="volume-2" size={13} color={Colors.boneDim} />
      <Text style={styles.voiceDurationText}>
        {t("profile.voiceDuration", { seconds: Math.max(1, seconds) })}
      </Text>
    </TouchableOpacity>
  );
}

export function TeaserSwipeDeck({
  candidates,
  onSwipeRight,
  onSwipeLeft,
  onSwipeDown,
  onRewind,
  goldenBidsRemaining = 3,
  onRefresh,
}: TeaserSwipeDeckProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [likeModalVisible, setLikeModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [complimentModalVisible, setComplimentModalVisible] = useState(false);
  const [complimentText, setComplimentText] = useState("");
  const [sendingCompliment, setSendingCompliment] = useState(false);
  const [complimentSent, setComplimentSent] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<TeaserCandidate | null>(null);
  const [useGoldenBid, setUseGoldenBid] = useState(false);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  const handleSendCompliment = async () => {
    if (!token || !currentCandidate || !complimentText.trim()) return;
    setSendingCompliment(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/photos/compliment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetId: currentCandidate.id,
          photoIndex,
          comment: complimentText.trim(),
        }),
      });
      if (res.ok) {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
        setComplimentSent(true);
        setComplimentText("");
        setTimeout(() => {
          setComplimentModalVisible(false);
          setComplimentSent(false);
        }, 900);
      }
    } finally {
      setSendingCompliment(false);
    }
  };

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
    setInfoModalVisible(false);
    translationX.value = 0;
    translationY.value = 0;
  };

  const handleRewindLast = () => {
    if (currentIndex <= 0) return;
    const prevIdx = currentIndex - 1;
    const prevCandidate = candidates[prevIdx];
    Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light);
    setCurrentIndex(prevIdx);
    setPhotoIndex(0);
    setInfoModalVisible(false);
    if (prevCandidate && onRewind) {
      onRewind(prevCandidate);
    }
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
        <Text style={styles.emptyTitle}>{t("discover.noMoreProfiles")}</Text>
        <Text style={styles.emptySubtitle}>
          {t("discover.checkBackLater")}
        </Text>
        {onRefresh && (
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} activeOpacity={0.85}>
            <Feather name="rotate-cw" size={16} color={Colors.bone} />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const photos = currentCandidate.photos.length > 0
    ? currentCandidate.photos.slice(0, 6)
    : currentCandidate.primaryPhotoPath
      ? [currentCandidate.primaryPhotoPath]
      : [];
  const currentPhotoUrl = photos[photoIndex] ?? currentCandidate.primaryPhotoPath;
  const isGoldenBid = Boolean(currentCandidate.is_golden_bid);
  const intentRaw = (currentCandidate.primaryIntent || currentCandidate.intent_class || "").toLowerCase();
  const intentBadgeText = intentRaw.includes("marriage")
    ? t("intent.marriage")
    : intentRaw.includes("casual")
      ? t("intent.casual")
      : t("intent.serious");

  return (
    <View style={styles.container}>
      {/* Background card preview */}
      {nextCandidate && (
        <View style={[styles.card, styles.nextCard]}>
          <TeaserCardImage
            photoRef={nextCandidate.photos[0] ?? nextCandidate.primaryPhotoPath}
            style={styles.cardImage}
          />
          <View style={styles.cardOverlay}>
            <Text style={styles.candidateName}>
              {nextCandidate.firstName}{nextCandidate.age ? `, ${nextCandidate.age}` : ""}
            </Text>
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
          <TeaserCardImage
            photoRef={currentPhotoUrl}
            style={styles.cardImage}
          />

          {/* Segmented Progress Bars at Top */}
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

          {/* Left / Right Tap Zones */}
          {photos.length > 1 && (
            <View style={styles.photoTapZones} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.tapLeft}
                onPress={() => {
                  Haptics.selectionAsync?.();
                  setPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
                }}
                activeOpacity={1}
              />
              <TouchableOpacity
                style={styles.tapRight}
                onPress={() => {
                  Haptics.selectionAsync?.();
                  setPhotoIndex((prev) => (prev + 1) % photos.length);
                }}
                activeOpacity={1}
              />
            </View>
          )}

          {/* TOP BADGES: Intent + UR Student */}
          <View style={{ position: "absolute", top: photos.length > 1 ? 26 : 14, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 15 }} pointerEvents="none">
            <View style={{ flexDirection: "row", gap: 6 }}>
              {currentCandidate.isUrStudent && (
                <View style={{ backgroundColor: "#2563EB", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" }}>
                    {t("discover.urStudentBadge")}
                  </Text>
                </View>
              )}
            </View>
            <View style={{ backgroundColor: "rgba(13,17,23,0.8)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
              <Text style={{ color: Colors.bone, fontSize: 11, fontFamily: "Inter_600SemiBold" }}>
                {intentBadgeText}
              </Text>
            </View>
          </View>

          {/* GOLDEN BID BADGE */}
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

          {/* RICH BOTTOM INFORMATION OVERLAY */}
          <View style={styles.cardOverlay}>
            <View style={[styles.nameRow, { justifyContent: "space-between", alignItems: "flex-end" }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.candidateName}>
                    {currentCandidate.firstName}{currentCandidate.age ? `, ${currentCandidate.age}` : ""}
                  </Text>
                  {(currentCandidate.isVerified || currentCandidate.isUrStudent) && (
                    <Feather name="check-circle" size={18} color="#38BDF8" />
                  )}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
                  {!!currentCandidate.location && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="map-pin" size={12} color="#38BDF8" />
                      <Text style={{ color: "#CBD5E1", fontSize: 12, fontFamily: "Inter_500Medium" }}>
                        {currentCandidate.location}
                      </Text>
                    </View>
                  )}
                  {!!currentCandidate.occupation && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="briefcase" size={12} color={Colors.gold} />
                      <Text style={{ color: "#CBD5E1", fontSize: 12, fontFamily: "Inter_500Medium" }}>
                        {currentCandidate.occupation}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setComplimentSent(false);
                    setComplimentModalVisible(true);
                  }}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(201,168,76,0.22)", borderWidth: 1, borderColor: "rgba(201,168,76,0.5)", alignItems: "center", justifyContent: "center" }}
                  activeOpacity={0.8}
                >
                  <Feather name="message-circle" size={16} color={Colors.gold} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setInfoModalVisible(true)}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
                  activeOpacity={0.8}
                >
                  <Feather name="info" size={17} color={Colors.bone} />
                </TouchableOpacity>
              </View>
            </View>

            {currentCandidate.tags && currentCandidate.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {currentCandidate.tags.slice(0, 4).map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>#{t(`tags.${tag}`, { defaultValue: tag })}</Text>
                  </View>
                ))}
              </View>
            )}
            {!!currentCandidate.voiceIntroPath && (
              <CandidateVoicePlayer
                key={currentCandidate.id + "_" + currentCandidate.voiceIntroPath}
                candidateId={currentCandidate.id}
                path={currentCandidate.voiceIntroPath}
                durationMs={currentCandidate.voiceIntroDurationMs}
              />
            )}
            {!!currentCandidate.bio && (
              <Text style={styles.bioText} numberOfLines={2}>
                {currentCandidate.bio}
              </Text>
            )}
          </View>
        </Animated.View>
      </GestureDetector>

      {/* 4-BUTTON ACTION DOCK: Rewind, Pass, Like, Super Like */}
      <View style={styles.actionButtonsRow}>
        {/* Rewind (Undo) */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.softPassBtn, { opacity: currentIndex > 0 ? 1 : 0.35 }]}
          onPress={handleRewindLast}
          disabled={currentIndex <= 0}
          activeOpacity={0.8}
        >
          <Feather name="rotate-ccw" size={20} color="#F59E0B" />
        </TouchableOpacity>

        {/* Pass */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => handleHardReject(currentCandidate)}
          activeOpacity={0.8}
        >
          <Feather name="x" size={26} color={Colors.danger} />
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.likeBtn]}
          onPress={() => triggerLikeVibeSelect(currentCandidate)}
          activeOpacity={0.8}
        >
          <Feather name="heart" size={26} color={Colors.success} />
        </TouchableOpacity>

        {/* Super Like (Golden Bid) */}
        <TouchableOpacity
          style={[styles.actionBtn, styles.goldenBidBtn]}
          onPress={() => {
            setUseGoldenBid(true);
            triggerLikeVibeSelect(currentCandidate);
          }}
          activeOpacity={0.8}
        >
          <Feather name="star" size={22} color="#38BDF8" />
        </TouchableOpacity>
      </View>

      {/* PHOTO COMPLIMENT MODAL (200 RWF) */}
      <Modal
        visible={complimentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setComplimentModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { gap: 12 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.modalTitle}>{t("compliment.title")}</Text>
              <TouchableOpacity onPress={() => setComplimentModalVisible(false)}>
                <Feather name="x" size={22} color={Colors.boneDim} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={complimentText}
              onChangeText={setComplimentText}
              placeholder={t("compliment.placeholder")}
              placeholderTextColor={Colors.boneGhost}
              maxLength={140}
              style={{
                backgroundColor: Colors.inkRaised,
                color: Colors.bone,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
              }}
            />
            {complimentSent ? (
              <View style={{ paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ color: "#3FB950", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                  {t("compliment.sent")}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleSendCompliment}
                disabled={sendingCompliment || !complimentText.trim()}
                style={{
                  backgroundColor: Colors.gold,
                  paddingVertical: 13,
                  borderRadius: 999,
                  alignItems: "center",
                  opacity: sendingCompliment || !complimentText.trim() ? 0.5 : 1,
                }}
                activeOpacity={0.85}
              >
                {sendingCompliment ? (
                  <ActivityIndicator size="small" color="#0D1117" />
                ) : (
                  <Text style={{ color: "#0D1117", fontFamily: "Inter_700Bold", fontSize: 14 }}>
                    {t("compliment.send")}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* FULL PROFILE DETAILS MODAL */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { gap: 12 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.modalTitle}>
                  {currentCandidate.firstName}{currentCandidate.age ? `, ${currentCandidate.age}` : ""}
                </Text>
                {(currentCandidate.isVerified || currentCandidate.isUrStudent) && (
                  <Feather name="check-circle" size={18} color="#38BDF8" />
                )}
              </View>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                <Feather name="x" size={22} color={Colors.boneDim} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <View style={{ backgroundColor: Colors.inkRaised, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ color: Colors.bone, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{intentBadgeText}</Text>
              </View>
              {currentCandidate.isUrStudent && (
                <View style={{ backgroundColor: "#2563EB", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" }}>{t("discover.urStudentBadge")}</Text>
                </View>
              )}
            </View>
            {!!currentCandidate.location && (
              <Text style={{ color: Colors.boneDim, fontSize: 13 }}>📍 {currentCandidate.location}</Text>
            )}
            {!!currentCandidate.occupation && (
              <Text style={{ color: Colors.boneDim, fontSize: 13 }}>💼 {currentCandidate.occupation}</Text>
            )}
            {!!currentCandidate.bio && (
              <Text style={{ color: Colors.bone, fontSize: 14, lineHeight: 20 }}>{currentCandidate.bio}</Text>
            )}
            {currentCandidate.tags && currentCandidate.tags.length > 0 && (
              <View style={styles.tagsRow}>
                {currentCandidate.tags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>#{t(`tags.${tag}`, { defaultValue: tag })}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Modal>

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
              <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
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
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tagChip: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagChipText: {
    fontSize: 11,
    color: Colors.boneDim,
    fontWeight: "500",
  },
  bioText: {
    fontSize: 13,
    color: Colors.boneDim,
    lineHeight: 18,
    marginTop: 2,
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
  voicePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(13, 17, 23, 0.75)",
    borderColor: "rgba(201, 168, 76, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginVertical: 4,
  },
  voiceDurationText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.gold,
  },
});
