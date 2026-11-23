import { useGetMe } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function IndexScreen() {
  const { token, isLoading: authLoading, signOut } = useAuth();
  const colors = useColors();

  const { data: profile, isLoading: profileLoading, error: profileError } = useGetMe({
    query: { enabled: !!token, retry: false } as any,
  });

  useEffect(() => {
    // If OAuth code/token params are in the URL on web, forward immediately to callback route
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const search = window.location.search;
      const hash = window.location.hash;
      if (search.includes("code=") || search.includes("error=") || hash.includes("access_token=")) {
        router.replace(("/callback" + search + hash) as any);
        return;
      }
    }

    if (authLoading || (token && profileLoading)) return;

    if (!token) {
      router.replace("/(onboarding)/welcome");
      return;
    }

    // If profile request returns 401, the session is expired or invalid
    if (profileError) {
      const status = (profileError as any)?.status ?? (profileError as any)?.response?.status;
      if (status === 401) {
        signOut();
        router.replace("/(onboarding)/welcome");
        return;
      }
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
