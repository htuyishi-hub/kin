import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: User | null;
  session?: Session | null;
  error?: string;
}

export interface SendOtpResult {
  success: boolean;
  message?: string;
  error?: string;
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
 * Checks whether an email is an official University of Rwanda student email.
 */
export function isUrStudentEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith('@stud.ur.ac.rw') && normalized.length > '@stud.ur.ac.rw'.length;
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
 * Send 6-digit OTP code to ANY personal or student email (e.g. Gmail).
 * Students use personal Google emails and verify via their UR registration number later.
 */
export async function sendEmailOtp(email: string): Promise<SendOtpResult> {
  const normalized = email.trim().toLowerCase();

  if (!isValidEmail(normalized)) {
    return {
      success: false,
      error: 'Injiza imeri ifite ireme (e.g. izina@gmail.com).',
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Ntibyashobotse kohereza kode. Ongera ugerageze.',
      };
    }

    return {
      success: true,
      message: `Kode y'imibare 6 yoherejwe kuri ${normalized}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Habaye ikibazo cy\'itumanaho.',
    };
  }
}

/**
 * Alias for sendEmailOtp for backwards compatibility.
 */
export const sendStudentEmailOtp = sendEmailOtp;

/**
 * Verify 6-digit email OTP for any email.
 */
export async function verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const cleanToken = token.trim();

  if (!cleanToken || cleanToken.length !== 6) {
    return {
      success: false,
      error: 'Injiza kode y\'imibare 6 yuzuye.',
    };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalized,
      token: cleanToken,
      type: 'email',
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Kode ntabwo ari yo cyangwa yarangiye.',
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
      error: err?.message || 'Ntibyashobotse kwemeza kode.',
    };
  }
}

/**
 * Alias for verifyEmailOtp for backwards compatibility.
 */
export const verifyStudentEmailOtp = verifyEmailOtp;

/**
 * Send SMS OTP to local Rwandan mobile number.
 */
export async function sendPhoneOtp(phone: string): Promise<SendOtpResult> {
  const { formatted, isValid } = formatRwandanPhone(phone);

  if (!isValid) {
    return {
      success: false,
      error: 'Injiza nimero ya telefoni nyayo yo mu Rwanda (+250 7X XXX XXXX).',
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone: formatted,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Ntibyashobotse kohereza ubutumwa bugufi.',
      };
    }

    return {
      success: true,
      message: `Kode yoherejwe kuri ${formatted}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Habaye ikibazo cy\'itumanaho.',
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
      error: 'Injiza kode y\'imibare 6 yuzuye.',
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
        error: error.message || 'Kode ntabwo ari yo cyangwa yarangiye.',
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
      error: err?.message || 'Ntibyashobotse kwemeza kode.',
    };
  }
}

/**
 * Signs out the current user and clears session storage.
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
