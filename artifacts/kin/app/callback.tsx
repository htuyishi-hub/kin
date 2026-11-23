import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { fetchProfileRouting } from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getCurrentLanguage, useTranslation } from "@workspace/i18n";

export default function Callback() {
  const colors = useColors();
  const { setSession, signIn } = useAuth();
  const { t } = useTranslation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

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
        setErrorMsg(null);
        // 1. Check for PKCE authorization code in URL query params on web
        if (Platform.OS === "web" && typeof window !== "undefined" && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");
          if (code) {
            try {
              const { data } = await supabase.auth.exchangeCodeForSession(code);
              if (data?.session?.user && active) {
                if (timer) clearTimeout(timer);
                active = false;
                await setSession(data.session);
                await signIn(data.session.access_token, data.session.user.id);
                try {
                  await supabase.from("profiles").upsert(
                    { id: data.session.user.id, language: getCurrentLanguage() },
                    { onConflict: "id" }
                  );
                } catch {}
                const routing = await fetchProfileRouting(data.session.user.id);
                router.replace(routing.nextRoute as any);
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
                active = false;
                await setSession(data.session);
                await signIn(data.session.access_token, data.session.user.id);
                try {
                  await supabase.from("profiles").upsert(
                    { id: data.session.user.id, language: getCurrentLanguage() },
                    { onConflict: "id" }
                  );
                } catch {}
                const routing = await fetchProfileRouting(data.session.user.id);
                router.replace(routing.nextRoute as any);
                return;
              }
            } catch (err: any) {
              console.warn("[Callback] setSession from hash error:", err);
            }
          }
        }

        // 2. Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && active) {
          if (timer) clearTimeout(timer);
          active = false;
          await setSession(session);
          await signIn(session.access_token, session.user.id);
          try {
            await supabase.from("profiles").upsert(
              { id: session.user.id, language: getCurrentLanguage() },
              { onConflict: "id" }
            );
          } catch {}
          const routing = await fetchProfileRouting(session.user.id);
          router.replace(routing.nextRoute as any);
          return;
        }

        // 3. Listen for onAuthStateChange
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession?.user && active) {
            subscription.unsubscribe();
            if (timer) clearTimeout(timer);
            active = false;
            await setSession(newSession);
            await signIn(newSession.access_token, newSession.user.id);
            try {
              await supabase.from("profiles").upsert(
                { id: newSession.user.id, language: getCurrentLanguage() },
                { onConflict: "id" }
              );
            } catch {}
            const routing = await fetchProfileRouting(newSession.user.id);
            router.replace(routing.nextRoute as any);
          }
        });

        // 4. Timeout fallback only if still unauthenticated after 6s
        timer = setTimeout(async () => {
          if (active) {
            subscription.unsubscribe();
            const { data: checkData } = await supabase.auth.getSession();
            if (checkData?.session?.user) {
              active = false;
              const routing = await fetchProfileRouting(checkData.session.user.id);
              router.replace(routing.nextRoute as any);
              return;
            }
            // If still no session after timeout, offer retry or back instead of blind redirect
            active = false;
            setErrorMsg(t("common.networkError"));
          }
        }, 6000);
      } catch (err: any) {
        if (active) {
          active = false;
          console.error("[Callback error]:", err);
          setErrorMsg(t("common.networkError"));
        }
      }
    }

    handleSession();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [setSession, signIn, retryCount, t]);

  if (errorMsg) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => setRetryCount((c) => c + 1)}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            {t("common.continue")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/(onboarding)/welcome")}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: colors.mutedForeground }]}>
            {t("common.back")}
          </Text>
        </Pressable>
      </View>
    );
  }

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
    padding: 24,
    gap: 16,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlign: "center",
    marginBottom: 8,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 160,
  },
  buttonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
