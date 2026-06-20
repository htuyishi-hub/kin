import React, { useEffect } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';

type Props = {
  size?:    number;
  color?:   string;
  pulse?:   boolean;
  variant?: 'full' | 'mark';
};

export function KLogo({
  size    = 40,
  color   = Colors.trust,
  pulse   = false,
  variant = 'mark',
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
      withTiming(0.7, { duration: 280 }),
      withTiming(1.0, { duration: 460 }),
    );
  }, [pulse]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // K letterform: vertical stroke + upper arm + lower arm
  const x1   = size * 0.28;
  const x2   = size * 0.72;
  const yTop = size * 0.18;
  const yMid = size * 0.50;
  const yBot = size * 0.82;

  const kPath = `M ${x1} ${yTop} L ${x1} ${yBot} M ${x1} ${yMid} L ${x2} ${yTop} M ${x1} ${yMid} L ${x2} ${yBot}`;

  return (
    <Animated.View style={animStyle}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {variant === 'full' && (
          <Rect
            x={size * 0.04}
            y={size * 0.04}
            width={size * 0.92}
            height={size * 0.92}
            rx={size * 0.22}
            fill={color}
            opacity={0.12}
          />
        )}
        <Path
          d={kPath}
          stroke={color}
          strokeWidth={size * 0.09}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
