import { Feather } from "@expo/vector-icons";
import { useGetOutgoingVouches, useRequestVouch } from "@workspace/api-client-react";
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

export default function VouchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const { data: outgoing = [], refetch } = useGetOutgoingVouches();
  const { mutate: requestVouch, isPending } = useRequestVouch({
    mutation: {
      onSuccess: () => {
        setPhone("");
        refetch();
      },
      onError: (err: any) => {
        setError(err?.data?.message ?? "Could not find that number.");
      },
    },
  });

  function handleAdd() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 9) { setError("Enter a valid Rwandan phone number"); return; }
    setError("");
    requestVouch({ data: { voucherPhoneNumber: `+250${digits}` } });
  }

  const confirmedCount = outgoing.filter((v) => v.status === "confirmed").length;

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
      <Text style={[styles.step, { color: colors.mutedForeground }]}>Step 3 of 4</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Get vouched</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Ask at least 2 people who know you to vouch for your character. They must already be on Kin.
      </Text>

      <View style={[styles.explainer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Feather name="info" size={16} color={colors.accent} />
        <Text style={[styles.explainerText, { color: colors.foreground }]}>
          A vouch is not an endorsement of attractiveness. It is a community member saying: "I know this person. They are who they say they are."
        </Text>
      </View>

      <View style={styles.inputBlock}>
        <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>PHONE NUMBER</Text>
        <View style={styles.inputRow}>
          <View style={[styles.prefix, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.prefixText, { color: colors.mutedForeground }]}>+250</Text>
          </View>
          <TextInput
            style={[
              styles.phoneInput,
              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
            ]}
            placeholder="7XX XXX XXX"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(t) => { setPhone(t); setError(""); }}
            maxLength={12}
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary, opacity: isPending ? 0.7 : 1 }]}
            onPress={handleAdd}
            disabled={isPending}
            activeOpacity={0.85}
          >
            {isPending ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <Feather name="send" size={18} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
        {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      </View>

      {outgoing.length > 0 && (
        <View style={styles.requestList}>
          <Text style={[styles.listTitle, { color: colors.mutedForeground }]}>
            VOUCH REQUESTS SENT
          </Text>
          {outgoing.map((v) => (
            <View
              key={v.id}
              style={[styles.vouchItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.vouchInfo}>
                <Text style={[styles.vouchName, { color: colors.foreground }]}>
                  {v.voucherName ?? "Contact"}
                </Text>
                <Text style={[styles.vouchStatus, { color: v.status === "confirmed" ? colors.accent : colors.mutedForeground }]}>
                  {v.status === "confirmed" ? "Confirmed" : "Pending"}
                </Text>
              </View>
              {v.status === "confirmed" && (
                <Feather name="check-circle" size={20} color={colors.accent} />
              )}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: confirmedCount >= 2 ? colors.primary : colors.muted,
            opacity: 1,
          },
        ]}
        onPress={() => router.push("/(onboarding)/prompts")}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, { color: confirmedCount >= 2 ? colors.primaryForeground : colors.mutedForeground }]}>
          {confirmedCount >= 2 ? "Komeza" : `Waiting for vouches (${confirmedCount}/2)`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(onboarding)/prompts")}>
        <Text style={[styles.skipLink, { color: colors.mutedForeground }]}>
          Skip for now — set up prompts first
        </Text>
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
  explainer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  explainerText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  inputBlock: { gap: 8 },
  inputLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  prefix: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  prefixText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  error: { fontFamily: "Inter_400Regular", fontSize: 13 },
  requestList: { gap: 12 },
  listTitle: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1 },
  vouchItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  vouchInfo: { gap: 2 },
  vouchName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  vouchStatus: { fontFamily: "Inter_400Regular", fontSize: 13 },
  button: { paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  buttonText: { fontFamily: "Inter_700Bold", fontSize: 17 },
  skipLink: { fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", textDecorationLine: "underline" },
});
