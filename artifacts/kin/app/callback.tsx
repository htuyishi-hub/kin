import React, { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { fetchProfileRouting } from "@/services/authService";
import { useColors } from "@/hooks/useColors";

export default function Callback() {
  const colors = useColors();

  useEffect(() => {
    let active = true;

    if (Platform.OS === "web") {
      try {
        WebBrowser.maybeCompleteAuthSession();
      } catch {
        // ignore
      }
    }

    async function handleSession() {
      try {
        if (Platform.OS === "web" && typeof window !== "undefined" && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          if (code) {
            const { data } = await supabase.auth.exchangeCodeForSession(code);
            if (data?.session?.user && active) {
              const routing = await fetchProfileRouting(data.session.user.id);
              if (routing.onboardingComplete) {
                router.replace("/(tabs)");
              } else {
                router.replace("/(onboarding)/personal");
              }
              return;
            }
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && active) {
          const routing = await fetchProfileRouting(session.user.id);
          if (routing.onboardingComplete) {
            router.replace("/(tabs)");
          } else {
            router.replace("/(onboarding)/personal");
          }
          return;
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession?.user && active) {
            subscription.unsubscribe();
            const routing = await fetchProfileRouting(newSession.user.id);
            if (routing.onboardingComplete) {
              router.replace("/(tabs)");
            } else {
              router.replace("/(onboarding)/personal");
            }
          }
        });

        setTimeout(() => {
          if (active) {
            subscription.unsubscribe();
            router.replace("/(onboarding)/sign-in");
          }
        }, 4000);
      } catch {
        if (active) {
          router.replace("/(onboarding)/sign-in");
        }
      }
    }

    handleSession();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
});
