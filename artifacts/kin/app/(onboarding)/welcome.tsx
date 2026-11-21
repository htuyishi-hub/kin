import { router } from 'expo-router';
import React, { lazy, Suspense, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors }         from '@/constants/colors';
import { Space, Radius }  from '@/constants/spacing';
import { ensureSkiaReady } from '@/utils/loadSkia';

const ShadowCanvas = lazy(async () => {
  await ensureSkiaReady();
  return import('@/components/ShadowCanvas');
});

class SafeShadowCanvas extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: any) {
    console.warn('[Welcome] ShadowCanvas error:', err);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function WelcomeScreen() {
  const insets            = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const textOpacity   = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    textOpacity.value = withTiming(1, { duration: 600 });
    const timer = setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const taglineStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const buttonStyle  = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  return (
    <View style={styles.root}>
      <SafeShadowCanvas>
        <Suspense fallback={null}>
          <ShadowCanvas
            textOpacity={textOpacity}
            screenWidth={width}
            screenHeight={height}
          />
        </Suspense>
      </SafeShadowCanvas>

      <Animated.View
        style={[styles.taglineContainer, { top: height * 0.52 }, taglineStyle]}
        pointerEvents="none"
      >
        <Text style={styles.taglineEN}>The person you will marry is here.</Text>
      </Animated.View>

      <Animated.View
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 40 }, buttonStyle]}
      >
        {/* Button 1: University Students (Normal Google Email -> Verified via UR Reg Number) */}
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => router.push({ pathname: '/(onboarding)/email', params: { role: 'student', mode: 'signup' } })}
          accessibilityLabel="Continue as Student"
          accessibilityRole="button"
        >
          <UrBadge />
          <Text style={styles.socialButtonText}>Student Sign Up</Text>
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Button 2: Personal Account (Normal Google Email -> Verified via Member Invite) */}
        <Pressable
          style={({ pressed }) => [
            styles.personalButton,
            pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => router.push({ pathname: '/(onboarding)/email', params: { role: 'personal', mode: 'signup' } })}
          accessibilityLabel="Continue with Personal Account"
          accessibilityRole="button"
        >
          <InviteBadge />
          <Text style={styles.personalButtonText}>Personal Account (Invited)</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(onboarding)/sign-in')}
          style={styles.signInLink}
          accessibilityLabel="Sign In"
          accessibilityRole="button"
        >
          <Text style={styles.signInLabel}>Already have an account?</Text>
          <Text style={styles.signInAction}> Sign in</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function UrBadge() {
  return (
    <View style={styles.urBadge}>
      <Text style={styles.urText}>UR</Text>
    </View>
  );
}

function InviteBadge() {
  return (
    <View style={styles.inviteBadge}>
      <Text style={styles.inviteText}>INVITE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.night,
  },
  taglineContainer: {
    position:   'absolute',
    left:       Space.px8,
    right:      Space.px8,
    alignItems: 'center',
    gap:        8,
  },
  taglineRW: {
    fontFamily: 'Fraunces_700Bold',
    fontSize:   22,
    color:      Colors.bone,
    textAlign:  'center',
    lineHeight: 28,
  },
  taglineEN: {
    fontFamily: 'Inter_400Regular',
    fontSize:   14,
    color:      Colors.boneDim,
    textAlign:  'center',
  },
  buttonContainer: {
    position:   'absolute',
    bottom:     0,
    left:       Space.px8,
    right:      Space.px8,
    alignItems: 'center',
    gap:        12,
  },
  socialButton: {
    width:           '100%',
    height:          56,
    backgroundColor: Colors.bone,
    borderRadius:    Radius.full,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
  },
  urBadge: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      6,
    backgroundColor:   Colors.trust,
    alignItems:        'center',
    justifyContent:    'center',
  },
  urText: {
    fontFamily: 'Inter_700Bold',
    fontSize:   11,
    color:      Colors.bone,
    letterSpacing: 0.5,
  },
  socialButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   15,
    color:      Colors.night,
  },
  dividerRow: {
    flexDirection:     'row',
    alignItems:        'center',
    width:             '100%',
    gap:               10,
    paddingHorizontal: 4,
  },
  dividerLine: {
    flex:            1,
    height:          1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    fontSize:   12,
    color:      Colors.boneDim,
  },
  personalButton: {
    width:           '100%',
    height:          54,
    borderRadius:    Radius.full,
    borderWidth:     1.5,
    borderColor:     Colors.divider,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
  },
  inviteBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      6,
    backgroundColor:   Colors.inkRaised,
    alignItems:        'center',
    justifyContent:    'center',
  },
  inviteText: {
    fontFamily: 'Inter_700Bold',
    fontSize:   9,
    color:      Colors.gold,
    letterSpacing: 0.5,
  },
  personalButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   14,
    color:      Colors.bone,
  },
  signInLink: {
    flexDirection: 'row',
    padding:       8,
  },
  signInLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize:   14,
    color:      Colors.boneDim,
  },
  signInAction: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   14,
    color:      Colors.trust,
  },
});
