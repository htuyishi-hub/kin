import React, { useState, useEffect } from 'react';
import {
  View, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Linking, Text,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { handlePhotoUpload, getPhotoSignedUrl } from '../services/photoUploadService';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

type Props = {
  currentPhotoUrl: string | null;
  initials?:       string;
  onUploadSuccess: (publicUrl: string, storagePath: string) => void;
  size?:           number;
};

function AvatarImage({
  photoRef,
  size,
}: {
  photoRef: string;
  size: number;
}) {
  const [url, setUrl] = useState<string | null>(() => {
    if (photoRef.startsWith('http://') || photoRef.startsWith('https://')) return photoRef;
    return null;
  });

  const loadUrl = async (forceRefresh = false) => {
    if (!photoRef) return;
    if (photoRef.startsWith('http://') || photoRef.startsWith('https://')) {
      setUrl(photoRef);
      return;
    }
    const signed = await getPhotoSignedUrl(photoRef, forceRefresh);
    if (signed) setUrl(signed);
  };

  useEffect(() => {
    loadUrl();
  }, [photoRef]);

  if (!url) return null;

  return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      transition={300}
      cachePolicy="memory-disk"
      onError={() => loadUrl(true)}
    />
  );
}

export function AvatarUpload({
  currentPhotoUrl,
  initials,
  onUploadSuccess,
  size = 120,
}: Props) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleTap = async () => {
    if (!token) return;
    const userId = parseUserIdFromToken(token);
    if (!userId) return;

    setUploading(true);
    const result = await handlePhotoUpload(userId, true, 0);
    setUploading(false);

    if (!result.success) {
      if (result.code === 'permission_denied') {
        Alert.alert(
          'Camera Roll Access Needed',
          'Kin needs access to your photos to set your profile picture. Please allow access in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else if (result.code === 'not_configured') {
        Alert.alert('Not Available', 'Photo upload requires Supabase configuration.');
      } else if (result.code !== 'cancelled') {
        Alert.alert('Upload Failed', 'Your photo could not be uploaded. Please try again.');
      }
      return;
    }

    onUploadSuccess(result.signedUrl, result.storagePath);
  };

  return (
    <TouchableOpacity
      onPress={handleTap}
      disabled={uploading}
      activeOpacity={0.8}
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, borderColor: Colors.trust },
      ]}
    >
      {currentPhotoUrl ? (
        <AvatarImage photoRef={currentPhotoUrl} size={size} />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
          {initials ? (
            <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
          ) : (
            <Feather name="user" size={size * 0.4} color={Colors.boneDim} />
          )}
        </View>
      )}

      {uploading ? (
        <View style={[styles.overlay, { width: size, height: size, borderRadius: size / 2 }]}>
          <ActivityIndicator color={Colors.bone} size="small" />
        </View>
      ) : (
        <View style={styles.cameraBadge}>
          <Feather name="camera" size={11} color={Colors.bone} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function parseUserIdFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!));
    return payload.sub ?? payload.userId ?? null;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderWidth: 2,
  },
  placeholder: {
    backgroundColor: Colors.inkRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontFamily: 'Fraunces_700Bold',
    color: Colors.bone,
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: Colors.trust,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
