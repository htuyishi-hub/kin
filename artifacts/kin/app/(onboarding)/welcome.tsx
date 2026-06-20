import { router } from 'expo-router';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useAuth }        from '@/contexts/AuthContext';
import { useAuth0Login }  from '@/hooks/useAuth0Login';

const ShadowCanvas = lazy(async () => {
  await ensureSkiaReady();
  return import('@/components/ShadowCanvas');
});

export default function WelcomeScreen() {
  const insets            = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { signIn }        = useAuth();
  const [loading, setLoading] = useState(false);

  const textOpacity   = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) });
    }, 2000);
  }, []);

  const taglineStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const buttonStyle  = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  const { login } = useAuth0Login(async (result) => {
    setLoading(false);
    if (!result.success) {
      if (result.code === 'cancelled') return;
      if (result.code === 'not_configured') {
        Alert.alert('Not Available', 'Social sign-in is not configured yet.');
        return;
      }
      Alert.alert('Sign-in Failed', result.error ?? 'Please try again.');
      return;
    }
    await signIn(result.token, result.userId);
    if (result.isNewUser || !result.onboardingComplete) {
      router.replace('/(onboarding)/personal');
    } else {
      router.replace('/');
    }
  });

  async function handleSocialLogin() {
    setLoading(true);
    await login();
  }

  return (
    <View style={styles.root}>
      <Suspense fallback={null}>
        <ShadowCanvas
          textOpacity={textOpacity}
          screenWidth={width}
          screenHeight={height}
        />
      </Suspense>

      <Animated.View
        style={[styles.taglineContainer, { top: height * 0.52 }, taglineStyle]}
        pointerEvents="none"
      >
        <Text style={styles.taglineRW}>Umuntu uzabana nawe ari hano.</Text>
        <Text style={styles.taglineEN}>The person you will marry is here.</Text>
      </Animated.View>

      <Animated.View
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 40 }, buttonStyle]}
      >
        {/* Social sign-in via Auth0 — primary */}
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
            loading && { opacity: 0.7 },
          ]}
          onPress={handleSocialLogin}
          disabled={loading}
          accessibilityLabel="Continue with Google"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={Colors.night} size="small" />
          ) : (
            <>
              <GoogleG />
              <Text style={styles.socialButtonText}>Injira na Google · Continue with Google</Text>
            </>
          )}
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>cyangwa · or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Phone OTP — fallback */}
        <Pressable
          style={({ pressed }) => [
            styles.phoneButton,
            pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => router.push('/(onboarding)/phone')}
          accessibilityLabel="Continue with phone number"
          accessibilityRole="button"
        >
          <Text style={styles.phoneButtonText}>Tangira · Get Started with Phone</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(onboarding)/phone')}
          style={styles.signInLink}
        >
          <Text style={styles.signInLabel}>Ufite konti?</Text>
          <Text style={styles.signInAction}> Injira · Sign in</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function GoogleG() {
  return (
    <View style={styles.googleBadge}>
      <Text style={styles.googleG}>G</Text>
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
  googleBadge: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: Colors.trust,
    alignItems:      'center',
    justifyContent:  'center',
  },
  googleG: {
    fontFamily: 'Inter_700Bold',
    fontSize:   13,
    color:      Colors.bone,
    lineHeight: 17,
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
  phoneButton: {
    width:           '100%',
    height:          52,
    borderRadius:    Radius.full,
    borderWidth:     1.5,
    borderColor:     Colors.divider,
    alignItems:      'center',
    justifyContent:  'center',
  },
  phoneButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   15,
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
