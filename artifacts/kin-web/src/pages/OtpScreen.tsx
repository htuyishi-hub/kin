import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProfileRouting,
  sendOtpForRecovery,
  sendOtpForSignIn,
  sendOtpForSignUp,
  verifyEmailOtp,
} from '@/lib/authService';

export default function OtpScreen() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const email = params.get('email') || '';
  const mode = params.get('mode') || 'signup';
  const role = params.get('role') || 'student';

  const { signIn, setSession } = useAuth();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // 60-second countdown timer for Resend Code
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  async function handleVerify(code: string) {
    if (code.length !== 6) return;

    setError('');
    setInfoMessage('');
    setVerifying(true);

    try {
      const otpType = (mode === 'recovery'
        ? 'recovery'
        : mode === 'signup'
        ? 'signup'
        : 'email') as 'email' | 'signup' | 'recovery';

      const res = await verifyEmailOtp(email, code, otpType);

      if (!res.success || !res.session || !res.user) {
        setError(res.error || t('auth.otp.invalidCode'));
        setOtp(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
        return;
      }

      await setSession(res.session);
      await signIn(res.session.access_token, res.user.id);

      const routing = await fetchProfileRouting(res.user.id);

      if (routing.onboardingComplete) {
        setLocation('/app');
      } else {
        setLocation('/onboarding/personal');
      }
    } catch (err: any) {
      setError(err?.message || t('auth.otp.verifyFailed'));
    } finally {
      setVerifying(false);
    }
  }

  async function handleResendCode() {
    if (countdown > 0 || resending) return;

    setError('');
    setInfoMessage('');
    setResending(true);

    try {
      let res;
      if (mode === 'recovery') {
        res = await sendOtpForRecovery(email);
      } else if (mode === 'signin') {
        res = await sendOtpForSignIn(email);
      } else {
        res = await sendOtpForSignUp(email);
      }

      if (!res.success) {
        setError(res.error || t('auth.otp.resendFailed'));
        return;
      }

      setInfoMessage(t('auth.otp.newCodeSent'));
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch (err: any) {
      setError(err?.message || t('auth.otp.resendFailed'));
    } finally {
      setResending(false);
    }
  }

  function handleChange(text: string, index: number) {
    // Handle paste of full or partial code
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, 6).split('');
      if (digits.length > 0) {
        const newOtp = [...otp];
        digits.forEach((d, i) => {
          if (i < 6) newOtp[i] = d;
        });
        setOtp(newOtp);
        setError('');

        const nextIndex = Math.min(digits.length, 5);
        inputs.current[nextIndex]?.focus();

        if (digits.length === 6) {
          handleVerify(digits.join(''));
        }
        return;
      }
    }

    const digit = text.slice(-1).replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError('');

    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (index === 5 && digit) {
      const fullCode = [...newOtp.slice(0, 5), digit].join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputs.current[index - 1]?.focus();
    }
  }

  const code = otp.join('');
  const isPending = verifying;

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setLocation(mode === 'signin' ? '/signin' : '/signup')}
          className="self-start py-1.5 text-sm font-medium text-[#FF6B6B] hover:opacity-80 transition-opacity cursor-pointer mb-2"
        >
          ← {t('auth.otp.changeEmail')}
        </button>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight">
          {t('auth.otp.title')}
        </h1>

        <p className="text-xs text-[#A8A49E] leading-relaxed mt-1">
          {t('auth.otp.codeSentTo')} <br />
          <strong className="text-[#F0EDE6] font-semibold">{email || 'your email'}</strong>
        </p>
      </div>

      {/* 6 Digit Cells */}
      <div className="flex flex-col items-center gap-4 my-auto py-4">
        <div className="flex justify-center gap-2.5 w-full">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(r) => {
                inputs.current[i] = r;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={i === 0 ? 6 : 1}
              value={digit}
              autoFocus={i === 0}
              onChange={(e) => handleChange(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`w-11.5 h-14.5 rounded-xl text-center font-bold text-2xl outline-none transition-all ${
                digit
                  ? 'border-1.5 border-[#2563EB] bg-[#242438] text-[#F0EDE6]'
                  : 'border-1.5 border-[#21262D] bg-[#1A1A2E] text-[#F0EDE6] focus:border-[#2563EB]'
              } ${error ? 'border-[#FF6B6B]' : ''}`}
            />
          ))}
        </div>

        {error && <span className="text-xs text-[#FF6B6B] font-medium text-center">{error}</span>}
        {infoMessage && <span className="text-xs text-[#3FB950] font-medium text-center">{infoMessage}</span>}
      </div>

      {/* Action Block */}
      <div className="flex flex-col gap-3 pb-2">
        <button
          onClick={() => handleVerify(code)}
          disabled={isPending || code.length < 6}
          className="w-full h-13.5 bg-[#2563EB] text-[#F0EDE6] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#1A4DB8] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-lg"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <span>{t('auth.otp.verify')}</span>
          )}
        </button>

        {/* 60s Resend Timer */}
        <div className="flex justify-center items-center py-2">
          {countdown > 0 ? (
            <span className="text-xs text-[#A8A49E]">
              {t('auth.otp.resendCountdown')}{' '}
              <strong className="text-[#FF6B6B] font-bold">{countdown}s</strong>
            </span>
          ) : (
            <button
              onClick={handleResendCode}
              disabled={resending}
              className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer flex items-center gap-1.5"
            >
              {resending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
              ) : null}
              <span>{t('auth.otp.resendCode')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
