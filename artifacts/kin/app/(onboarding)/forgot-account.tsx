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
import { isValidEmail, sendOtpForRecovery } from "@/services/authService";

export default function ForgotAccountScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleRecoverySubmit() {
    const cleaned = email.trim().toLowerCase();

    if (!cleaned) {
      setError("Enter your email");
      return;
    }

    if (!isValidEmail(cleaned)) {
      setError("Invalid email format");
      return;
    }

    setError("");
    setIsPending(true);

    try {
      const res = await sendOtpForRecovery(cleaned);
      if (!res.success) {
        setError(res.error || "Failed to send recovery code. Please try again.");
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
      setError(err?.message || "An error occurred. Please try again.");
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
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Recover Your Account</Text>
        </View>

        {/* Section: Email OTP Recovery */}
        <View style={styles.section}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email Address</Text>
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
                autoFocus
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, isPending && { opacity: 0.7 }]}
              onPress={handleRecoverySubmit}
              disabled={isPending}
              activeOpacity={0.88}
              accessibilityLabel="Send recovery code"
              accessibilityRole="button"
            >
              {isPending ? (
                <ActivityIndicator color={Colors.bone} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Send Recovery Code
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
            <Text style={styles.backLinkLabel}>Remember your account?</Text>
            <Text style={styles.backLinkAction}> Sign in</Text>
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
  section: {
    marginVertical: 28,
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
    marginTop: 8,
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
