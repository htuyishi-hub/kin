import { supabase } from './supabase';
import { getCurrentLanguage } from '@workspace/i18n';
import type { Session, User } from '@supabase/supabase-js';

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
 * Initiates Google OAuth Sign-In on Web.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'https://app.kinn.ink/auth/callback';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (data?.url) {
      window.location.href = data.url;
      return { success: true };
    }

    return {
      success: false,
      error: 'No OAuth URL returned.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to sign in with Google.',
    };
  }
}

/**
 * Sign up a new user with Email and Password.
 * Since auto-confirm is enabled, session and user are returned immediately.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  role?: string
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();

  if (!isValidEmail(normalized)) {
    return {
      success: false,
      error: 'Invalid email format',
    };
  }

  if (!password || password.length < 6) {
    return {
      success: false,
      error: 'Password must be at least 6 characters',
    };
  }

  try {
    const lang = getCurrentLanguage();
    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: {
        data: {
          lang,
          role: role || 'student',
        },
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (data.user) {
      try {
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            language: lang,
          },
          { onConflict: 'id' }
        );
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
      error: err?.message || 'Failed to sign up.',
    };
  }
}

/**
 * Sign in an existing user with Email and Password.
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();

  if (!isValidEmail(normalized)) {
    return {
      success: false,
      error: 'Invalid email format',
    };
  }

  if (!password) {
    return {
      success: false,
      error: 'Enter your password',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password,
    });

    if (error) {
      const msg = error.message?.toLowerCase() || '';
      const isInvalid =
        msg.includes('invalid login credentials') ||
        msg.includes('invalid_grant') ||
        error.status === 400;

      return {
        success: false,
        error: isInvalid ? 'Invalid login credentials' : error.message,
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
      error: err?.message || 'Failed to sign in.',
    };
  }
}

/**
 * Send 6-digit OTP for new Account Creation (shouldCreateUser: true).
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
 * Send 6-digit OTP for existing User Sign In (shouldCreateUser: false).
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
 * Send recovery OTP code for account recovery flow.
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
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(normalized);

    if (resetErr) {
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
 * Dedicated 6-Digit OTP Verification.
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
    let { data, error } = await supabase.auth.verifyOtp({
      email: normalized,
      token: cleanToken,
      type,
    });

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
 * Checks a verified user's profile to determine post-auth routing.
 */
export async function fetchProfileRouting(userId: string): Promise<{
  onboardingComplete: boolean;
  hasName: boolean;
  isVerified: boolean;
  institutionVerified: boolean;
  accountStatus: string;
}> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, date_of_birth, gender, faculty, primary_intent, onboarding_complete, is_verified, institution_verified, account_status')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return {
        onboardingComplete: false,
        hasName: false,
        isVerified: false,
        institutionVerified: false,
        accountStatus: 'waitlisted',
      };
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
      isVerified: Boolean(data.is_verified),
      institutionVerified: Boolean(data.institution_verified),
      accountStatus: data.account_status || 'waitlisted',
    };
  } catch {
    return {
      onboardingComplete: false,
      hasName: false,
      isVerified: false,
      institutionVerified: false,
      accountStatus: 'waitlisted',
    };
  }
}

/**
 * Signs out current user and clears session storage.
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
