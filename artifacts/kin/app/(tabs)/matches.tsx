import { Feather } from "@expo/vector-icons";
import { useGetMatches } from "@workspace/api-client-react";
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
import { useTranslation } from "@workspace/i18n";

import { useColors } from "@/hooks/useColors";

export default function MatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { t } = useTranslation();

  const { data: matches = [], isLoading } = useGetMatches({ query: { refetchInterval: 15000 } as any });

  const tabBarHeight = Platform.OS === "web" ? 84 : (Platform.OS === "ios" ? 90 : 70);
  const paddingTop = isWeb ? 67 : insets.top + 16;
  const paddingBottom = tabBarHeight + (isWeb ? 0 : insets.bottom);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop, paddingHorizontal: 24 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("matches.tabTitle")}</Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: paddingBottom + 16, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!matches.length}
        ListEmptyComponent={
          <View style={[styles.empty, { paddingTop: 60 }]}>
            <Feather name="message-circle" size={48} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("matches.noMatches")}</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {t("matches.keepSwiping")}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const phase = item.conversationPhase ?? 1;
          const hoursLeft = Math.max(0, Math.round((new Date(item.expiresAt).getTime() - Date.now()) / 3600000));

          return (
            <TouchableOpacity
              style={[styles.matchItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/match/${item.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
                <Feather name="user" size={24} color={colors.mutedForeground} />
              </View>
              <View style={styles.matchInfo}>
                <View style={styles.matchTop}>
                  <Text style={[styles.matchName, { color: colors.foreground }]}>
                    {item.otherUserName}
                    {item.otherUserAge ? `, ${item.otherUserAge}` : ""}
                  </Text>
                  <Text style={[styles.matchTime, { color: colors.mutedForeground }]}>
                    {hoursLeft}h left
                  </Text>
                </View>
                <View style={styles.matchBottom}>
                  <View style={[styles.phaseBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.phaseText, { color: colors.primary }]}>
                      Phase {phase}
                    </Text>
                  </View>
                  {item.unreadCount > 0 && (
                    <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.unreadText, { color: colors.primaryForeground }]}>
                        {item.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingBottom: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  vouchBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  vouchBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  vouchBadgeText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  vouchBannerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  vouchBannerSub: { fontFamily: "Inter_400Regular", fontSize: 13 },
  matchItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  matchInfo: { flex: 1, gap: 6 },
  matchTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  matchName: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  matchTime: { fontFamily: "Inter_400Regular", fontSize: 12 },
  matchBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  phaseBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  phaseText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  unreadBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  empty: { alignItems: "center", gap: 16, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center" },
  emptyBody: { fontFamily: "Inter_400Regular", fontSize: 15, textAlign: "center", lineHeight: 22 },
});
