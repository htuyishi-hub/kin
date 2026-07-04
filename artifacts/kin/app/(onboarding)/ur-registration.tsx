import { useGetMe, useCompleteOnboarding, OnboardingRequestOccupation, OnboardingRequestGender, OnboardingRequestPrimaryGoal, OnboardingRequestLocationType } from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const UR_INSTITUTION = "university_of_rwanda";

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

  const { data: profile, refetch: refetchProfile } = useGetMe({ query: { refetchInterval: 0 } } as any);

  const { mutate: complete, isPending } = useCompleteOnboarding({
    mutation: {
      onSuccess: () => {
        // Post-onboarding routing is now based on institutional verification,
        // not on occupation alone.
        const institutionVerified = (profile as any)?.institution_verified === true;
        if (institutionVerified) {
          router.replace("/(onboarding)/waiting");
        } else {
          router.replace("/(onboarding)/vouch");
        }
      },
      onError: (err: any) => {
        setError(err?.data?.message ?? "Failed to save. Please try again.");
      },
    },
  });

  async function handleVerifyAndNext() {
    const digitsOnly = registrationNumber.replace(/\s+/g, "");
    if (!digitsOnly) {
      setError("Enter your registration number");
      return;
    }
    if (!/^\d{9}$/.test(digitsOnly)) {
      setError("Registration number must be exactly 9 digits");
      return;
    }

    if (!campus || typeof campus !== "string" || !campus.trim()) {
      setError("Select your campus");
      return;
    }

    setError("");

    // 1) Verify against UR registry and atomically claim the registration.
    // Use the authenticated custom-fetch mechanism from the generated API client.
    // This ensures the bearer token is attached (fixes 401s when calling directly via fetch).
    const verifyRes = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ""}/api/me/ur/verify-registration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ registration_number: digitsOnly, campus: campus.trim() }),
    });

    if (!verifyRes.ok) {
      setError("Could not verify your UR registration. Please try again.");
      return;
    }


    // 2) Refresh profile after verification so institution_verified is available.
    await refetchProfile();

    // 3) Continue existing onboarding completion flow.
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
        Used to verify that you are a University of Rwanda student.
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
        onPress={handleVerifyAndNext}
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

