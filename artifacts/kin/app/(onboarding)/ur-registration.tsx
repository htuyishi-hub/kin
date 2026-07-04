import { useCompleteOnboarding, OnboardingRequestOccupation, OnboardingRequestGender, OnboardingRequestPrimaryGoal, OnboardingRequestLocationType } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function UrRegistrationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { dateOfBirth, gender, fullName, occupation, intent, campus } = useLocalSearchParams<{
    dateOfBirth?: string;
    gender?: string;
    fullName?: string;
    occupation?: OnboardingRequestOccupation;
    intent?: OnboardingRequestPrimaryGoal;
    campus?: string;
  }>();

  const [registrationNumber, setRegistrationNumber] = useState("");
  const [error, setError] = useState("");

  const { mutate: complete, isPending } = useCompleteOnboarding({
    mutation: {
      onSuccess: () => {
        router.push("/(onboarding)/vouch");
      },
      onError: (err: any) => {
        // Phase 1: backend contract is stubbed; if it fails, keep message generic.
        setError(err?.data?.message ?? "Failed to save. Please try again.");
      },
    },
  });

  function handleNext() {
    // Phase 1 UI-only validation: ensure 9 digits.
    const digitsOnly = registrationNumber.replace(/\s+/g, "");
    if (!digitsOnly) {
      setError("Enter your registration number");
      return;
    }
    if (!/^\d{9}$/.test(digitsOnly)) {
      setError("Registration number must be exactly 9 digits");
      return;
    }

    setError("");

    // Phase 1 split: we still complete onboarding using existing /me/onboarding.
    // The backend stub for UR verification will be introduced in Phase 2.
    const locationType: OnboardingRequestLocationType = "Campus";

    complete({
      data: {
        occupation: occupation ?? "Student",
        locationType,
        primaryGoal: (intent ?? "Serious Marriage") as OnboardingRequestPrimaryGoal,
        campusName: campus ?? "University of Rwanda",
        fullName: fullName ?? "",
        gender: (gender ?? "Male") as OnboardingRequestGender,
        dateOfBirth: dateOfBirth ?? "2000-01-01",
      },
    });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: isWeb ? 67 : insets.top + 24,
          paddingBottom: isWeb ? 34 : insets.bottom + 24,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.step, { color: colors.mutedForeground }]}>Step 2 of 4</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Registration Number</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Used only to verify that you are a University of Rwanda student.
      </Text>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>REGISTRATION NUMBER</Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="e.g. 225028190"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          value={registrationNumber}
          onChangeText={(t) => {
            setRegistrationNumber(t);
            setError("");
          }}
          maxLength={9}
        />
      </View>

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary, opacity: isPending ? 0.7 : 1 }]}
        onPress={handleNext}
        disabled={isPending}
        activeOpacity={0.85}
      >
        {isPending ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>Komeza</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24 },
  step: { fontFamily: "Inter_500Medium", fontSize: 13 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  section: { gap: 12 },
  sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1 },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  error: { fontFamily: "Inter_400Regular", fontSize: 13 },
  button: { paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 17 },
});

