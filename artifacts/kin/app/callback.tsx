import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

export default function Callback() {
  const [status] = useState("Signing you in…");

  useEffect(() => {
    // Keep callback passive: only finalize the auth redirect for Expo/AuthSession.
    if (Platform.OS === "web") {
      try {
        WebBrowser.maybeCompleteAuthSession();
      } catch {
        // ignore
      }
    }
  }, []);

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





