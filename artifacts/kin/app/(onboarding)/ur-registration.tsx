import {
  useGetMe,
  useCompleteOnboarding,
  OnboardingRequestOccupation,
  OnboardingRequestGender,
  OnboardingRequestPrimaryGoal,
  OnboardingRequestLocationType,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@workspace/i18n";

import { useColors } from "@/hooks/useColors";

const UR_INSTITUTION = "university_of_rwanda";

export default function UrRegistrationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { t } = useTranslation();

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
  const { token } = useAuth();

  const urVerifiedRef = React.useRef(false);

  const { mutate: complete, isPending } = useCompleteOnboarding({
    mutation: {
      onSuccess: () => {
        // Deterministic routing: use the sync ref set immediately after verification.
        if (urVerifiedRef.current) router.replace("/(tabs)");
        else router.replace("/(onboarding)/invite");
      },
      onError: (err: any) => {
        if (err?.data?.code === "UR_REGISTRATION_INVALID") {
          setError(t("errors.urRegistrationInvalid"));
        } else {
          setError(t("errors.generic"));
        }
      },
    },
  });

  async function handleVerifyAndNext() {
    const digitsOnly = registrationNumber.replace(/\s+/g, "");

    if (!digitsOnly) {
      setError(t("onboarding.ur.enterRegNumber"));
      return;
    }
    if (!/^\d{9}$/.test(digitsOnly)) {
      setError(t("onboarding.ur.mustBe9Digits"));
      return;
    }

    if (!campus || typeof campus !== "string" || !campus.trim()) {
      setError(t("onboarding.ur.selectCampusError"));
      return;
    }

    setError("");

    // 1) Verify against UR registry and atomically claim the registration.
    const authHeader = token ? `Bearer ${token}` : undefined;

    const apiBaseUrl =
      process.env.EXPO_PUBLIC_API_URL ??
      process.env.VITE_API_URL ??
      (process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "https://kin-x81d.onrender.com");

    if (!apiBaseUrl || typeof apiBaseUrl !== "string" || !apiBaseUrl.trim()) {
      setError(t("errors.generic"));
      return;
    }

    try {
      const verifyRes = await fetch(`${apiBaseUrl}/api/me/ur/verify-registration`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({ registration_number: digitsOnly, campus: campus.trim() }),
      });

      const verifyJson = (await verifyRes.json()) as any;

      if (!verifyRes.ok) {
        if (verifyJson?.code === "UR_REGISTRATION_INVALID") {
          setError(t("errors.urRegistrationInvalid"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }

      const verifiedFromApi =
        verifyJson?.verified === true ||
        verifyJson?.status === "verified";

      if (verifiedFromApi) {
        urVerifiedRef.current = true;

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
        return;
      }

      urVerifiedRef.current = false;

      if (verifyJson?.code === "UR_REGISTRATION_INVALID") {
        setError(t("errors.urRegistrationInvalid"));
        return;
      }

      const status = verifyJson?.status as
        | "already_claimed"
        | "invalid_format"
        | "not_found"
        | string
        | undefined;

      if (status === "already_claimed") {
        setError(t("onboarding.ur.alreadyClaimed"));
        return;
      }

      setError(t("errors.generic"));
      return;
    } catch {
      setError(t("errors.generic"));
      return;
    }
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
      <Text style={[styles.step, { color: colors.mutedForeground }]}>{t("onboarding.ur.step")}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("onboarding.ur.registrationTitle")}</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("onboarding.ur.registrationLabel").toUpperCase()}</Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder={t("onboarding.ur.registrationPlaceholder")}
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
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t("common.continue")}</Text>
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

