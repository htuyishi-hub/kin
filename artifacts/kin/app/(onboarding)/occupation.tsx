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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@workspace/i18n";

import { useColors } from "@/hooks/useColors";

export default function OccupationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { t } = useTranslation();

  const occupations: { value: OnboardingRequestOccupation; label: string }[] = [
    { value: "Student", label: t("onboarding.occupation.occStudent") },
    { value: "Employed", label: t("onboarding.occupation.occEmployed") },
    { value: "Business", label: t("onboarding.occupation.occBusiness") },
    { value: "Searching", label: t("onboarding.occupation.occOther") },
  ];

  const intents: { value: OnboardingRequestPrimaryGoal; label: string }[] = [
    { value: "Serious Marriage", label: t("onboarding.occupation.seriousMarriage") },
    { value: "Long-term Relationship", label: t("onboarding.occupation.longTerm") },
    { value: "Casual Dating", label: t("onboarding.occupation.casualDating") },
  ];

  const { dateOfBirth, gender, fullName } = useLocalSearchParams<{ dateOfBirth: string; gender: string; fullName: string }>();

  const [occupation, setOccupation] = useState<OnboardingRequestOccupation | "">("");
  const [intent, setIntent] = useState<OnboardingRequestPrimaryGoal | "">("");
  const [campusName, setCampusName] = useState("");
  const [city, setCity] = useState("Kigali");
  const [error, setError] = useState("");

  const { mutate: complete, isPending } = useCompleteOnboarding({
    mutation: {
      onSuccess: () => {
        router.push("/(onboarding)/invite");
      },
      onError: (err: any) => {
        setError(err?.data?.message ?? t("common.networkError"));
      },
    },
  });

  function handleNext() {
    if (!occupation) { setError(t("onboarding.occupation.selectOccupation")); return; }
    if (!intent) { setError(t("onboarding.occupation.selectIntent")); return; }
    if (occupation === "Student" && !campusName.trim()) { setError(t("onboarding.occupation.chooseCampus")); return; }

    // Phase 1: UR branch navigation (no verification logic yet)
    if (occupation === "Student" && (campusName === "University of Rwanda" || campusName === t("onboarding.occupation.urUniversity"))) {
      setError("");
      router.push({
        pathname: "/(onboarding)/ur-campus",
        params: {
          dateOfBirth,
          gender,
          fullName,
          occupation,
          intent,
        },
      });
      return;
    }

    setError("");

    const locationType: OnboardingRequestLocationType =
      occupation === "Student" ? "Campus" : "City";

    complete({
      data: {
        occupation,
        locationType,
        primaryGoal: intent,
        campusName: occupation === "Student" ? campusName.trim() : undefined,
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
      <Text style={[styles.step, { color: colors.mutedForeground }]}>{t("onboarding.occupation.step")}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("onboarding.occupation.title")}</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("onboarding.occupation.careerLabel").toUpperCase()}</Text>
        <View style={styles.optionGrid}>
          {occupations.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[
                styles.optionChip,
                {
                  borderColor: occupation === o.value ? colors.primary : colors.border,
                  backgroundColor: occupation === o.value ? colors.primary : colors.card,
                },
              ]}
              onPress={() => { setOccupation(o.value); setError(""); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, { color: occupation === o.value ? colors.primaryForeground : colors.foreground }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {occupation === "Student" && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("onboarding.occupation.whereDoYouStudy")}</Text>

          <View style={styles.optionGrid}>
            <TouchableOpacity
              style={[
                styles.optionChip,
                {
                  borderColor: campusName === "University of Rwanda" ? colors.primary : colors.border,
                  backgroundColor: campusName === "University of Rwanda" ? colors.primary : colors.card,
                },
              ]}
              onPress={() => {
                setCampusName("University of Rwanda");
                setError("");
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color:
                      campusName === "University of Rwanda"
                        ? colors.primaryForeground
                        : colors.foreground,
                  },
                ]}
              >
                {t("onboarding.occupation.urUniversity")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionChip,
                {
                  borderColor: campusName === "Other university" ? colors.primary : colors.border,
                  backgroundColor: campusName === "Other university" ? colors.primary : colors.card,
                },
              ]}
              onPress={() => {
                setCampusName("Other university");
                setError("");
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color:
                      campusName === "Other university" ? colors.primaryForeground : colors.foreground,
                  },
                ]}
              >
                {t("onboarding.occupation.otherUniversity")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {occupation && occupation !== "Student" && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("onboarding.occupation.city")}</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder={t("onboarding.occupation.cityPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            value={city}
            onChangeText={(t) => { setCity(t); setError(""); }}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{t("onboarding.occupation.lookingFor")}</Text>
        <View style={styles.intentList}>
          {intents.map((it) => (
            <TouchableOpacity
              key={it.value}
              style={[
                styles.intentOption,
                {
                  borderColor: intent === it.value ? colors.primary : colors.border,
                  backgroundColor: intent === it.value ? colors.secondary : colors.card,
                },
              ]}
              onPress={() => { setIntent(it.value); setError(""); }}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.intentDot,
                  { backgroundColor: intent === it.value ? colors.primary : colors.border },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.intentValue, { color: colors.foreground }]}>{it.label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t("onboarding.occupation.continue")}</Text>
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
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  intentList: { gap: 10 },
  intentOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  intentDot: { width: 12, height: 12, borderRadius: 6 },
  intentValue: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  intentLabel: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13 },
  button: { paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 17 },
});
