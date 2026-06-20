import { Feather } from "@expo/vector-icons";
import { useGetMe, useGetOutgoingVouches } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function WaitingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { data: profile, refetch: refetchProfile } = useGetMe({ query: { refetchInterval: 10000 } as any });
  const { data: outgoing = [] } = useGetOutgoingVouches({ query: { refetchInterval: 10000 } as any });

  const earlyAccess = (profile as any)?.earlyAccess === true;
  const confirmedCount = profile?.vouchCount ?? 0;
  const pendingCount = outgoing.filter((v) => v.status === "pending").length;

  useEffect(() => {
    if (earlyAccess || confirmedCount >= 2) {
      router.replace("/(tabs)");
    }
  }, [earlyAccess, confirmedCount]);

  if (earlyAccess) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: isWeb ? 67 : insets.top + 32,
            paddingBottom: isWeb ? 34 : insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.inner}>
          <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
            <Feather name="unlock" size={40} color={colors.primary} />
          </View>
          <View style={styles.textBlock}>
            <Text style={[styles.title, { color: colors.foreground }]}>Early access — you're in</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Kin is just starting out. The vouch requirement activates once we reach 1,000 members. For now, your profile is open.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.85}
          >
            <Text style={[styles.buttonTextPrimary, { color: colors.primaryForeground }]}>Enter Kin</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: isWeb ? 67 : insets.top + 32,
          paddingBottom: isWeb ? 34 : insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.inner}>
        <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
          <Feather name="clock" size={40} color={colors.primary} />
        </View>

        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.foreground }]}>Waiting for your vouches</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            You need 2 confirmed vouches to access the match pool. Your vouchers will receive a notification.
          </Text>
        </View>

        <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${(confirmedCount / 2) * 100}%` as any },
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
          {confirmedCount} of 2 vouches confirmed
        </Text>

        {outgoing.length > 0 && (
          <View style={styles.vouchList}>
            {outgoing.map((v) => (
              <View key={v.id} style={[styles.vouchRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Feather
                  name={v.status === "confirmed" ? "check-circle" : "clock"}
                  size={18}
                  color={v.status === "confirmed" ? colors.accent : colors.mutedForeground}
                />
                <Text style={[styles.vouchName, { color: colors.foreground }]}>
                  {v.voucherName ?? "Contact"}
                </Text>
                <Text style={[styles.vouchStatus, { color: v.status === "confirmed" ? colors.accent : colors.mutedForeground }]}>
                  {v.status === "confirmed" ? "Confirmed" : "Pending"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.outlineButton, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={() => router.push("/(onboarding)/vouch")}
          activeOpacity={0.8}
        >
          <Feather name="user-plus" size={18} color={colors.primary} />
          <Text style={[styles.buttonText, { color: colors.primary }]}>Add more vouchers</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => refetchProfile()}>
          <Text style={[styles.refresh, { color: colors.mutedForeground }]}>Tap to refresh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, alignItems: "center", gap: 24, justifyContent: "center" },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  textBlock: { gap: 10, alignItems: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, textAlign: "center" },
  progressBar: { width: "80%", height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  progressLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  vouchList: { width: "100%", gap: 8 },
  vouchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  vouchName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15 },
  vouchStatus: { fontFamily: "Inter_400Regular", fontSize: 13 },
  button: { width: "100%", paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  buttonTextPrimary: { fontFamily: "Inter_700Bold", fontSize: 17 },
  outlineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  buttonText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  refresh: { fontFamily: "Inter_400Regular", fontSize: 13, textDecorationLine: "underline" },
});
