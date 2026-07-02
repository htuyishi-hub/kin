import React, { useEffect } from "react";
import { Redirect } from "expo-router";

export default function Callback() {
  // On web, AuthSession returns to `${origin}/callback`.
  // We immediately move back into the app without looping through onboarding.
  useEffect(() => {
    // Helps avoid any transient state during redirect.
    // (no-op)
  }, []);

  return <Redirect href="/" />;
}

