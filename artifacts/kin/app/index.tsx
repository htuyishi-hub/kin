import { useGetMe } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function IndexScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const colors = useColors();

  const { data: profile, isLoading: profileLoading } = useGetMe({
    query: { enabled: !!token, retry: false } as any,
  });

  useEffect(() => {
    if (authLoading || (token && profileLoading)) return;

    if (!token) {
      router.replace("/(onboarding)/welcome");
      return;
    }

    if (!profile?.onboardingComplete) {
      router.replace("/(onboarding)/personal");
      return;
    }

    const earlyAccess = (profile as any).earlyAccess === true;
    const isVerified = Boolean(
      (profile as any)?.is_verified ||
      (profile as any)?.institution_verified ||
      (profile as any)?.invited_by_profile ||
      ((profile as any)?.vouchCount ?? 0) >= 1
    );

    if (!earlyAccess && !isVerified) {
      router.replace("/(onboarding)/invite");
      return;
    }

    router.replace("/(tabs)");
  }, [authLoading, token, profileLoading, profile]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}
