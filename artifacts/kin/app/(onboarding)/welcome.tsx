import { router } from 'expo-router';
import React, { lazy, Suspense, useEffect, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation, changeLanguage, getCurrentLanguage, type SupportedLanguage } from '@workspace/i18n';

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
  const { t, i18n }       = useTranslation();
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getCurrentLanguage());

  const textOpacity   = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    textOpacity.value = withTiming(1, { duration: 600 });
    const timer = setTimeout(() => {
      buttonOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  async function handleLanguageSelect(lang: SupportedLanguage) {
    await changeLanguage(lang);
    setCurrentLang(lang);
    try {
      await AsyncStorage.setItem('@kin_language', lang);
    } catch {
      // non-fatal
    }
  }

  const taglineStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const buttonStyle  = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }));

  return (
    <View style={styles.root}>
      {/* First-Screen Language Picker */}
      <View style={[styles.langPickerContainer, { top: insets.top + 12 }]}>
        <Pressable
          onPress={() => handleLanguageSelect('en')}
          style={[styles.langPill, currentLang === 'en' && styles.langPillActive]}
          accessibilityRole="button"
          accessibilityLabel="Switch to English"
        >
          <Text style={[styles.langPillText, currentLang === 'en' && styles.langPillTextActive]}>EN</Text>
        </Pressable>
        <Pressable
          onPress={() => handleLanguageSelect('rw')}
          style={[styles.langPill, currentLang === 'rw' && styles.langPillActive]}
          accessibilityRole="button"
          accessibilityLabel="Hindura mu Kinyarwanda"
        >
          <Text style={[styles.langPillText, currentLang === 'rw' && styles.langPillTextActive]}>RW</Text>
        </Pressable>
      </View>

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
        <Text style={styles.taglineEN}>{t('welcome.tagline')}</Text>
      </Animated.View>

      <Animated.View
        style={[styles.buttonContainer, { paddingBottom: insets.bottom + 40 }, buttonStyle]}
      >
        {/* Button 1: University Students */}
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => router.push({ pathname: '/(onboarding)/email', params: { role: 'student', mode: 'signup' } })}
          accessibilityLabel={t('welcome.studentSignUp')}
          accessibilityRole="button"
        >
          <UrBadge />
          <Text style={styles.socialButtonText}>{t('welcome.studentSignUp')}</Text>
        </Pressable>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('welcome.orDivider')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Button 2: Personal Account */}
        <Pressable
          style={({ pressed }) => [
            styles.personalButton,
            pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => router.push({ pathname: '/(onboarding)/email', params: { role: 'personal', mode: 'signup' } })}
          accessibilityLabel={t('welcome.personalSignUp')}
          accessibilityRole="button"
        >
          <InviteBadge />
          <Text style={styles.personalButtonText}>{t('welcome.personalSignUp')}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(onboarding)/sign-in')}
          style={styles.signInLink}
          accessibilityLabel={t('welcome.signInAction')}
          accessibilityRole="button"
        >
          <Text style={styles.signInLabel}>{t('welcome.alreadyHaveAccount')}</Text>
          <Text style={styles.signInAction}> {t('welcome.signInAction')}</Text>
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
  langPickerContainer: {
    position:        'absolute',
    right:           20,
    zIndex:          100,
    flexDirection:   'row',
    backgroundColor: Colors.ink,
    borderRadius:    Radius.full,
    padding:         3,
    borderWidth:     1,
    borderColor:     Colors.divider,
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      Radius.full,
  },
  langPillActive: {
    backgroundColor: Colors.coral,
  },
  langPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   12,
    color:      Colors.boneDim,
  },
  langPillTextActive: {
    color:      Colors.bone,
    fontWeight: 'bold',
  },
});
