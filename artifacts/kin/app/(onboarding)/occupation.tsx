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

import { useColors } from "@/hooks/useColors";

const OCCUPATIONS: { value: OnboardingRequestOccupation; label: string }[] = [
  { value: "Student", label: "Student" },
  { value: "Employed", label: "Employed" },
  { value: "Business", label: "Business" },
  { value: "Searching", label: "Other" },
];

const INTENTS: { value: OnboardingRequestPrimaryGoal; label: string }[] = [
  { value: "Serious Marriage", label: "Gukundana kugeza mu bushyingirwa" },
  { value: "Long-term Relationship", label: "Gukundana guturika" },
  { value: "Casual Dating", label: "Gusabana no guganira" },
];

export default function OccupationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { dateOfBirth, gender, fullName } = useLocalSearchParams<{ dateOfBirth: string; gender: string; fullName: string }>();

  const [occupation, setOccupation] = useState<OnboardingRequestOccupation | "">("");
  const [intent, setIntent] = useState<OnboardingRequestPrimaryGoal | "">("");
  const [campusName, setCampusName] = useState("");
  const [city, setCity] = useState("Kigali");
  const [error, setError] = useState("");

  const { mutate: complete, isPending } = useCompleteOnboarding({
    mutation: {
      onSuccess: () => {
        router.push("/(onboarding)/vouch");
      },
      onError: (err: any) => {
        setError(err?.data?.message ?? "Failed to save. Please try again.");
      },
    },
  });

  function handleNext() {
    if (!occupation) { setError("Select your occupation"); return; }
    if (!intent) { setError("Select your primary intent"); return; }
    if (occupation === "Student" && !campusName.trim()) { setError("Enter your campus name"); return; }
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
      <Text style={[styles.step, { color: colors.mutedForeground }]}>Step 2 of 4</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Your situation</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        This helps us connect you with the right people.
      </Text>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OCCUPATION</Text>
        <View style={styles.optionGrid}>
          {OCCUPATIONS.map((o) => (
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
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CAMPUS</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="e.g. University of Rwanda"
            placeholderTextColor={colors.mutedForeground}
            value={campusName}
            onChangeText={(t) => { setCampusName(t); setError(""); }}
          />
        </View>
      )}

      {occupation && occupation !== "Student" && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CITY</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="e.g. Kigali"
            placeholderTextColor={colors.mutedForeground}
            value={city}
            onChangeText={(t) => { setCity(t); setError(""); }}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>WHAT ARE YOU LOOKING FOR?</Text>
        <View style={styles.intentList}>
          {INTENTS.map((it) => (
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
                <Text style={[styles.intentValue, { color: colors.foreground }]}>{it.value}</Text>
                <Text style={[styles.intentLabel, { color: colors.mutedForeground }]}>{it.label}</Text>
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
