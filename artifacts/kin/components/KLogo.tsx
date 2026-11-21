import React, { useEffect } from 'react';
import { Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  size?:    number;
  color?:   string;
  pulse?:   boolean;
  variant?: 'full' | 'mark';
};

export function KLogo({
  size    = 40,
  pulse   = false,
}: Props) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulse) return;
    // Single heartbeat: grow → shrink → grow → settle
    scale.value = withSequence(
      withTiming(1.18, { duration: 280, easing: Easing.out(Easing.ease) }),
      withTiming(0.94, { duration: 160, easing: Easing.in(Easing.ease) }),
      withTiming(1.06, { duration: 200, easing: Easing.out(Easing.ease) }),
      withTiming(1.00, { duration: 300, easing: Easing.inOut(Easing.ease) }),
    );
    opacity.value = withSequence(
      withTiming(0.8, { duration: 280 }),
      withTiming(1.0, { duration: 460 }),
    );
  }, [pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <Image
        source={require('../assets/logo_mark_transparent.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export const KinnLogo = KLogo;

