import { Feather } from "@expo/vector-icons";
import { useGetMe } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function WaitingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { token } = useAuth();

  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: profile, refetch: refetchProfile } = useGetMe({
    query: { refetchInterval: 8000 } as any,
  });

  const p = profile as any;
  const earlyAccess = p?.earlyAccess === true;
  const isVerified = Boolean(
    p?.is_verified ||
    p?.institution_verified ||
    p?.invited_by_profile ||
    (p?.vouchCount ?? 0) >= 1
  );

  const accountStatus = p?.account_status ?? p?.accountStatus ?? (isVerified || earlyAccess ? "active" : "waitlisted");
  const isWaitlisted = accountStatus === "waitlisted";
  const myInviteCode = p?.invite_code ?? p?.inviteCode ?? "KIN-MEMBER";
  const myInviteLink = p?.invite_link ?? `https://kin.rw/invite/${myInviteCode}`;
  const myVouchLink = p?.id ? `https://kin.rw/vouch/${p.id}` : "";
  const [vouchCopied, setVouchCopied] = useState(false);

  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.VITE_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "https://kin-x81d.onrender.com");

  useEffect(() => {
    if (earlyAccess || isVerified) {
      router.replace("/(tabs)");
    }
  }, [earlyAccess, isVerified]);

  async function handleClaimCode() {
    const code = inviteCodeInput.trim().toUpperCase();
    if (!code) {
      setError("Please enter an invite code");
      return;
    }

    setClaiming(true);
    setError("");

    try {
      const res = await fetch(`${apiBaseUrl}/api/invites/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to claim invite code");
      }

      setClaimSuccess(`Verified by ${data.inviterName || "a community member"}!`);
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
      await refetchProfile();
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 1200);
    } catch (err: any) {
      setError(err?.message || "Invalid invite code. Please check and try again.");
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Error);
    } finally {
      setClaiming(false);
    }
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Join me on Kin — Rwanda's trusted introduction network: ${myInviteLink}`,
        url: myInviteLink,
        title: "Join me on Kin",
      });
    } catch {
      // Fallback
    }
  }

  function handleCopy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleShareVouch() {
    if (!myVouchLink) return;
    try {
      await Share.share({
        message: `I'm on the Kin waitlist! Can you publicly approve my profile so I can join? ${myVouchLink}`,
        url: myVouchLink,
        title: "Approve my request on Kin",
      });
    } catch {
      // Fallback
    }
  }

  function handleCopyVouch() {
    setVouchCopied(true);
    setTimeout(() => setVouchCopied(false), 2500);
  }

  if (earlyAccess) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: isWeb ? 67 : insets.top + 32,
            paddingBottom: isWeb ? 34 : insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.inner}>
          <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
            <Feather name="unlock" size={40} color={colors.primary} />
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: colors.foreground }]}>Early access — you're in</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Kin is just starting out. For now, your profile is ready.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.85}
          >
            <Text style={[styles.buttonTextPrimary, { color: colors.primaryForeground }]}>Enter Kin</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: isWeb ? 67 : insets.top + 32,
          paddingBottom: isWeb ? 34 : insets.bottom + 24,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.inner}>
        <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
          <Feather name="mail" size={40} color={colors.accent} />
        </View>

        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.foreground }]}>Almost there</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Kin is an invite-only introduction network. Claim an invite code or share your link to activate your discovery access.
          </Text>
        </View>

        {/* PEER-TO-PEER PUBLIC APPROVAL LINK */}
        {isWaitlisted && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <Feather name="shield" size={18} color={colors.accent} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Peer-to-Peer Approval</Text>
            </View>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
              Know an active member on Kin? Share your personal approval link. Once they verify your character, your account is approved instantly.
            </Text>

            <View style={[styles.linkBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.linkText, { color: colors.foreground }]} numberOfLines={1}>
                {myVouchLink || "Generating your approval link..."}
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.primary }]}
                onPress={handleShareVouch}
                activeOpacity={0.85}
              >
                <Feather name="send" size={16} color={colors.primaryForeground} />
                <Text style={[styles.shareBtnText, { color: colors.primaryForeground }]}>Share My Approval Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.copyBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
                onPress={handleCopyVouch}
                activeOpacity={0.85}
              >
                <Feather
                  name={vouchCopied ? "check" : "copy"}
                  size={16}
                  color={vouchCopied ? colors.accent : colors.foreground}
                />
                <Text style={[styles.copyBtnText, { color: vouchCopied ? colors.accent : colors.foreground }]}>
                  {vouchCopied ? "Copied" : "Copy"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CLAIM CODE */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Feather name="key" size={18} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Enter an invite code</Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.secondary },
              ]}
              placeholder="e.g. KIN-9X42A7"
              placeholderTextColor={colors.mutedForeground}
              value={inviteCodeInput}
              onChangeText={(t) => {
                setInviteCodeInput(t);
                setError("");
              }}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.claimBtn, { backgroundColor: colors.primary, opacity: claiming ? 0.7 : 1 }]}
              onPress={handleClaimCode}
              disabled={claiming}
              activeOpacity={0.85}
            >
              {claiming ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={[styles.claimBtnText, { color: colors.primaryForeground }]}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>

          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
          {claimSuccess ? (
            <Text style={[styles.successText, { color: colors.accent }]}>{claimSuccess}</Text>
          ) : null}
        </View>

        {/* SHARE LINK */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Feather name="share-2" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Your Invite Link</Text>
          </View>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            Share your link with a friend. When they join, both of you become verified members.
          </Text>

          <View style={[styles.linkBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.linkText, { color: colors.foreground }]} numberOfLines={1}>
              {myInviteLink}
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: colors.primary }]}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Feather name="send" size={16} color={colors.primaryForeground} />
              <Text style={[styles.shareBtnText, { color: colors.primaryForeground }]}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.copyBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              onPress={handleCopy}
              activeOpacity={0.85}
            >
              <Feather name={copied ? "check" : "copy"} size={16} color={copied ? colors.accent : colors.foreground} />
              <Text style={[styles.copyBtnText, { color: copied ? colors.accent : colors.foreground }]}>
                {copied ? "Copied" : "Copy"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* UR STUDENT VERIFICATION PATHWAY */}
        <TouchableOpacity
          style={[styles.urOption, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => router.push("/(onboarding)/ur-campus")}
          activeOpacity={0.85}
        >
          <Feather name="award" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.urOptionTitle, { color: colors.foreground }]}>
              University of Rwanda Student?
            </Text>
            <Text style={[styles.urOptionSub, { color: colors.mutedForeground }]}>
              Verify instantly using your student registration number
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 20 },
  inner: { gap: 20, alignItems: "center", width: "100%" },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  textBlock: { alignItems: "center", gap: 8, paddingHorizontal: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, textAlign: "center" },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21 },
  card: {
    width: "100%",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  cardSub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  inputRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: 1,
  },
  claimBtn: {
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  claimBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13 },
  successText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  linkBox: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  linkText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  shareBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  copyBtn: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  copyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  urOption: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  urOptionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  urOptionSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  button: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonTextPrimary: { fontFamily: "Inter_700Bold", fontSize: 16 },
});
