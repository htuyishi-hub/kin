import { Feather } from "@expo/vector-icons";
import { useConfirmVouch, useDeclineVouch, useGetIncomingVouches } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export default function VouchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const { data: incoming = [], refetch, isLoading } = useGetIncomingVouches();

  const { mutate: confirm, isPending: isConfirming } = useConfirmVouch({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refetch();
      },
    },
  });

  const { mutate: decline, isPending: isDeclining } = useDeclineVouch({
    mutation: {
      onSuccess: () => {
        refetch();
      },
    },
  });

  const paddingTop = isWeb ? 67 : insets.top + 16;
  const paddingBottom = isWeb ? 34 : insets.bottom + 24;
  const pending = incoming.filter((v) => v.status === "pending");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Vouch requests</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom, gap: 12 }}
          scrollEnabled={!!pending.length}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-circle" size={48} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No pending vouches</Text>
              <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                When someone asks you to vouch for them, it will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[styles.vouchCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                <Feather name="user" size={24} color={colors.mutedForeground} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.foreground }]}>
                  {item.vouchedName ?? "Someone"}
                </Text>
                <Text style={[styles.subtext, { color: colors.mutedForeground }]}>
                  is asking you to vouch for them
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.declineBtn, { borderColor: colors.border }]}
                  onPress={() => decline({ vouchId: item.id })}
                  disabled={isDeclining}
                  activeOpacity={0.8}
                >
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                  onPress={() => confirm({ vouchId: item.id })}
                  disabled={isConfirming}
                  activeOpacity={0.85}
                >
                  {isConfirming ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="check" size={18} color={colors.primaryForeground} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { padding: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24 },
  vouchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1, gap: 2 },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  subtext: { fontFamily: "Inter_400Regular", fontSize: 13 },
  actions: { flexDirection: "row", gap: 8 },
  declineBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: { paddingTop: 60, alignItems: "center", gap: 16, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center" },
  emptyBody: { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", lineHeight: 22 },
});
