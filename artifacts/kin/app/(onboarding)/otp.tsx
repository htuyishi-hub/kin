import { useVerifyOtp } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { verifyStudentEmailOtp, verifyPhoneOtp } from "@/services/authService";

export default function OtpScreen() {
  const { phone, email, type } = useLocalSearchParams<{
    phone?: string;
    email?: string;
    type?: string;
  }>();

  const isEmail = type === "email" || !!email;
  const targetRecipient = isEmail ? email : phone;

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { signIn, setSession } = useAuth();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  // Fallback API mutation for dev environments
  const { mutate: verifyOtpFallback } = useVerifyOtp({
    mutation: {
      onSuccess: async (data) => {
        await signIn(data.token, data.userId);
        if (data.isNewUser || !data.onboardingComplete) {
          router.replace("/(onboarding)/personal");
        } else {
          router.replace("/");
        }
      },
      onError: (err: any) => {
        setError(err?.data?.message ?? "Invalid code. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
      },
    },
  });

  async function handleVerify(code: string) {
    if (code.length !== 6) return;

    setError("");
    setVerifying(true);

    try {
      if (isEmail && email) {
        // Path A: Supabase Student Email OTP verification
        const res = await verifyStudentEmailOtp(email, code);
        if (!res.success || !res.session || !res.user) {
          setError(res.error || "Kode ntabwo ari yo cyangwa yarangiye.");
          setOtp(["", "", "", "", "", ""]);
          inputs.current[0]?.focus();
          return;
        }

        await setSession(res.session);
        await signIn(res.session.access_token, res.user.id);
        router.replace("/(onboarding)/personal");
        return;
      }

      if (phone) {
        // Path B: Supabase Phone SMS OTP verification
        const res = await verifyPhoneOtp(phone, code);
        if (res.success && res.session && res.user) {
          await setSession(res.session);
          await signIn(res.session.access_token, res.user.id);
          router.replace("/(onboarding)/personal");
          return;
        }

        // Graceful fallback to local dev OTP handler if Supabase SMS unconfigured
        verifyOtpFallback({ data: { phoneNumber: phone, otp: code } });
        return;
      }
    } catch (err: any) {
      setError(err?.message || "Ikibazo cyabaye mu kwemeza kode.");
    } finally {
      setVerifying(false);
    }
  }

  function handleChange(text: string, index: number) {
    const digit = text.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError("");

    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (index === 5 && digit) {
      const code = [...newOtp.slice(0, 5), digit].join("");
      if (code.length === 6) {
        handleVerify(code);
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: isWeb ? 67 : insets.top + 24,
          paddingBottom: isWeb ? 34 : insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Enter the code</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sent to {targetRecipient}
        </Text>
      </View>

      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(r) => { inputs.current[i] = r; }}
            style={[
              styles.otpCell,
              {
                borderColor: digit ? colors.primary : colors.border,
                backgroundColor: colors.card,
                color: colors.foreground,
              },
            ]}
            value={digit}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            autoFocus={i === 0}
          />
        ))}
      </View>

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: colors.primary, opacity: isPending || code.length < 6 ? 0.5 : 1 },
        ]}
        onPress={() => handleVerify(code)}
        disabled={isPending || code.length < 6}
        activeOpacity={0.85}
      >
        {isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Emeza</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, gap: 32 },
  header: { gap: 6 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15 },
  otpRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  otpCell: {
    width: 48,
    height: 60,
    borderRadius: 12,
    borderWidth: 1.5,
    textAlign: "center",
    fontFamily: "Inter_700Bold",
    fontSize: 24,
  },
  error: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
  button: { paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 17 },
});
