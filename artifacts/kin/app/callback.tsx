import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";

export default function Callback() {
  const router = useRouter();
  const [status, setStatus] = useState("Processing login…");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      console.log("[auth] callback: started");

      // expo-auth-session uses this to mark the browser redirect as completed.
      if (Platform.OS === "web") {
        try {
          WebBrowser.maybeCompleteAuthSession();
        } catch (e) {
          console.warn("[auth] callback: maybeCompleteAuthSession failed", e);
        }
      }

      // On web, we can read ?code=.../?error=... directly.
      let code: string | null = null;
      let error: string | null = null;

      if (Platform.OS === "web") {
        try {
          const params = new URLSearchParams(window.location.search);
          code = params.get("code");
          error = params.get("error");

          console.log("[auth] callback: query params", { codePresent: !!code, error });
        } catch (e) {
          console.warn("[auth] callback: unable to parse query params", e);
        }
      }

      // If Auth0 returned an error, don’t wait for token storage.
      if (error) {
        if (cancelled) return;
        setStatus(`Auth error: ${error}`);
        router.replace({
          pathname: "/(onboarding)/welcome",
          params: { error },
        });
        return;
      }


      // If there’s no code (unexpected), send to welcome.
      if (Platform.OS === "web" && !code) {
        if (cancelled) return;
        setStatus("No auth code found. Returning to welcome…");
        router.replace({ pathname: "/(onboarding)/welcome" });
        return;
      }


      // Wait until backend exchange stores token in AsyncStorage/localStorage.
      // (We rely on your existing AuthContext/storage approach.)
      const start = Date.now();
      const maxMs = 10_000;

      const tokenKeys = ["auth_token", "token"];
      const authFlagKeys = ["isAuthenticated"]; // if you store it

      while (!cancelled && Date.now() - start < maxMs) {
        if (Platform.OS === "web") {
          try {
            const storageGet = (k: string) => window.localStorage.getItem(k);
            const token = tokenKeys.map(storageGet).find(Boolean);
            const isAuthenticated =
              authFlagKeys.map(storageGet).find((v) => v === "true") === "true";

            if (token) {
              console.log("[auth] callback: token found in localStorage");
              if (cancelled) return;
              setStatus("Login complete. Redirecting…");
              router.replace({ pathname: "/(tabs)" });
              return;
            }

            if (isAuthenticated) {
              console.log("[auth] callback: isAuthenticated flag true");
              if (cancelled) return;
              setStatus("Login complete. Redirecting…");
              router.replace({ pathname: "/(tabs)" });
              return;
            }


          } catch (e) {
            console.warn("[auth] callback: localStorage check failed", e);
          }
        }

        await new Promise((r) => setTimeout(r, 250));
      }

      if (cancelled) return;
      setStatus("Login timeout. Returning to welcome…");
      router.replace({
        pathname: "/(onboarding)/welcome",
        params: { error: "timeout" },
      });

    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Processing login…</Text>
      <Text style={styles.subtitle}>{status}</Text>
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
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
});



