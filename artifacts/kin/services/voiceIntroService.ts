import * as FileSystem from "expo-file-system";
import { getSupabaseClient } from "../lib/supabase";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.VITE_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "https://kin-x81d.onrender.com");

interface CachedVoiceUrl {
  url: string;
  expiresAt: number;
}

const voiceSignedUrlCache = new Map<string, CachedVoiceUrl>();

export async function getVoiceSignedUrl(
  userIdOrPath: string,
  forceRefresh = false
): Promise<string | null> {
  if (!userIdOrPath) return null;
  if (userIdOrPath.startsWith("http://") || userIdOrPath.startsWith("https://")) {
    return userIdOrPath;
  }

  const cached = voiceSignedUrlCache.get(userIdOrPath);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const client = getSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return null;

    const target = userIdOrPath.includes("/")
      ? userIdOrPath.split("/")[1] || userIdOrPath
      : userIdOrPath;

    const res = await fetch(`${API_URL}/media/voice/${encodeURIComponent(target)}/url`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      voiceSignedUrlCache.delete(userIdOrPath);
      return null;
    }

    const data = await res.json();
    if (data?.url) {
      voiceSignedUrlCache.set(userIdOrPath, {
        url: data.url,
        expiresAt: Date.now() + Math.max(30, (data.expiresIn || 300) - 30) * 1000,
      });
      return data.url;
    }
  } catch (err) {
    console.warn("[getVoiceSignedUrl] Failed to fetch voice signed URL:", err);
  }
  return null;
}

export function resolveAudioUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cached = voiceSignedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  // Asynchronously populate cache
  getVoiceSignedUrl(path).catch(() => {});
  return null;
}

export async function uploadVoiceIntroFile(
  userId: string,
  localUri: string
): Promise<{ success: boolean; storagePath: string; error?: string; durationMs?: number }> {
  try {
    const client = getSupabaseClient();
    if (!client) return { success: false, storagePath: "", error: "Not configured" };

    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { success: false, storagePath: "", error: "Not authenticated" };

    // 1. Get signed upload URL from server
    const urlRes = await fetch(`${API_URL}/media/voice/upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!urlRes.ok) {
      const err = await urlRes.json().catch(() => ({}));
      return { success: false, storagePath: "", error: err.code || "FEATURE_DISABLED" };
    }

    const { uploadUrl, path } = await urlRes.json();

    // 2. Read local file binary
    const fileBase64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: "base64",
    });
    const binary = Uint8Array.from(
      atob(fileBase64)
        .split("")
        .map((c) => c.charCodeAt(0))
    );

    // 3. Upload to signed upload URL
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "audio/m4a",
      },
      body: binary,
    });

    if (!uploadRes.ok) {
      return { success: false, storagePath: "", error: "UPLOAD_FAILED" };
    }

    // 4. Confirm upload with server (verifies 1-20s duration on server)
    const confirmRes = await fetch(`${API_URL}/media/voice/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ path }),
    });

    if (!confirmRes.ok) {
      const err = await confirmRes.json().catch(() => ({}));
      return {
        success: false,
        storagePath: "",
        error: err.code || "CONFIRM_FAILED",
      };
    }

    const confirmData = await confirmRes.json();
    return {
      success: true,
      storagePath: path,
      durationMs: confirmData.durationMs,
    };
  } catch (err: any) {
    return { success: false, storagePath: "", error: err.message || "UNKNOWN_ERROR" };
  }
}
