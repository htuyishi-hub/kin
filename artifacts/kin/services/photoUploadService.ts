import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { getSupabaseClient } from '../lib/supabase';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.VITE_API_URL ??
  'https://kinn-api.fly.dev';

export type PhotoUploadResult =
  | { success: true; photoId?: string; signedUrl: string; publicUrl: string; storagePath: string }
  | { success: false; error: string; code: 'permission_denied' | 'cancelled' | 'compression_failed' | 'upload_failed' | 'db_failed' | 'not_configured' };

interface CachedUrl {
  url: string;
  expiresAt: number;
}

const photoSignedUrlCache = new Map<string, CachedUrl>();

export async function getPhotoSignedUrl(photoId: string, forceRefresh = false): Promise<string | null> {
  if (!photoId) return null;
  if (photoId.startsWith('http://') || photoId.startsWith('https://')) {
    return photoId;
  }

  const cached = photoSignedUrlCache.get(photoId);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const client = getSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return null;

    const res = await fetch(`${API_URL}/media/photo/${encodeURIComponent(photoId)}/url`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      photoSignedUrlCache.delete(photoId);
      return null;
    }

    const data = await res.json();
    if (data?.url) {
      photoSignedUrlCache.set(photoId, {
        url: data.url,
        expiresAt: Date.now() + Math.max(30, (data.expiresIn || 300) - 30) * 1000,
      });
      return data.url;
    }
  } catch (err) {
    console.warn('[getPhotoSignedUrl] Failed to fetch signed URL:', err);
  }
  return null;
}

export async function requestMediaPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function pickImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0].uri;
}

export async function compressImage(localUri: string): Promise<string> {
  const compressed = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 800, height: 800 } }],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    }
  );
  return compressed.uri;
}

export async function uploadToStorage(
  userId: string,
  compressedUri: string,
  isPrimary: boolean,
  slotIndex: number = 0
): Promise<{ signedUrl: string; publicUrl: string; storagePath: string; photoId?: string }> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  // 1. Request short-lived signed upload URL from server
  const uploadUrlRes = await fetch(`${API_URL}/media/photo/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ slotIndex }),
  });

  if (!uploadUrlRes.ok) {
    const err = await uploadUrlRes.json().catch(() => ({}));
    throw new Error(`Upload request failed: ${err.message || uploadUrlRes.statusText}`);
  }

  const { uploadUrl, path, slotIndex: returnedSlot } = await uploadUrlRes.json();

  // 2. Read compressed file binary
  const fileBase64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: 'base64',
  });

  const binary = Uint8Array.from(
    atob(fileBase64).split('').map(c => c.charCodeAt(0))
  );

  // 3. Upload binary directly to signed upload URL
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/jpeg',
    },
    body: binary,
  });

  if (!uploadRes.ok) {
    throw new Error(`Storage upload failed: ${uploadRes.statusText}`);
  }

  // 4. Confirm upload with server (checks prefix, size <= 500KB, magic bytes)
  const confirmRes = await fetch(`${API_URL}/media/photo/confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path, slotIndex: returnedSlot }),
  });

  if (!confirmRes.ok) {
    const err = await confirmRes.json().catch(() => ({}));
    throw new Error(`Confirmation failed: ${err.message || confirmRes.statusText}`);
  }

  const confirmed = await confirmRes.json();

  // 5. Fetch signed playback URL
  const signedUrl = (await getPhotoSignedUrl(confirmed.id, true)) || '';

  return {
    photoId: confirmed.id,
    signedUrl,
    publicUrl: signedUrl,
    storagePath: path,
  };
}

export async function handlePhotoUpload(
  userId: string,
  isPrimary: boolean = true,
  slotIndex: number  = 0
): Promise<PhotoUploadResult> {
  if (!getSupabaseClient()) {
    return { success: false, error: 'Supabase not configured', code: 'not_configured' };
  }

  try {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
      return { success: false, error: 'Camera roll access denied.', code: 'permission_denied' };
    }

    const localUri = await pickImage();
    if (!localUri) {
      return { success: false, error: 'No image selected.', code: 'cancelled' };
    }

    const compressedUri = await compressImage(localUri);

    const result = await uploadToStorage(userId, compressedUri, isPrimary, slotIndex);

    return {
      success: true,
      photoId: result.photoId,
      signedUrl: result.signedUrl,
      publicUrl: result.publicUrl,
      storagePath: result.storagePath,
    };

  } catch (err: any) {
    if (err.message?.includes('Storage upload') || err.message?.includes('Upload request')) {
      return { success: false, error: err.message, code: 'upload_failed' };
    }
    return { success: false, error: err.message, code: 'compression_failed' };
  }
}
