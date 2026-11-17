import { Platform } from "react-native";

export async function ensureSkiaReady(): Promise<void> {
  if (Platform.OS === "web") {
    const { ensureSkiaReady: ensureWeb } = await import("./loadSkia.web");
    return ensureWeb();
  }
  // On native Android and iOS, Skia JSI is synchronously initialized.
}
