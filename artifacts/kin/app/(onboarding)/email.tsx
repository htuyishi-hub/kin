import { router, useLocalSearchParams } from "expo-router";
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
import { isValidEmail, sendEmailOtp } from "@/services/authService";

export default function EmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { role } = useLocalSearchParams<{ role?: "student" | "personal" }>();
  const isStudent = role === "student";

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit() {
    const cleaned = email.trim().toLowerCase();

    if (!cleaned) {
      setError("Injiza imeri yawe ya Google");
      return;
    }

    if (!isValidEmail(cleaned)) {
      setError("Injiza imeri ifite ireme (urugero: izina@gmail.com)");
      return;
    }

    setError("");
    setIsPending(true);

    try {
      const res = await sendEmailOtp(cleaned);
      if (!res.success) {
        setError(res.error || "Ntibyashobotse kohereza kode. Ongera ugerageze.");
        return;
      }

      router.push({
        pathname: "/(onboarding)/otp",
        params: {
          email: cleaned,
          role: role ?? "student",
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
          <Text style={[styles.title, { color: colors.foreground }]}>
            {isStudent ? "Student Sign In" : "Personal Account"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {isStudent
              ? "Koresha imeri yawe isanzwe ya Google. Uzahabwa ikirango cya UR (UR Badge) mu kwinjiza registration number."
              : "Koresha imeri yawe isanzwe ya Google. Kwinjira bisaba ubutumire bw'umunyamuryango (Invite only)."}
          </Text>
        </View>

        <View style={styles.inputBlock}>
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="izina@gmail.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError("");
              }}
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

        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          {isStudent
            ? "Abanyeshuri ba UR bitandukanya n'abandi bakoresheje registration number yabo."
            : "Abadafite ubutumire babaza cyangwa bakinjira mu cyumba cyo gutegereza (Waiting Room)."}
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
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 18,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  error: { fontFamily: "Inter_400Regular", fontSize: 13 },
  button: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 17 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", opacity: 0.6, lineHeight: 18 },
});
