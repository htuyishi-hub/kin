import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useTranslation } from "@workspace/i18n";
import {
  fetchProfileRouting,
  sendOtpForRecovery,
  sendOtpForSignIn,
  sendOtpForSignUp,
  sendPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
} from "@/services/authService";

export default function OtpScreen() {
  const { phone, email, type, mode, role } = useLocalSearchParams<{
    phone?: string;
    email?: string;
    type?: "email" | "sms" | "signup" | "recovery";
    mode?: "signup" | "signin" | "recovery";
    role?: "student" | "personal";
  }>();

  const isEmail = type === "email" || !!email;
  const targetRecipient = isEmail ? email : phone;

  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { signIn, setSession } = useAuth();
  const { t } = useTranslation();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const inputs = useRef<(TextInput | null)[]>([]);

  // 60-second countdown timer for Resend Code
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  async function handleVerify(code: string) {
    if (code.length !== 6) return;

    setError("");
    setInfoMessage("");
    setVerifying(true);

    try {
      if (isEmail && email) {
        // Task 3.1: Wire directly to Supabase verifyOtp
        const otpType = (mode === "recovery" ? "recovery" : mode === "signup" ? "signup" : "email") as
          | "email"
          | "signup"
          | "recovery";

        const res = await verifyEmailOtp(email, code, otpType);

        if (!res.success || !res.session || !res.user) {
          setError(res.error || t("auth.otp.invalidCode"));
          setOtp(["", "", "", "", "", ""]);
          inputs.current[0]?.focus();
          return;
        }

        // Task 3.4: Confirm session active in SecureStore
        await setSession(res.session);
        await signIn(res.session.access_token, res.user.id);

        // Post-verification profile routing check
        const routing = await fetchProfileRouting(res.user.id);
        router.replace(routing.nextRoute as any);
        return;
      }

      if (phone) {
        // Fallback SMS verification path
        const res = await verifyPhoneOtp(phone, code);
        if (res.success && res.session && res.user) {
          await setSession(res.session);
          await signIn(res.session.access_token, res.user.id);

          const routing = await fetchProfileRouting(res.user.id);
          router.replace(routing.nextRoute as any);
          return;
        }

        setError(res.error || t("auth.otp.invalidCode"));
        setOtp(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
      }
    } catch (err: any) {
      setError(err?.message || t("auth.otp.verifyFailed"));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResendCode() {
    if (countdown > 0 || resending) return;

    setError("");
    setInfoMessage("");
    setResending(true);

    try {
      if (isEmail && email) {
        let res;
        if (mode === "recovery") {
          res = await sendOtpForRecovery(email);
        } else if (mode === "signin") {
          res = await sendOtpForSignIn(email);
        } else {
          res = await sendOtpForSignUp(email);
        }

        if (!res.success) {
          setError(res.error || t("auth.otp.resendFailed"));
          return;
        }

        setInfoMessage(t("auth.otp.newCodeSent"));
        setCountdown(60);
        setOtp(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
        return;
      }

      if (phone) {
        const res = await sendPhoneOtp(phone);
        if (!res.success) {
          setError(res.error || t("auth.otp.resendFailed"));
          return;
        }
        setInfoMessage(t("auth.otp.newCodeSent"));
        setCountdown(60);
        setOtp(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
      }
    } catch (err: any) {
      setError(err?.message || t("auth.otp.resendFailed"));
    } finally {
      setResending(false);
    }
  }

  function handleChange(text: string, index: number) {
    // Handle multi-digit paste
    if (text.length > 1) {
      const digits = text.replace(/\D/g, "").slice(0, 6).split("");
      if (digits.length > 0) {
        const newOtp = [...otp];
        digits.forEach((d, i) => {
          if (i < 6) newOtp[i] = d;
        });
        setOtp(newOtp);
        setError("");

        const nextIndex = Math.min(digits.length, 5);
        inputs.current[nextIndex]?.focus();

        if (digits.length === 6) {
          handleVerify(digits.join(""));
        }
        return;
      }
    }

    const digit = text.slice(-1).replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError("");

    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (index === 5 && digit) {
      const fullCode = [...newOtp.slice(0, 5), digit].join("");
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  }

  function handleKeyPress(e: any, index: number) {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputs.current[index - 1]?.focus();
    }
  }

  const code = otp.join("");
  const isPending = verifying;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.container,
          {
            paddingTop: isWeb ? 50 : insets.top + 24,
            paddingBottom: isWeb ? 34 : insets.bottom + 24,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
          >
            <Text style={styles.backButtonText}>← {isEmail ? t("auth.otp.changeEmail") : t("auth.otp.changePhone")}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t("auth.otp.title")}</Text>
          <Text style={styles.subtitle}>
            {t("auth.otp.codeSentTo")}{"\n"}
            <Text style={styles.recipientHighlight}>{targetRecipient}</Text>
          </Text>
        </View>

        {/* 6 Digit Input Cells */}
        <View style={styles.otpSection}>
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(r) => {
                  inputs.current[i] = r;
                }}
                style={[
                  styles.otpCell,
                  digit ? styles.otpCellFilled : styles.otpCellEmpty,
                  error ? styles.otpCellError : null,
                ]}
                value={digit}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={i === 0 ? 6 : 1}
                selectTextOnFocus
                autoFocus={i === 0}
              />
            ))}
          </View>

          {/* Feedback messages */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}
        </View>

        {/* Verify Action Button */}
        <View style={styles.actionBlock}>
          <TouchableOpacity
            style={[
              styles.verifyButton,
              (isPending || code.length < 6) && styles.verifyButtonDisabled,
            ]}
            onPress={() => handleVerify(code)}
            disabled={isPending || code.length < 6}
            activeOpacity={0.85}
            accessibilityLabel={t("auth.otp.verify")}
            accessibilityRole="button"
          >
            {isPending ? (
              <ActivityIndicator color={Colors.bone} />
            ) : (
              <Text style={styles.verifyButtonText}>{t("auth.otp.verify")}</Text>
            )}
          </TouchableOpacity>

          {/* Task 3.2: 60-Second Countdown & Resend Code Button */}
          <View style={styles.resendContainer}>
            {countdown > 0 ? (
              <Text style={styles.countdownText}>
                {t("auth.otp.resendCountdown")}{" "}
                <Text style={styles.countdownNumber}>{countdown}s</Text>
              </Text>
            ) : (
              <TouchableOpacity
                onPress={handleResendCode}
                disabled={resending}
                style={styles.resendButton}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                {resending ? (
                  <ActivityIndicator size="small" color={Colors.trust} />
                ) : (
                  <Text style={styles.resendButtonText}>
                    {t("auth.otp.resendCode")}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.night,
  },
  container: {
    flex: 1,
    paddingHorizontal: Space.px6,
    justifyContent: "space-between",
  },
  header: {
    gap: 8,
  },
  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  backButtonText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.coral,
  },
  title: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 26,
    color: Colors.bone,
    letterSpacing: -0.5,
    lineHeight: 32,
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
    lineHeight: 20,
    marginTop: 4,
  },
  recipientHighlight: {
    fontFamily: "Inter_700Bold",
    color: Colors.bone,
  },
  otpSection: {
    gap: 16,
    alignItems: "center",
  },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    width: "100%",
  },
  otpCell: {
    width: 46,
    height: 58,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    textAlign: "center",
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: Colors.bone,
  },
  otpCellEmpty: {
    borderColor: Colors.divider,
    backgroundColor: Colors.ink,
  },
  otpCellFilled: {
    borderColor: Colors.trust,
    backgroundColor: Colors.inkRaised,
  },
  otpCellError: {
    borderColor: Colors.coral,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.coral,
    textAlign: "center",
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  infoText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.success,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  actionBlock: {
    gap: 16,
    marginBottom: 16,
  },
  verifyButton: {
    backgroundColor: Colors.trust,
    height: 54,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.bone,
  },
  resendContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  countdownText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.boneDim,
  },
  countdownNumber: {
    fontFamily: "Inter_700Bold",
    color: Colors.coral,
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.trust,
  },
});
