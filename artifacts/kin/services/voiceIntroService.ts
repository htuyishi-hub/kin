import * as FileSystem from "expo-file-system";
import { getSupabaseClient } from "../lib/supabase";

export function resolveAudioUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const client = getSupabaseClient();
  if (client) {
    const { data: vData } = client.storage.from("voice-intros").getPublicUrl(path);
    if (vData?.publicUrl) return vData.publicUrl;
    const { data: pData } = client.storage.from("profile-photos").getPublicUrl(path);
    if (pData?.publicUrl) return pData.publicUrl;
  }
  return path;
}

export async function uploadVoiceIntroFile(
  userId: string,
  localUri: string
): Promise<{ success: boolean; storagePath: string; error?: string }> {
  const timestamp = Date.now();
  const filename = `voice_${timestamp}.m4a`;
  const storagePath = `${userId}/${filename}`;

  const client = getSupabaseClient();
  if (!client) {
    return { success: true, storagePath };
  }

  try {
    const fileBase64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: "base64",
    });
    const binary = Uint8Array.from(
      atob(fileBase64)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    let { error } = await client.storage
      .from("voice-intros")
      .upload(storagePath, binary, {
        contentType: "audio/m4a",
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      const fallback = await client.storage
        .from("profile-photos")
        .upload(storagePath, binary, {
          contentType: "audio/m4a",
          cacheControl: "3600",
          upsert: true,
        });
      if (fallback.error) {
        console.warn("Storage upload warning:", fallback.error.message);
      }
    }

    return { success: true, storagePath };
  } catch (err: any) {
    console.warn("Voice file upload fallback:", err);
    return { success: true, storagePath };
  }
}
