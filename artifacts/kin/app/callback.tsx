import React, { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { fetchProfileRouting } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getCurrentLanguage } from "@workspace/i18n";

export default function Callback() {
  const colors = useColors();
  const { setSession, signIn } = useAuth();

  useEffect(() => {
    let active = true;
    let timer: any = null;

    if (Platform.OS === "web") {
      try {
        WebBrowser.maybeCompleteAuthSession();
      } catch {
        // ignore
      }
    }

    async function handleSession() {
      try {
        // 1. Check for PKCE authorization code in URL query params on web
        if (Platform.OS === "web" && typeof window !== "undefined" && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          if (code) {
            try {
              const { data } = await supabase.auth.exchangeCodeForSession(code);
              if (data?.session?.user && active) {
                if (timer) clearTimeout(timer);
                await setSession(data.session);
                await signIn(data.session.access_token, data.session.user.id);
                try {
                  await supabase.from("profiles").upsert(
                    { id: data.session.user.id, language: getCurrentLanguage() },
                    { onConflict: "id" }
                  );
                } catch {}
                const routing = await fetchProfileRouting(data.session.user.id);
                if (routing.onboardingComplete) {
                  router.replace("/(tabs)");
                } else {
                  router.replace("/(onboarding)/personal");
                }
                return;
              }
            } catch {
              // exchange might have already happened
            }
          }
        }

        // 1b. Check for implicit grant tokens in hash fragment on web
        if (Platform.OS === "web" && typeof window !== "undefined" && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            try {
              const { data } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (data?.session?.user && active) {
                if (timer) clearTimeout(timer);
                await setSession(data.session);
                await signIn(data.session.access_token, data.session.user.id);
                try {
                  await supabase.from("profiles").upsert(
                    { id: data.session.user.id, language: getCurrentLanguage() },
                    { onConflict: "id" }
                  );
                } catch {}
                const routing = await fetchProfileRouting(data.session.user.id);
                if (routing.onboardingComplete) {
                  router.replace("/(tabs)");
                } else {
                  router.replace("/(onboarding)/personal");
                }
                return;
              }
            } catch {}
          }
        }

        // 2. Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && active) {
          if (timer) clearTimeout(timer);
          await setSession(session);
          await signIn(session.access_token, session.user.id);
          try {
            await supabase.from("profiles").upsert(
              { id: session.user.id, language: getCurrentLanguage() },
              { onConflict: "id" }
            );
          } catch {}
          const routing = await fetchProfileRouting(session.user.id);
          if (routing.onboardingComplete) {
            router.replace("/(tabs)");
          } else {
            router.replace("/(onboarding)/personal");
          }
          return;
        }

        // 3. Listen for onAuthStateChange
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession?.user && active) {
            subscription.unsubscribe();
            if (timer) clearTimeout(timer);
            await setSession(newSession);
            await signIn(newSession.access_token, newSession.user.id);
            try {
              await supabase.from("profiles").upsert(
                { id: newSession.user.id, language: getCurrentLanguage() },
                { onConflict: "id" }
              );
            } catch {}
            const routing = await fetchProfileRouting(newSession.user.id);
            if (routing.onboardingComplete) {
              router.replace("/(tabs)");
            } else {
              router.replace("/(onboarding)/personal");
            }
          }
        });

        // 4. Timeout fallback only if still unauthenticated after 5s
        timer = setTimeout(() => {
          if (active) {
            subscription.unsubscribe();
            router.replace("/(onboarding)/welcome");
          }
        }, 5000);
      } catch {
        if (active) {
          router.replace("/(onboarding)/welcome");
        }
      }
    }

    handleSession();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [setSession, signIn]);

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
