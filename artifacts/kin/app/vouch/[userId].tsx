import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";

type TeaserPhoto = {
  id: string;
  publicUrl: string | null;
  isPrimary: boolean | null;
};

type TeaserProfile = {
  id: string;
  fullName: string;
  firstName: string;
  gender: string | null;
  age: number | null;
  campusName: string | null;
  faculty: string | null;
  yearOfStudy: number | null;
  city: string | null;
  district: string | null;
  primaryIntent: string | null;
  accountStatus: string;
  isVerified: boolean;
  vouchCount: number;
  photos: TeaserPhoto[];
  alreadyVouched: boolean;
  isSelf: boolean;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function VouchScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [teaser, setTeaser] = useState<TeaserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmedConsent, setConfirmedConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vouchSuccess, setVouchSuccess] = useState(false);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  useEffect(() => {
    if (!userId) return;
    loadTeaser();
  }, [userId, token]);

  async function loadTeaser() {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiBaseUrl}/api/vouches/teaser/${userId}`, {
        headers,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to load candidate profile.");
      }

      const data: TeaserProfile = await res.json();
      setTeaser(data);
    } catch (err: any) {
      setError(err?.message || "Could not retrieve vouch profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteVouch() {
    if (!confirmedConsent || !userId || submitting) return;

    if (!token) {
      router.push("/(onboarding)/welcome");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/vouches/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voucheeId: userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit public vouch.");
      }

      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
      setVouchSuccess(true);
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 2400);
    } catch (err: any) {
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Error);
      setError(err?.message || "Vouch failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.night }]}>
        <ActivityIndicator size="large" color={Colors.trust} />
        <Text style={[styles.loadingText, { color: Colors.boneDim }]}>
          Loading teaser profile...
        </Text>
      </View>
    );
  }

  if (error && !teaser) {
    return (
      <View style={[styles.center, { backgroundColor: Colors.night, paddingHorizontal: 32 }]}>
        <Feather name="alert-circle" size={48} color={Colors.danger} />
        <Text style={[styles.errorTitle, { color: Colors.bone }]}>Unable to Open Vouch</Text>
        <Text style={[styles.errorSubtitle, { color: Colors.boneDim }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: Colors.trust }]}
          onPress={loadTeaser}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: Colors.bone }]}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.textBtn, { marginTop: 12 }]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={{ color: Colors.boneDim, fontSize: 14 }}>Return to App</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!teaser) return null;

  const photos = teaser.photos.slice(0, 2); // Strictly max 2 photos
  const isSelf = teaser.isSelf;
  const alreadyVouched = teaser.alreadyVouched || vouchSuccess;
  const isLoggedIn = Boolean(token);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.night }]}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
          }}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={20} color={Colors.bone} />
        </TouchableOpacity>
        <View style={styles.headerBadge}>
          <Feather name="shield" size={14} color={Colors.gold} />
          <Text style={styles.headerBadgeText}>Public Approval Request</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* SUCCESS BANNER */}
      {vouchSuccess && (
        <View style={styles.successCard}>
          <Feather name="check-circle" size={28} color={Colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.successTitle}>Approval Confirmed!</Text>
            <Text style={styles.successSub}>
              You have publicly approved {teaser.fullName}. Their account is now active and your trust reputation is linked.
            </Text>
          </View>
        </View>
      )}

      {/* ALREADY APPROVED BANNER */}
      {alreadyVouched && !vouchSuccess && (
        <View style={styles.infoCard}>
          <Feather name="user-check" size={24} color={Colors.trust} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Already Approved</Text>
            <Text style={styles.infoSub}>
              You have already publicly approved {teaser.fullName}. They are verified and active on Kin.
            </Text>
          </View>
        </View>
      )}

      {/* SELF LINK BANNER */}
      {isSelf && (
        <View style={styles.infoCard}>
          <Feather name="info" size={24} color={Colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Your Personal Approval Link</Text>
            <Text style={styles.infoSub}>
              This is how your teaser profile appears to active Kin members. Share this link with trusted friends so they can approve your account.
            </Text>
          </View>
        </View>
      )}

      {/* TEASER PROFILE DISPLAY (STRICTLY 2 IMAGES MAX + BASIC DEMOGRAPHICS) */}
      <View style={styles.teaserSection}>
        <View style={styles.photosContainer}>
          {photos.length > 0 ? (
            <View style={styles.photosRow}>
              {photos.map((p, idx) => (
                <View key={p.id || idx} style={styles.photoWrapper}>
                  {p.publicUrl ? (
                    <Image
                      source={{ uri: p.publicUrl }}
                      style={styles.teaserImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Feather name="user" size={40} color={Colors.boneDim} />
                    </View>
                  )}
                  <View style={styles.photoPill}>
                    <Text style={styles.photoPillText}>Photo {idx + 1} of 2</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noPhotoCard}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {teaser.fullName
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </Text>
              </View>
              <Text style={styles.noPhotoText}>Profile Under Verification</Text>
            </View>
          )}
        </View>

        {/* Identity & Demographics */}
        <View style={styles.profileDetailsCard}>
          <View style={styles.nameHeader}>
            <Text style={styles.userName}>
              {teaser.fullName}
              {teaser.age ? `, ${teaser.age}` : ""}
            </Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {teaser.accountStatus === "active" ? "Active Member" : "Waitlisted Candidate"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Demographic Rows */}
          <View style={styles.detailsList}>
            {teaser.gender ? (
              <View style={styles.detailRow}>
                <Feather name="user" size={16} color={Colors.boneDim} />
                <Text style={styles.detailLabel}>Gender:</Text>
                <Text style={styles.detailValue}>
                  {teaser.gender.charAt(0).toUpperCase() + teaser.gender.slice(1)}
                </Text>
              </View>
            ) : null}

            {teaser.campusName ? (
              <View style={styles.detailRow}>
                <Feather name="award" size={16} color={Colors.gold} />
                <Text style={styles.detailLabel}>Campus:</Text>
                <Text style={styles.detailValue}>{teaser.campusName}</Text>
              </View>
            ) : null}

            {teaser.faculty ? (
              <View style={styles.detailRow}>
                <Feather name="book-open" size={16} color={Colors.boneDim} />
                <Text style={styles.detailLabel}>Faculty:</Text>
                <Text style={styles.detailValue}>{teaser.faculty}</Text>
              </View>
            ) : null}

            {teaser.city ? (
              <View style={styles.detailRow}>
                <Feather name="map-pin" size={16} color={Colors.boneDim} />
                <Text style={styles.detailLabel}>Location:</Text>
                <Text style={styles.detailValue}>
                  {teaser.city}
                  {teaser.district ? `, ${teaser.district}` : ""}
                </Text>
              </View>
            ) : null}

            {teaser.primaryIntent ? (
              <View style={styles.detailRow}>
                <Feather name="compass" size={16} color={Colors.trust} />
                <Text style={styles.detailLabel}>Looking For:</Text>
                <Text style={[styles.detailValue, { color: Colors.bone }]}>
                  {teaser.primaryIntent}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* SOCIAL ACCOUNTABILITY WARNING & HIGH-FRICTION CONFIRMATION */}
      {!isSelf && !alreadyVouched && (
        <View style={styles.vouchActionCard}>
          <View style={styles.accountabilityHeader}>
            <Feather name="alert-triangle" size={20} color={Colors.gold} />
            <Text style={styles.accountabilityTitle}>Social Accountability Policy</Text>
          </View>

          <Text style={styles.accountabilityBody}>
            Kin is built on authentic community trust. By publicly approving{" "}
            <Text style={{ color: Colors.bone, fontFamily: "Inter_600SemiBold" }}>
              {teaser.fullName}
            </Text>
            , your verified identity will be permanently tied to their profile.
          </Text>

          <View style={styles.penaltyNotice}>
            <Feather name="shield-off" size={16} color={Colors.danger} />
            <Text style={styles.penaltyText}>
              <Text style={{ fontFamily: "Inter_600SemiBold", color: Colors.bone }}>
                Direct Penalty Trigger:
              </Text>{" "}
              If this member is ever banned for harassment, impersonation, or safety violations, your
              own Trust Score will be automatically lowered.
            </Text>
          </View>

          {!isLoggedIn ? (
            <TouchableOpacity
              style={[styles.vouchButton, { backgroundColor: Colors.trust, marginTop: 16 }]}
              onPress={() => router.push("/(onboarding)/welcome")}
              activeOpacity={0.85}
            >
              <Feather name="log-in" size={18} color={Colors.bone} />
              <Text style={styles.vouchButtonText}>Sign In with Kin to Approve</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* High Friction Confirmation Toggle */}
              <TouchableOpacity
                style={styles.frictionConsentRow}
                onPress={() => {
                  Haptics.selectionAsync?.();
                  setConfirmedConsent(!confirmedConsent);
                }}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkbox,
                    confirmedConsent && {
                      backgroundColor: Colors.trust,
                      borderColor: Colors.trust,
                    },
                  ]}
                >
                  {confirmedConsent && <Feather name="check" size={14} color={Colors.bone} />}
                </View>
                <Text style={styles.frictionConsentText}>
                  I personally know this candidate and can vouch for their authenticity.
                </Text>
              </TouchableOpacity>

              {error && <Text style={styles.errorText}>{error}</Text>}

              {/* HIGH-FRICTION ACTION BUTTON */}
              <TouchableOpacity
                style={[
                  styles.vouchButton,
                  {
                    backgroundColor: confirmedConsent ? Colors.trust : Colors.inkRaised,
                    opacity: confirmedConsent && !submitting ? 1 : 0.6,
                  },
                ]}
                onPress={handleExecuteVouch}
                disabled={!confirmedConsent || submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.bone} size="small" />
                ) : (
                  <>
                    <Feather name="shield" size={18} color={Colors.bone} style={{ marginRight: 6 }} />
                    <Text style={styles.vouchButtonText}>
                      I publicly approve this person. I confirm they are real, safe, and looking for intentional connections.
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Return to App Button */}
      {(alreadyVouched || isSelf) && (
        <TouchableOpacity
          style={[styles.returnButton, { backgroundColor: Colors.inkRaised }]}
          onPress={() => router.replace("/(tabs)")}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: Colors.bone }]}>Open Kin Discovery</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 18,
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
    marginTop: 8,
  },
  errorTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginTop: 12,
    textAlign: "center",
  },
  errorSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  textBtn: {
    padding: 8,
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.inkRaised,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.inkRaised,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  headerBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.bone,
    letterSpacing: 0.2,
  },
  successCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: "#132D1F",
    borderColor: Colors.success,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
  },
  successTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.bone,
    marginBottom: 4,
  },
  successSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.boneDim,
    lineHeight: 18,
  },
  infoCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: Colors.ink,
    borderColor: Colors.divider,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
  },
  infoTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.bone,
    marginBottom: 4,
  },
  infoSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.boneDim,
    lineHeight: 18,
  },
  teaserSection: {
    gap: 14,
  },
  photosContainer: {
    width: "100%",
  },
  photosRow: {
    flexDirection: "row",
    gap: 12,
  },
  photoWrapper: {
    flex: 1,
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: Colors.inkRaised,
    position: "relative",
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  teaserImage: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  photoPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(13, 17, 23, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  photoPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: Colors.boneDim,
  },
  noPhotoCard: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.divider,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.inkRaised,
    borderWidth: 2,
    borderColor: Colors.trust,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 26,
    color: Colors.bone,
  },
  noPhotoText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.boneDim,
  },
  profileDetailsCard: {
    backgroundColor: Colors.ink,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    padding: 18,
    gap: 14,
  },
  nameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userName: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 22,
    color: Colors.bone,
    flex: 1,
  },
  statusPill: {
    backgroundColor: Colors.inkRaised,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  statusPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.gold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  detailsList: {
    gap: 10,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.boneDim,
    width: 80,
  },
  detailValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.bone,
    flex: 1,
  },
  vouchActionCard: {
    backgroundColor: Colors.ink,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.goldDim,
    padding: 18,
    gap: 14,
  },
  accountabilityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  accountabilityTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.gold,
  },
  accountabilityBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.boneDim,
    lineHeight: 19,
  },
  penaltyNotice: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#2B1617",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: "flex-start",
  },
  penaltyText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.boneDim,
    lineHeight: 17,
  },
  frictionConsentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.boneDim,
    justifyContent: "center",
    alignItems: "center",
  },
  frictionConsentText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.bone,
    lineHeight: 18,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.danger,
    textAlign: "center",
  },
  vouchButton: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  vouchButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.bone,
    textAlign: "center",
    lineHeight: 18,
    flex: 1,
  },
  returnButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
