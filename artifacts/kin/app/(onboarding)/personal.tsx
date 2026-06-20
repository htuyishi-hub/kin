import { useUpdateMe, UpdateProfileRequestGender } from "@workspace/api-client-react";
import { router } from "expo-router";
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

const GENDERS = [
  { value: "Male", label: "Gabo (Male)" },
  { value: "Female", label: "Gore (Female)" },
];

export default function PersonalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");

  const { mutate: updateMe, isPending } = useUpdateMe({
    mutation: {
      onSuccess: () => {
        router.push({ pathname: "/(onboarding)/occupation", params: { dateOfBirth, gender, fullName: fullName.trim() } });
      },
      onError: (err: any) => {
        setError(err?.data?.message ?? "Failed to save. Please try again.");
      },
    },
  });

  function handleNext() {
    if (!fullName.trim()) { setError("Enter your full name"); return; }
    if (!dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) { setError("Enter date as YYYY-MM-DD"); return; }
    if (!gender) { setError("Select your gender"); return; }
    setError("");
    updateMe({ data: { fullName: fullName.trim(), dateOfBirth, gender: gender as UpdateProfileRequestGender } });
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
      <Text style={[styles.step, { color: colors.mutedForeground }]}>Step 1 of 4</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Tell us about yourself</Text>

      <View style={styles.fields}>
        <Field label="Full name" colors={colors}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="e.g. Amina Uwase"
            placeholderTextColor={colors.mutedForeground}
            value={fullName}
            onChangeText={(t) => { setFullName(t); setError(""); }}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </Field>

        <Field label="Date of birth (YYYY-MM-DD)" colors={colors}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="1999-06-15"
            placeholderTextColor={colors.mutedForeground}
            value={dateOfBirth}
            onChangeText={(t) => { setDateOfBirth(t); setError(""); }}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            maxLength={10}
          />
        </Field>

        <Field label="Gender" colors={colors}>
          <View style={styles.genderRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[
                  styles.genderOption,
                  {
                    borderColor: gender === g.value ? colors.primary : colors.border,
                    backgroundColor: gender === g.value ? colors.primary : colors.card,
                  },
                ]}
                onPress={() => { setGender(g.value); setError(""); }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.genderText,
                    { color: gender === g.value ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>
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

function Field({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24 },
  step: { fontFamily: "Inter_500Medium", fontSize: 13 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  fields: { gap: 20 },
  fieldBlock: { gap: 8 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13 },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  genderRow: { flexDirection: "row", gap: 10 },
  genderOption: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
  },
  genderText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  error: { fontFamily: "Inter_400Regular", fontSize: 13 },
  button: { paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 17 },
});
