import React, { useEffect, useId } from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../constants/colors';

type Props = {
  size?:    number;
  color?:   string;
  pulse?:   boolean;
  variant?: 'full' | 'mark';
};

export function KLogo({
  size    = 40,
  color,
  pulse   = false,
}: Props) {
  const gradId  = useId();
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

  const stroke = color || `url(#${gradId})`;

  return (
    <Animated.View style={animStyle}>
      <Svg width={size} height={size} viewBox="-76 -76 152 152" fill="none">
        {!color && (
          <Defs>
            <LinearGradient id={gradId} x1="-70" y1="0" x2="70" y2="0" gradientUnits="userSpaceOnUse">
              <Stop offset="0%" stopColor="#38BDF8" />
              <Stop offset="100%" stopColor="#2563EB" />
            </LinearGradient>
          </Defs>
        )}
        <Rect x="-76" y="-76" width="152" height="152" rx="28" fill={Colors.night} />
        <Path
          d="M -65.73 -50 L -65.73 50"
          stroke={stroke}
          strokeWidth={9.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M -57.34 38.11 C -51.75 15.38 -39.86 -3.85 -23.08 -17.13"
          stroke={stroke}
          strokeWidth={9.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M -43.71 11.89 C -34.97 25.87 -26.22 46.50 -12.59 46.50 C -1.75 46.50 2.80 27.62 4.20 3.15 C 4.90 -10.84 17.48 -15.73 33.22 -15.73 C 50.70 -15.73 65.73 -8.04 65.73 10.14 L 65.73 49.30"
          stroke={stroke}
          strokeWidth={9.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

export const KinnLogo = KLogo;

