import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { getSupabaseClient } from '../lib/supabase';

export type PhotoUploadResult =
  | { success: true;  publicUrl: string; storagePath: string }
  | { success: false; error: string; code: 'permission_denied' | 'cancelled' | 'compression_failed' | 'upload_failed' | 'db_failed' | 'not_configured' };

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
): Promise<{ publicUrl: string; storagePath: string }> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Storage upload failed: Supabase not configured');

  const timestamp   = Date.now();
  const slot        = isPrimary ? 'primary' : `photo_${slotIndex}`;
  const storagePath = `${userId}/${slot}_${timestamp}.jpg`;

  const fileBase64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: 'base64',
  });

  const binary = Uint8Array.from(
    atob(fileBase64).split('').map(c => c.charCodeAt(0))
  );

  const { error } = await client.storage
    .from('profile-photos')
    .upload(storagePath, binary, {
      contentType:  'image/jpeg',
      cacheControl: '3600',
      upsert:       false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = client.storage
    .from('profile-photos')
    .getPublicUrl(storagePath);

  return { publicUrl: urlData.publicUrl, storagePath };
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

    const { publicUrl, storagePath } =
      await uploadToStorage(userId, compressedUri, isPrimary, slotIndex);

    return { success: true, publicUrl, storagePath };

  } catch (err: any) {
    if (err.message?.includes('Storage upload')) {
      return { success: false, error: err.message, code: 'upload_failed' };
    }
    return { success: false, error: err.message, code: 'compression_failed' };
  }
}
