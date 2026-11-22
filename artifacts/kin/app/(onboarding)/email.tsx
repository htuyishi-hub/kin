import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
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
import Svg, { Path } from "react-native-svg";

import { Colors } from "@/constants/colors";
import { Radius, Space } from "@/constants/spacing";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchProfileRouting,
  isValidEmail,
  signInWithGoogle,
  signUpWithPassword,
} from "@/services/authService";
import { useTranslation } from "@workspace/i18n";

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </Svg>
  );
}

export default function EmailScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { t } = useTranslation();
  const { setSession, signIn } = useAuth();

  const { role } = useLocalSearchParams<{ role?: "student" | "personal" }>();
  const isStudent = role === "student";

  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isPendingGoogle, setIsPendingGoogle] = useState(false);

  async function handleSubmit() {
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedPassword = password;

    if (!cleanedEmail) {
      setError(t("auth.email.enterEmail"));
      return;
    }

    if (!isValidEmail(cleanedEmail)) {
      setError(t("auth.email.invalidFormat"));
      return;
    }

    if (!cleanedPassword) {
      setError(t("auth.email.enterPassword"));
      return;
    }

    if (cleanedPassword.length < 6) {
      setError(t("auth.email.passwordTooShort"));
      return;
    }

    setError("");
    setIsPending(true);

    try {
      const res = await signUpWithPassword(cleanedEmail, cleanedPassword, role);
      if (!res.success || !res.user) {
        setError(res.error || t("auth.email.signUpFailed"));
        return;
      }

      if (res.session) {
        await setSession(res.session);
        await signIn(res.session.access_token, res.user.id);
      }

      const routing = await fetchProfileRouting(res.user.id);
      if (routing.onboardingComplete) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(onboarding)/personal");
      }
    } catch (err: any) {
      setError(err?.message || t("auth.email.signUpFailed"));
    } finally {
      setIsPending(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setIsPendingGoogle(true);
    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        if (res.error !== "Canceled") {
          setError(res.error || t("errors.generic"));
        }
        return;
      }

      if (res.user && res.session) {
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
      setError(err?.message || t("errors.generic"));
    } finally {
      setIsPendingGoogle(false);
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
            accessibilityRole="button"
          >
            <Text style={styles.backButtonText}>← {t("common.back")}</Text>
          </TouchableOpacity>

          <View style={styles.badgeRow}>
            {isStudent ? (
              <View style={styles.urBadge}>
                <Text style={styles.urBadgeText}>{t("discover.urStudentBadge")}</Text>
              </View>
            ) : (
              <View style={styles.inviteBadge}>
                <Text style={styles.inviteBadgeText}>{t("welcome.inviteBadge")}</Text>
              </View>
            )}
          </View>

          <Text style={styles.title}>
            {isStudent ? t("auth.email.studentTitle") : t("auth.email.personalTitle")}
          </Text>
        </View>

        {/* Action: Email & Password Sign Up */}
        <View style={styles.actionSection}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{t("auth.email.inputLabel")}</Text>
            <View style={[styles.inputWrapper, !!error && styles.inputWrapperError]}>
              <TextInput
                style={styles.textInput}
                placeholder={t("auth.email.placeholder")}
                placeholderTextColor={Colors.boneGhost}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError("");
                }}
                onSubmitEditing={() => passwordRef.current?.focus()}
                returnKeyType="next"
                autoFocus
              />
            </View>

            <Text style={styles.inputLabel}>{t("auth.email.passwordLabel")}</Text>
            <View style={[styles.inputWrapper, !!error && styles.inputWrapperError]}>
              <TextInput
                ref={passwordRef}
                style={styles.textInput}
                placeholder={t("auth.email.passwordPlaceholder")}
                placeholderTextColor={Colors.boneGhost}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError("");
                }}
                onSubmitEditing={handleSubmit}
                returnKeyType="done"
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, isPending && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={isPending || isPendingGoogle}
              activeOpacity={0.88}
              accessibilityLabel={t("auth.email.createAccount")}
              accessibilityRole="button"
            >
              {isPending ? (
                <ActivityIndicator color={Colors.bone} />
              ) : (
                <Text style={styles.primaryButtonText}>{t("auth.email.createAccount")}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t("auth.email.orDivider")}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={[styles.googleButton, isPendingGoogle && { opacity: 0.7 }]}
              onPress={handleGoogleSignIn}
              disabled={isPending || isPendingGoogle}
              activeOpacity={0.88}
              accessibilityLabel={t("auth.email.continueWithGoogle")}
              accessibilityRole="button"
            >
              {isPendingGoogle ? (
                <ActivityIndicator color="#1F2937" />
              ) : (
                <>
                  <GoogleIcon />
                  <Text style={styles.googleButtonText}>{t("auth.email.continueWithGoogle")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer: Sign In Link */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push("/(onboarding)/sign-in")}
            style={styles.switchLink}
            accessibilityRole="button"
          >
            <Text style={styles.switchLabel}>{t("auth.email.alreadyHaveAccount")}</Text>
            <Text style={styles.switchAction}> {t("auth.email.signInAction")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginTop: 6,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  backButtonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.coral,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  urBadge: {
    backgroundColor: Colors.trust,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  urBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: Colors.bone,
    letterSpacing: 0.5,
  },
  inviteBadge: {
    backgroundColor: Colors.inkRaised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  inviteBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 26,
    color: Colors.bone,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  actionSection: {
    marginVertical: 24,
    gap: 20,
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
    paddingVertical: 14,
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
    height: 52,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.bone,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.boneDim,
    textTransform: "lowercase",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    height: 52,
    borderRadius: Radius.full,
  },
  googleButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#1F2937",
  },
  footer: {
    alignItems: "center",
    marginTop: 16,
  },
  switchLink: {
    flexDirection: "row",
    padding: 10,
    alignItems: "center",
  },
  switchLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.boneDim,
  },
  switchAction: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.trust,
  },
});
