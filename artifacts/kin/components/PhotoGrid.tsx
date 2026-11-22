import React, { useState } from 'react';
import { View, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { handlePhotoUpload, getPhotoSignedUrl } from '../services/photoUploadService';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.VITE_API_URL ??
  'https://kinn-api.fly.dev';

export type PhotoSlot = {
  id:          string | null;
  publicUrl:   string | null;
  storagePath: string | null;
  isPrimary:   boolean;
  sortOrder:   number;
};

type Props = {
  slots:    PhotoSlot[];
  onChange: (updated: PhotoSlot[]) => void;
};

const SLOT_SIZE = 110;

function SlotImage({
  slot,
  token,
  onUrlRefreshed,
}: {
  slot: PhotoSlot;
  token: string | null;
  onUrlRefreshed: (newUrl: string) => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(slot.publicUrl);

  const handleRefresh = async () => {
    if (slot.id) {
      const refreshed = await getPhotoSignedUrl(slot.id, true);
      if (refreshed) {
        setImgUrl(refreshed);
        onUrlRefreshed(refreshed);
      }
    }
  };

  if (!imgUrl) return null;

  return (
    <Image
      source={{ uri: imgUrl }}
      style={styles.photo}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={handleRefresh}
    />
  );
}

export function PhotoGrid({ slots, onChange }: Props) {
  const { token } = useAuth();
  const [loadingSlot, setLoadingSlot] = useState<number | null>(null);

  const getUserId = (): string | null => {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]!));
      return payload.sub ?? payload.userId ?? null;
    } catch { return null; }
  };

  const handleSlotTap = async (slot: PhotoSlot) => {
    const userId = getUserId();
    if (!userId) return;

    if (slot.publicUrl || slot.storagePath) {
      Alert.alert('Remove Photo', 'Remove this photo from your profile?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => clearSlot(slot) },
      ]);
      return;
    }

    setLoadingSlot(slot.sortOrder);
    const result = await handlePhotoUpload(userId, slot.isPrimary, slot.sortOrder);
    setLoadingSlot(null);

    if (result.success) {
      onChange(slots.map(s =>
        s.sortOrder === slot.sortOrder
          ? {
              ...s,
              id: result.photoId ?? s.id,
              publicUrl: result.signedUrl || result.publicUrl,
              storagePath: result.storagePath,
            }
          : s
      ));
    }
  };

  const clearSlot = async (slot: PhotoSlot) => {
    if (slot.id && token) {
      try {
        await fetch(`${API_URL}/media/photo/${slot.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.warn('Failed to delete photo on server:', err);
      }
    }

    onChange(slots.map(s =>
      s.sortOrder === slot.sortOrder
        ? { ...s, publicUrl: null, storagePath: null, id: null }
        : s
    ));
  };

  return (
    <View style={styles.grid}>
      {slots.map(slot => {
        const isLoading = loadingSlot === slot.sortOrder;
        const hasPhoto = Boolean(slot.publicUrl || slot.storagePath);
        return (
          <TouchableOpacity
            key={slot.sortOrder}
            onPress={() => handleSlotTap(slot)}
            activeOpacity={0.75}
            style={[
              styles.slot,
              slot.isPrimary && hasPhoto && styles.slotPrimary,
            ]}
          >
            {hasPhoto ? (
              <SlotImage
                slot={slot}
                token={token}
                onUrlRefreshed={(newUrl) => {
                  onChange(slots.map(s => s.sortOrder === slot.sortOrder ? { ...s, publicUrl: newUrl } : s));
                }}
              />
            ) : (
              <View style={styles.empty}>
                <Feather name="plus" size={24} color={Colors.boneDim} />
              </View>
            )}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color={Colors.bone} />
              </View>
            )}
            {slot.isPrimary && hasPhoto && (
              <View style={styles.primaryBadge}>
                <Feather name="star" size={10} color={Colors.bone} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.divider,
    borderStyle: 'dashed',
  },
  slotPrimary: {
    borderColor: Colors.trust,
    borderStyle: 'solid',
    borderWidth: 2,
  },
  photo: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.inkRaised,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: Colors.trust,
    borderRadius: 8,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
