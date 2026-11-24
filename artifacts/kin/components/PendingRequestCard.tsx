import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ScreenCapture from "expo-screen-capture";
import { useTranslation } from "@workspace/i18n";
import { Colors } from "../constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type PendingRequestItem = {
  id: string;
  senderId: string;
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
  createdAt: string;
};

interface PendingRequestCardProps {
  request: PendingRequestItem;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  isAccepting?: boolean;
  isDeclining?: boolean;
}

export function PendingRequestCard({
  request,
  onAccept,
  onDecline,
  isAccepting,
  isDeclining,
}: PendingRequestCardProps) {
  const { t } = useTranslation();

  if (Platform.OS !== "web") {
    ScreenCapture.usePreventScreenCapture();
  }

  const locationStr =
    request.campusName || request.faculty
      ? [request.faculty, request.campusName].filter(Boolean).join(" · ")
      : [request.city, request.district].filter(Boolean).join(" · ");

  const handlePressAccept = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onAccept(request.id);
  };

  const handlePressDecline = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onDecline(request.id);
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.card}>
        {/* Photo or Placeholder */}
        {request.photoUrl ? (
          <Image source={{ uri: request.photoUrl }} style={styles.cardImage} contentFit="cover" />
        ) : (
          <View style={styles.placeholderImage}>
            <Feather name="user" size={64} color={Colors.boneDim} />
          </View>
        )}

        {/* Top "Wants to talk" Badge */}
        <View style={styles.ribbon}>
          <Feather name="message-circle" size={14} color={Colors.gold} />
          <Text style={styles.ribbonText}>{t("requests.badge")}</Text>
        </View>

        {/* Bottom Details Overlay */}
        <View style={styles.cardOverlay}>
          <View style={styles.nameRow}>
            <Text style={styles.nameText}>
              {request.firstName}
              {request.age ? `, ${request.age}` : ""}
            </Text>
            {request.isVerified && (
              <Feather name="check-circle" size={18} color={Colors.trust} style={styles.verifiedIcon} />
            )}
          </View>

          {Boolean(locationStr) && <Text style={styles.locationText}>{locationStr}</Text>}

          {Boolean(request.bio) && <Text style={styles.bioText}>{request.bio}</Text>}

          {Array.isArray(request.tags) && request.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {request.tags.map((tag, idx) => (
                <View key={`req-tag-${idx}`} style={styles.tagBadge}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons: Decline / Accept */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={handlePressDecline}
              disabled={isDeclining || isAccepting}
              activeOpacity={0.8}
            >
              {isDeclining ? (
                <ActivityIndicator size="small" color={Colors.danger} />
              ) : (
                <>
                  <Feather name="x" size={20} color={Colors.danger} />
                  <Text style={styles.declineBtnText}>{t("requests.decline")}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={handlePressAccept}
              disabled={isDeclining || isAccepting}
              activeOpacity={0.8}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color={Colors.bone} />
              ) : (
                <>
                  <Feather name="heart" size={20} color={Colors.bone} />
                  <Text style={styles.acceptBtnText}>{t("requests.accept")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: SCREEN_WIDTH - 32,
    flex: 1,
    borderRadius: 24,
    backgroundColor: Colors.ink,
    borderWidth: 1.5,
    borderColor: Colors.goldDim,
    overflow: "hidden",
    position: "relative",
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    backgroundColor: Colors.inkRaised,
    justifyContent: "center",
    alignItems: "center",
  },
  ribbon: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(13, 17, 23, 0.85)",
    borderWidth: 1,
    borderColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    zIndex: 10,
  },
  ribbonText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  cardOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "rgba(13, 17, 23, 0.92)",
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nameText: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.bone,
  },
  verifiedIcon: {
    marginLeft: 8,
  },
  locationText: {
    fontSize: 13,
    color: Colors.boneDim,
    marginTop: 4,
  },
  bioText: {
    fontSize: 14,
    color: Colors.bone,
    lineHeight: 20,
    marginTop: 10,
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
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  declineBtn: {
    backgroundColor: "rgba(229, 83, 75, 0.15)",
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.danger,
  },
  acceptBtn: {
    backgroundColor: Colors.trust,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.bone,
  },
});
