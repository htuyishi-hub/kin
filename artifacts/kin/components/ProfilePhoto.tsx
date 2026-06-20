import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '../constants/colors';

type Props = {
  url?:          string | null;
  shouldBlur?:   boolean;
  size?:         number;
  borderRadius?: number;
};

export function ProfilePhoto({
  url,
  shouldBlur   = false,
  size         = 80,
  borderRadius = 40,
}: Props) {
  const [loaded, setLoaded] = useState(false);

  if (!url) {
    return (
      <View style={[styles.placeholder, { width: size, height: size, borderRadius }]} />
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius, overflow: 'hidden' }}>
      {!loaded && (
        <View style={[styles.skeleton, { width: size, height: size }]} />
      )}
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, opacity: shouldBlur ? 0.08 : 1 }}
        contentFit="cover"
        transition={250}
        cachePolicy="memory-disk"
        onLoad={() => setLoaded(true)}
      />
      {shouldBlur && (
        <View style={[styles.blurOverlay, { width: size, height: size }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: Colors.inkRaised },
  skeleton:    { position: 'absolute', backgroundColor: Colors.inkRaised },
  blurOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(13,17,23,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
