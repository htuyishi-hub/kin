import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/colors";
import { Radius, Space } from "@/constants/spacing";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchProfileRouting,
  isValidEmail,
  sendOtpForRecovery,
  signInWithGoogle,
} from "@/services/authService";

export default function ForgotAccountScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { setSession, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setError("");
    setIsGoogleLoading(true);

    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        if (res.error && !res.error.includes("Canceled")) {
          setError(res.error);
        }
        return;
      }

      if (res.session && res.user) {
        await setSession(res.session);
        await signIn(res.session.access_token, res.user.id);

        const routing = await fetchProfileRouting(res.user.id);
        if (routing.onboardingComplete) {
          router.replace("/(tabs)");
        } else {
          router.replace("/(onboarding)/personal");
        }
      }
    } catch (err: any) {
      setError(err?.message || "Habaye ikibazo cyo kwinjira na Google.");
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleRecoverySubmit() {
    const cleaned = email.trim().toLowerCase();

    if (!cleaned) {
      setError("Injiza imeri yawe · Enter your email");
      return;
    }

    if (!isValidEmail(cleaned)) {
      setError("Injiza imeri ifite ireme (urugero: izina@gmail.com) · Invalid email format");
      return;
    }

    setError("");
    setIsPending(true);

    try {
      const res = await sendOtpForRecovery(cleaned);
      if (!res.success) {
        setError(res.error || "Ntibyashobotse kohereza kode yo kugarura konti.");
        return;
      }

      router.push({
        pathname: "/(onboarding)/otp",
        params: {
          email: cleaned,
          mode: "recovery",
          type: "recovery",
        },
      });
    } catch (err: any) {
      setError(err?.message || "Habaye ikibazo. Ongera ugerageze.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: isWeb ? 40 : insets.top + 20,
            paddingBottom: isWeb ? 40 : insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.backButtonText}>← Inyuma · Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Kugarura Konti</Text>
          <Text style={styles.titleEn}>Recover Your Account</Text>
          <Text style={styles.subtitle}>
            Hitamo uburyo bwo kugarura konti yawe ukoresheje Google cyangwa kode yo kuri imeri.
          </Text>
        </View>

        {/* Section 1: Google One-Tap Recovery */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Waba warakoresheje Google?</Text>
              <Text style={styles.cardSubtitle}>Registered with Google?</Text>
            </View>
            <Text style={styles.cardDescription}>
              Niba warinjiriye kuri Google, kanda hano winjire ako kanya nta kode bisabye.
            </Text>

            <TouchableOpacity
              style={[styles.googleButton, isGoogleLoading && { opacity: 0.7 }]}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading || isPending}
              activeOpacity={0.88}
              accessibilityLabel="Continue with Google"
              accessibilityRole="button"
            >
              {isGoogleLoading ? (
                <ActivityIndicator color={Colors.night} />
              ) : (
                <>
                  <GoogleIcon />
                  <Text style={styles.googleButtonText}>Injira na Google · Google Recovery</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>cyangwa kode kuri imeri · or email recovery</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Section 2: Email OTP Recovery */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Imeri yawe · Email Address</Text>
            <View style={[styles.inputWrapper, !!error && styles.inputWrapperError]}>
              <TextInput
                style={styles.textInput}
                placeholder="izina@gmail.com"
                placeholderTextColor={Colors.boneGhost}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setError("");
                }}
                onSubmitEditing={handleRecoverySubmit}
                returnKeyType="send"
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, isPending && { opacity: 0.7 }]}
              onPress={handleRecoverySubmit}
              disabled={isPending || isGoogleLoading}
              activeOpacity={0.88}
              accessibilityLabel="Send recovery code"
              accessibilityRole="button"
            >
              {isPending ? (
                <ActivityIndicator color={Colors.bone} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Ohereza kode yo kugarura · Send Recovery Code
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push("/(onboarding)/sign-in")}
            style={styles.backLink}
            accessibilityRole="button"
          >
            <Text style={styles.backLinkLabel}>Wibutse amakuru yawe?</Text>
            <Text style={styles.backLinkAction}> Injira · Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleIcon() {
  return (
    <View style={styles.googleIconContainer}>
      <Text style={styles.googleLetter}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.night,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Space.px6,
    justifyContent: "space-between",
  },
  header: {
    gap: 8,
    marginTop: 8,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  backButtonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.coral,
  },
  title: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 28,
    color: Colors.bone,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  titleEn: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.boneDim,
    marginTop: -4,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.boneDim,
    lineHeight: 21,
    marginTop: 4,
  },
  section: {
    marginVertical: 24,
    gap: 20,
  },
  card: {
    backgroundColor: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderRadius: Radius.lg,
    padding: 18,
    gap: 12,
  },
  cardHeader: {
    gap: 2,
  },
  cardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.bone,
  },
  cardSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.boneDim,
  },
  cardDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.boneDim,
    lineHeight: 19,
  },
  googleButton: {
    width: "100%",
    height: 52,
    backgroundColor: Colors.bone,
    borderRadius: Radius.full,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 4,
  },
  googleIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EA4335",
    alignItems: "center",
    justifyContent: "center",
  },
  googleLetter: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  googleButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.night,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.boneDim,
  },
  inputContainer: {
    gap: 10,
  },
  inputLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.boneDim,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.ink,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  inputWrapperError: {
    borderColor: Colors.coral,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.bone,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.coral,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: Colors.trust,
    height: 54,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  primaryButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.bone,
  },
  footer: {
    alignItems: "center",
    marginTop: 16,
  },
  backLink: {
    flexDirection: "row",
    padding: 10,
    alignItems: "center",
  },
  backLinkLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.boneDim,
  },
  backLinkAction: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.trust,
  },
});
