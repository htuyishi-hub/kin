import { useGetMe } from "@workspace/api-client-react";
import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function IndexScreen() {
  const { token, isLoading: authLoading } = useAuth();
  const colors = useColors();

  const { data: profile, isLoading: profileLoading } = useGetMe({
    query: { enabled: !!token, retry: false } as any,
  });

  if (authLoading || (token && profileLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  if (!profile?.onboardingComplete) {
    return <Redirect href="/(onboarding)/personal" />;
  }

  const earlyAccess = (profile as any).earlyAccess === true;
  const isVerified = Boolean(
    (profile as any)?.is_verified ||
    (profile as any)?.institution_verified ||
    (profile as any)?.invited_by_profile ||
    ((profile as any)?.vouchCount ?? 0) >= 1
  );

  if (!earlyAccess && !isVerified) {
    return <Redirect href="/(onboarding)/invite" />;
  }

  return <Redirect href="/(tabs)" />;
}
