import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import { setBaseUrl } from "@workspace/api-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.VITE_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "https://kin-x81d.onrender.com");

setBaseUrl(apiBaseUrl);

SplashScreen.preventAutoHideAsync().catch(() => {});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.status ?? error?.response?.status;
        // Don’t spam the API (and don’t crash UI) on auth failures.
        if (status === 401) return false;
        return failureCount < 1;
      },
      staleTime: 30_000,
      retryOnMount: true,
    },
  },
});



async function registerPushToken(token: string | null) {
  if (!token) return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const projectId = process.env.EXPO_PUBLIC_REPL_ID ?? "";
    const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });

    await fetch(`${apiBaseUrl}/api/me/push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token: pushToken.data }),
    });

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  } catch {
    // non-fatal — app works fine without push
  }
}

function PushRegistrar() {
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && token) {
      registerPushToken(token);
    }
  }, [token, isLoading]);

  return null;
}


function RootLayoutNav() {
  return (
    <>
      <StatusBar style="light" />
      <PushRegistrar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="match/[matchId]" options={{ headerShown: false }} />
        <Stack.Screen name="vouch/[userId]" options={{ headerShown: false }} />
        <Stack.Screen name="moderation/review" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="callback" />
      </Stack>
    </>
  );
}

function WaitForAuthToken({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();

  // Global circuit breaker: keep API queries from firing until auth restore settles.
  if (isLoading) return <>{children}</>;

  // If token is still missing, still render the shell (so onboarding/login can work),
  // but protected queries should be disabled in their respective hooks.
  return <>{children}</>;
}



export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  const [splashTimedOut, setSplashTimedOut] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSplashTimedOut(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || splashTimedOut) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, splashTimedOut]);

  if (!fontsLoaded && !fontError && !splashTimedOut) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <WaitForAuthToken>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </WaitForAuthToken>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
