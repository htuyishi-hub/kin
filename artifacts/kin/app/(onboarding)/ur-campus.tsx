import {
  useCompleteOnboarding,
  OnboardingRequestOccupation,
  OnboardingRequestLocationType,
  OnboardingRequestPrimaryGoal,
  OnboardingRequestGender,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@workspace/i18n";

import { useColors } from "@/hooks/useColors";

const UR_CAMPUSES = [
  "Huye",
  "Nyarugenge",
  "Remera",
  "Gikondo",
  "Busogo",
  "Rukara",
  "Nyagatare",
  "Rusizi",
] as const;

type Campus = (typeof UR_CAMPUSES)[number];

export default function UrCampusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { t } = useTranslation();

  const {
    dateOfBirth,
    gender,
    fullName,
    occupation,
    intent,
  } = useLocalSearchParams<{
    dateOfBirth?: string;
    gender?: string;
    fullName?: string;
    occupation?: OnboardingRequestOccupation;
    intent?: OnboardingRequestPrimaryGoal;
  }>();

  const [selectedCampus, setSelectedCampus] = useState<Campus | "">("");
  const [error, setError] = useState("");

  // Phase 1: navigation correctness only; do not call completion here.
  // We keep step state, then continue to registration number.

  function handleNext() {
    if (!selectedCampus) {
      setError(t("onboarding.ur.selectCampusError"));
      return;
    }
    setError("");
    router.push({
      pathname: "/(onboarding)/ur-registration",
      params: {
        dateOfBirth: dateOfBirth ?? "2000-01-01",
        gender: gender ?? "Male",
        fullName: fullName ?? "",
        occupation: occupation ?? "Student",
        intent: intent ?? "Serious Marriage",
        campus: selectedCampus,
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
      <Text style={[styles.step, { color: colors.mutedForeground }]}>{t("onboarding.ur.step")}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("onboarding.ur.campusTitle")}</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("onboarding.ur.campusLabel").toUpperCase()}</Text>
        <View style={styles.optionGrid}>
          {UR_CAMPUSES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.optionChip,
                {
                  borderColor: selectedCampus === c ? colors.primary : colors.border,
                  backgroundColor: selectedCampus === c ? colors.primary : colors.card,
                },
              ]}
              onPress={() => {
                setSelectedCampus(c);
                setError("");
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: selectedCampus === c ? colors.primaryForeground : colors.foreground,
                  },
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={handleNext}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t("common.continue")}</Text>
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
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13 },
  button: { paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 17 },
});

