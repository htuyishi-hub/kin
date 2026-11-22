import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { getCurrentLanguage } from '@workspace/i18n';
import type { Session, User } from '@supabase/supabase-js';

// Complete any pending auth session if on web or resumed
if (Platform.OS === 'web') {
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch {
    // ignore
  }
}

export interface AuthResult {
  success: boolean;
  user?: User | null;
  session?: Session | null;
  error?: string;
  isNotFound?: boolean;
}

export interface SendOtpResult {
  success: boolean;
  message?: string;
  error?: string;
  isNotFound?: boolean;
}

/**
 * Validates that an email is in standard format (e.g. user@gmail.com).
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

/**
 * Formats a local Rwandan phone number into strict E.164 format (+2507XXXXXXXX).
 */
export function formatRwandanPhone(phone: string): { formatted: string; isValid: boolean } {
  if (!phone) return { formatted: '', isValid: false };

  let cleaned = phone.trim().replace(/[\s-]/g, '');

  if (cleaned.startsWith('+250')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('250')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('07')) {
    cleaned = cleaned.substring(1);
  }

  // 9 digits starting with 72, 73, 78, 79
  const isValid = /^7[2389]\d{7}$/.test(cleaned);
  return {
    formatted: `+250${cleaned}`,
    isValid,
  };
}

/**
 * Initiates Google OAuth Sign-In with Expo deep-linking redirect (kin://callback).
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    // Generate deep-link redirect URL matching app scheme
    const redirectUrl = Linking.createURL('callback');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Ntibyashobotse gutangiza Google Sign-In.',
      };
    }

    if (!data?.url) {
      return {
        success: false,
        error: 'Nta murongo wa Google wagarutse.',
      };
    }

    // On Web, the browser redirects automatically
    if (Platform.OS === 'web') {
      window.location.href = data.url;
      return { success: true };
    }

    // On Native (Android / iOS), launch in-app browser session
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (res.type === 'success' && res.url) {
      const url = res.url;
      const hashIndex = url.indexOf('#');
      const queryIndex = url.indexOf('?');

      let paramsString = '';
      if (hashIndex !== -1) {
        paramsString = url.substring(hashIndex + 1);
      } else if (queryIndex !== -1) {
        paramsString = url.substring(queryIndex + 1);
      }

      const params = new URLSearchParams(paramsString);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionErr) {
          return { success: false, error: sessionErr.message };
        }

        return {
          success: true,
          user: sessionData.user,
          session: sessionData.session,
        };
      }

      // Check PKCE authorization code exchange
      const code = params.get('code');
      if (code) {
        const { data: sessionData, error: sessionErr } =
          await supabase.auth.exchangeCodeForSession(code);

        if (sessionErr) {
          return { success: false, error: sessionErr.message };
        }

        return {
          success: true,
          user: sessionData.user,
          session: sessionData.session,
        };
      }

      const errorDescription = params.get('error_description') || params.get('error');
      if (errorDescription) {
        return { success: false, error: errorDescription };
      }
    } else if (res.type === 'cancel' || res.type === 'dismiss') {
      return {
        success: false,
        error: 'Canceled',
      };
    }

    return {
      success: false,
      error: 'No account information returned. Please try again.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to sign in with Google.',
    };
  }
}

/**
 * Task 2.1: Send 6-digit OTP for new Account Creation (shouldCreateUser: true).
 */
export async function sendOtpForSignUp(email: string): Promise<SendOtpResult> {
  const normalized = email.trim().toLowerCase();

  if (!isValidEmail(normalized)) {
    return {
      success: false,
      error: 'Invalid email format',
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
        data: {
          lang: getCurrentLanguage(),
        },
      },
    });

    if (error) {
      if (error.message?.toLowerCase().includes('rate limit')) {
        return {
          success: false,
          error: 'Too many attempts. Please wait.',
        };
      }
      return {
        success: false,
        error: error.message || 'Failed to send code. Please try again.',
      };
    }

    return {
      success: true,
      message: `6-digit code sent to ${normalized}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error.',
    };
  }
}

/**
 * Task 2.2: Send 6-digit OTP for existing User Sign In (shouldCreateUser: false).
 * If email does not exist, returns clear error instead of creating an account.
 */
export async function sendOtpForSignIn(email: string): Promise<SendOtpResult> {
  const normalized = email.trim().toLowerCase();

  if (!isValidEmail(normalized)) {
    return {
      success: false,
      error: 'Invalid email format',
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: false,
        data: {
          lang: getCurrentLanguage(),
        },
      },
    });

    if (error) {
      const msg = error.message?.toLowerCase() || '';
      // Supabase returns 422 with otp_disabled or "Signups not allowed for otp" or "User not found"
      if (
        error.status === 422 ||
        (error as any).code === 'otp_disabled' ||
        msg.includes('signups not allowed') ||
        msg.includes('user not found')
      ) {
        return {
          success: false,
          isNotFound: true,
          error: 'Account not found. Please create an account.',
        };
      }

      if (msg.includes('rate limit')) {
        return {
          success: false,
          error: 'Too many attempts. Please wait.',
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to send login code.',
      };
    }

    return {
      success: true,
      message: `Login code sent to ${normalized}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error.',
    };
  }
}

/**
 * Task 4: Send recovery OTP code for account recovery flow.
 */
export async function sendOtpForRecovery(email: string): Promise<SendOtpResult> {
  const normalized = email.trim().toLowerCase();

  if (!isValidEmail(normalized)) {
    return {
      success: false,
      error: 'Invalid email format',
    };
  }

  try {
    // First try password reset flow which delivers recovery token
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(normalized);

    if (resetErr) {
      // If password reset not enabled or fails, fall back to non-signup OTP
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: false,
          data: {
            lang: getCurrentLanguage(),
          },
        },
      });

      if (otpErr) {
        const msg = otpErr.message?.toLowerCase() || '';
        if (
          otpErr.status === 422 ||
          msg.includes('signups not allowed') ||
          msg.includes('user not found')
        ) {
          return {
            success: false,
            isNotFound: true,
            error: 'No account associated with this email address.',
          };
        }
        return {
          success: false,
          error: otpErr.message || 'Failed to send recovery code.',
        };
      }
    }

    return {
      success: true,
      message: `Recovery code sent to ${normalized}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error.',
    };
  }
}

/**
 * Task 3: Dedicated 6-Digit OTP Verification.
 * Supports 'email', 'signup', and 'recovery'.
 */
export async function verifyEmailOtp(
  email: string,
  token: string,
  type: 'email' | 'signup' | 'recovery' = 'email'
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const cleanToken = token.trim();

  if (!cleanToken || cleanToken.length !== 6) {
    return {
      success: false,
      error: 'Enter complete 6-digit code',
    };
  }

  try {
    // Attempt verification with the primary type
    let { data, error } = await supabase.auth.verifyOtp({
      email: normalized,
      token: cleanToken,
      type,
    });

    // If type was 'email' and failed, try 'signup' in case signUp() created the code
    if (error && type === 'email') {
      const fallback = await supabase.auth.verifyOtp({
        email: normalized,
        token: cleanToken,
        type: 'signup',
      });
      if (!fallback.error) {
        data = fallback.data;
        error = null;
      }
    }

    if (error) {
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('wrong')) {
        return {
          success: false,
          error: 'Code is invalid or has expired',
        };
      }
      if (msg.includes('rate limit')) {
        return {
          success: false,
          error: 'Too many attempts. Please wait.',
        };
      }
      return {
        success: false,
        error: error.message || 'Failed to verify code.',
      };
    }

    if (data.user) {
      try {
        const lang = getCurrentLanguage();
        await supabase.auth.updateUser({ data: { lang } });
        await supabase.from('profiles').update({ language: lang }).eq('id', data.user.id);
      } catch {
        // non-fatal
      }
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to verify code. Please try again.',
    };
  }
}

/**
 * Legacy aliases for backwards compatibility with existing screens.
 */
export const sendEmailOtp = sendOtpForSignUp;
export const sendStudentEmailOtp = sendOtpForSignUp;
export const verifyStudentEmailOtp = verifyEmailOtp;

/**
 * Send SMS OTP to Rwandan mobile number.
 */
export async function sendPhoneOtp(phone: string): Promise<SendOtpResult> {
  const { formatted, isValid } = formatRwandanPhone(phone);

  if (!isValid) {
    return {
      success: false,
      error: 'Please enter a valid Rwandan phone number (+250 7X XXX XXXX).',
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: formatted,
      options: {
        shouldCreateUser: true,
        data: {
          lang: getCurrentLanguage(),
        },
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to send SMS code.',
      };
    }

    return {
      success: true,
      message: `Code sent to ${formatted}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error.',
    };
  }
}

/**
 * Verify SMS OTP.
 */
export async function verifyPhoneOtp(phone: string, token: string): Promise<AuthResult> {
  const { formatted } = formatRwandanPhone(phone);
  const cleanToken = token.trim();

  if (!cleanToken || cleanToken.length !== 6) {
    return {
      success: false,
      error: 'Please enter the full 6-digit code.',
    };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: cleanToken,
      type: 'sms',
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Code is invalid or has expired.',
      };
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to verify code. Please try again.',
    };
  }
}

/**
 * Signs out current user and clears session from SecureStore.
 */
export async function signOut(): Promise<{ error?: string }> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };
    return {};
  } catch (err: any) {
    return { error: err?.message };
  }
}

/**
 * Checks a verified user's profile to determine post-auth routing.
 */
export async function fetchProfileRouting(userId: string): Promise<{
  onboardingComplete: boolean;
  hasName: boolean;
  accountStatus: string;
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, date_of_birth, gender, faculty, primary_intent, onboarding_complete, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return { onboardingComplete: false, hasName: false, accountStatus: 'waitlisted' };
    }

    const hasAllFive = Boolean(
      data.full_name &&
      data.full_name.trim().length > 0 &&
      data.date_of_birth &&
      data.gender &&
      data.gender.trim().length > 0 &&
      data.faculty &&
      data.faculty.trim().length > 0 &&
      data.primary_intent &&
      data.primary_intent.trim().length > 0
    );

    const onboardingComplete = Boolean(data.onboarding_complete && hasAllFive);
    const hasName = Boolean(data.full_name && data.full_name.trim().length > 0);

    return {
      onboardingComplete,
      hasName,
      accountStatus: data.account_status || 'waitlisted',
    };
  } catch {
    return { onboardingComplete: false, hasName: false, accountStatus: 'waitlisted' };
  }
}
