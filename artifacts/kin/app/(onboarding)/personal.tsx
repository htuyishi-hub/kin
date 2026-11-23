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
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@workspace/i18n";

import { useColors } from "@/hooks/useColors";
import { DatePickerModal, getMonthDisplay } from "@/components/DatePickerModal";

export default function PersonalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { t } = useTranslation();

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [activePicker, setActivePicker] = useState<"day" | "month" | "year" | null>(null);
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");

  const genders = [
    { value: "Male", label: t("onboarding.personal.genderMale") },
    { value: "Female", label: t("onboarding.personal.genderFemale") },
  ];

  const { mutate: updateMe, isPending } = useUpdateMe({
    mutation: {
      onSuccess: () => {
        router.push({ pathname: "/(onboarding)/occupation", params: { dateOfBirth, gender, fullName: fullName.trim() } });
      },
      onError: (err: any) => {
        setError(err?.data?.message ?? t("onboarding.personal.saveFailed"));
      },
    },
  });

  function handleSelectDate(d: string, m: string, y: string) {
    setDay(d);
    setMonth(m);
    setYear(y);
    if (d && m && y) {
      setDateOfBirth(`${y}-${m}-${d}`);
      setError("");
    }
  }

  function handleNext() {
    if (!fullName.trim()) { setError(t("onboarding.personal.enterFullName")); return; }
    if (!dateOfBirth || !dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setError(t("onboarding.personal.selectDob"));
      return;
    }

    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      setError(t("onboarding.personal.mustBe18"));
      return;
    }

    if (!gender) { setError(t("onboarding.personal.selectGender")); return; }
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
      <Text style={[styles.step, { color: colors.mutedForeground }]}>{t("onboarding.personal.step")}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("onboarding.personal.title")}</Text>

      <View style={styles.fields}>
        <Field label={t("onboarding.personal.fullNameLabel")} colors={colors}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder={t("onboarding.personal.fullNamePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            value={fullName}
            onChangeText={(t) => { setFullName(t); setError(""); }}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </Field>

        <Field label={t("onboarding.personal.dobLabel")} colors={colors}>
          <View style={styles.dobRow}>
            {/* Day */}
            <TouchableOpacity
              style={[
                styles.dobPill,
                {
                  borderColor: activePicker === "day" ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              onPress={() => setActivePicker("day")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dobPillText,
                  { color: day ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {day ? day : t("onboarding.personal.dayLabel")}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Month */}
            <TouchableOpacity
              style={[
                styles.dobPill,
                {
                  flex: 1.4,
                  borderColor: activePicker === "month" ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              onPress={() => setActivePicker("month")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dobPillText,
                  { color: month ? colors.foreground : colors.mutedForeground },
                ]}
                numberOfLines={1}
              >
                {month ? getMonthDisplay(month) : t("onboarding.personal.monthLabel")}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Year */}
            <TouchableOpacity
              style={[
                styles.dobPill,
                {
                  flex: 1.1,
                  borderColor: activePicker === "year" ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              onPress={() => setActivePicker("year")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dobPillText,
                  { color: year ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {year ? year : t("onboarding.personal.yearLabel")}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </Field>

        <Field label={t("onboarding.personal.genderLabel")} colors={colors}>

          <View style={styles.genderRow}>
            {genders.map((g) => (
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
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t("onboarding.personal.continue")}</Text>
        )}
      </TouchableOpacity>

      <DatePickerModal
        visible={activePicker !== null}
        activeTab={activePicker ?? "day"}
        onTabChange={(tab) => setActivePicker(tab)}
        onClose={() => setActivePicker(null)}
        selectedDay={day}
        selectedMonth={month}
        selectedYear={year}
        onSelectDate={handleSelectDate}
      />
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
  dobRow: {
    flexDirection: "row",
    gap: 10,
  },
  dobPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  dobPillText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
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

