import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";

export default function Callback() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // expo-auth-session uses this to mark the browser redirect as completed.
      if (Platform.OS === "web") {
        try {
          WebBrowser.maybeCompleteAuthSession();
        } catch {
          // non-fatal; hook will still receive response where possible
        }
      }

      // Give useAuth0Login() a moment to process the response + exchange code.
      // After that, navigate to the app root.
      setTimeout(() => {
        if (!cancelled) {
          router.replace("/");
        }
      }, 800);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Processing login…</Text>
      <Text style={styles.subtitle}>Completing authentication with Google.</Text>
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


