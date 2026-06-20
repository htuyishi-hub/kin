import { useSendOtp } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const { mutate: sendOtp, isPending } = useSendOtp({
    mutation: {
      onSuccess: () => {
        router.push({ pathname: "/(onboarding)/otp", params: { phone: `+250${phone}` } });
      },
      onError: (err: any) => {
        setError(err?.data?.message ?? "Failed to send OTP. Please try again.");
      },
    },
  });

  function handleSubmit() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) {
      setError("Enter a valid Rwandan phone number");
      return;
    }
    setError("");
    sendOtp({ data: { phoneNumber: `+250${digits}` } });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.inner,
          {
            paddingTop: isWeb ? 67 : insets.top + 24,
            paddingBottom: isWeb ? 34 : insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Your phone number</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We will send a verification code to confirm your identity.
          </Text>
        </View>

        <View style={styles.inputBlock}>
          <View style={[styles.phoneRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={[styles.prefix, { borderRightColor: colors.border }]}>
              <Text style={[styles.prefixText, { color: colors.mutedForeground }]}>+250</Text>
            </View>
            <TextInput
              style={[styles.phoneInput, { color: colors.foreground }]}
              placeholder="7XX XXX XXX"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(t) => { setPhone(t); setError(""); }}
              maxLength={12}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
              autoFocus
            />
          </View>
          {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: colors.primary, opacity: isPending ? 0.7 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={isPending}
          activeOpacity={0.85}
        >
          {isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
              Ohereza kode
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.devNote, { color: colors.mutedForeground }]}>
          Dev: use OTP 123456 for any number
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    gap: 32,
  },
  header: { gap: 8, marginTop: 8 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  inputBlock: { gap: 8 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    overflow: "hidden",
  },
  prefix: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRightWidth: 1,
  },
  prefixText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontFamily: "Inter_500Medium",
    fontSize: 18,
    letterSpacing: 1,
  },
  error: { fontFamily: "Inter_400Regular", fontSize: 13 },
  button: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 17 },
  devNote: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", opacity: 0.6 },
});
