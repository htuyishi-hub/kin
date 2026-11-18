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
import { isValidEmail, sendOtpForSignIn } from "@/services/authService";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isNotFound, setIsNotFound] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit() {
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
    setIsNotFound(false);
    setIsPending(true);

    try {
      const res = await sendOtpForSignIn(cleaned);
      if (!res.success) {
        setError(res.error || "Ntibyashobotse kohereza kode yo kwinjira.");
        setIsNotFound(Boolean(res.isNotFound));
        return;
      }

      router.push({
        pathname: "/(onboarding)/otp",
        params: {
          email: cleaned,
          mode: "signin",
          type: "email",
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
            accessibilityRole="button"
          >
            <Text style={styles.backButtonText}>← Inyuma · Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Injira muri Konti</Text>
          <Text style={styles.titleEn}>Sign In to Kin</Text>
          <Text style={styles.subtitle}>
            Injiza imeri yawe yakoreshejwe ufungura konti kugira ngo tukoherereze kode yo kwinjira.
          </Text>
        </View>

        {/* Action: Email OTP Sign In */}
        <View style={styles.actionSection}>
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
                  setIsNotFound(false);
                }}
                onSubmitEditing={handleSubmit}
                returnKeyType="send"
                autoFocus
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                {isNotFound && (
                  <TouchableOpacity
                    style={styles.createAccountCta}
                    onPress={() => router.push("/(onboarding)/email")}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.createAccountCtaText}>
                      Fungura konti hano · Create an account
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, isPending && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={isPending}
              activeOpacity={0.88}
              accessibilityLabel="Send login code"
              accessibilityRole="button"
            >
              {isPending ? (
                <ActivityIndicator color={Colors.bone} />
              ) : (
                <Text style={styles.primaryButtonText}>Ohereza kode yo kwinjira · Send Code</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Forgot Account Link */}
          <Pressable
            onPress={() => router.push("/(onboarding)/forgot-account")}
            style={styles.forgotLink}
            accessibilityRole="button"
          >
            <Text style={styles.forgotText}>Wibagiwe konti? · Forgot account?</Text>
          </Pressable>
        </View>

        {/* Footer: Create Account Link */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push("/(onboarding)/welcome")}
            style={styles.switchLink}
            accessibilityRole="button"
          >
            <Text style={styles.switchLabel}>Nta konti ufite?</Text>
            <Text style={styles.switchAction}> Fungura konti · Create account</Text>
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
  actionSection: {
    marginVertical: 28,
    gap: 18,
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
  errorBox: {
    backgroundColor: "rgba(229, 83, 75, 0.12)",
    borderWidth: 1,
    borderColor: Colors.coral,
    borderRadius: Radius.sm,
    padding: 12,
    gap: 8,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.coral,
    lineHeight: 19,
  },
  createAccountCta: {
    backgroundColor: Colors.coral,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
  },
  createAccountCtaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.bone,
  },
  primaryButton: {
    backgroundColor: Colors.trust,
    height: 54,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.bone,
  },
  forgotLink: {
    alignSelf: "center",
    padding: 8,
  },
  forgotText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.coral,
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
