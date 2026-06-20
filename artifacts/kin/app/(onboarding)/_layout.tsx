import { Stack } from "expo-router";
import React from "react";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="personal" />
      <Stack.Screen name="occupation" />
      <Stack.Screen name="vouch" />
      <Stack.Screen name="prompts" />
      <Stack.Screen name="waiting" />
    </Stack>
  );
}
