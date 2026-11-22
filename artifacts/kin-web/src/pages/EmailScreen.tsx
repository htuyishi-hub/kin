import React, { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@workspace/i18n';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProfileRouting,
  isValidEmail,
  signInWithGoogle,
  signUpWithPassword,
} from '@/lib/authService';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function EmailScreen() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const role = params.get('role') || 'student';
  const isStudent = role === 'student';
  const { t } = useTranslation();
  const { setSession, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [isPendingGoogle, setIsPendingGoogle] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedPassword = password;

    if (!cleanedEmail) {
      setError(t('auth.email.enterEmail'));
      return;
    }

    if (!isValidEmail(cleanedEmail)) {
      setError(t('auth.email.invalidFormat'));
      return;
    }

    if (!cleanedPassword) {
      setError(t('auth.email.enterPassword'));
      return;
    }

    if (cleanedPassword.length < 6) {
      setError(t('auth.email.passwordTooShort'));
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const res = await signUpWithPassword(cleanedEmail, cleanedPassword, role);
      if (!res.success || !res.user) {
        setError(res.error || t('auth.email.signUpFailed'));
        return;
      }

      if (res.session) {
        await setSession(res.session);
        await signIn(res.session.access_token, res.user.id);
      }

      const routing = await fetchProfileRouting(res.user.id);
      if (routing.onboardingComplete) {
        setLocation('/app');
      } else {
        setLocation('/onboarding/personal');
      }
    } catch (err: any) {
      setError(err?.message || t('auth.email.signUpFailed'));
    } finally {
      setIsPending(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setIsPendingGoogle(true);
    try {
      const res = await signInWithGoogle();
      if (!res.success) {
        setError(res.error || t('errors.generic'));
      }
    } catch (err: any) {
      setError(err?.message || t('errors.generic'));
    } finally {
      setIsPendingGoogle(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setLocation('/')}
          className="self-start py-1.5 text-sm font-medium text-[#FF6B6B] hover:opacity-80 transition-opacity cursor-pointer mb-2"
        >
          ← {t('common.back')}
        </button>

        <div className="flex items-center mb-1">
          {isStudent ? (
            <span className="bg-[#2563EB] text-[#F0EDE6] text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">
              {t('discover.urStudentBadge')}
            </span>
          ) : (
            <span className="bg-[#242438] text-[#C9A84C] text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">
              {t('welcome.inviteBadge')}
            </span>
          )}
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight">
          {isStudent ? t('auth.email.studentTitle') : t('auth.email.personalTitle')}
        </h1>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-auto py-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('auth.email.inputLabel')}
          </label>
          <div
            className={`flex items-center bg-[#1A1A2E] border-1.5 rounded-xl overflow-hidden transition-colors ${
              error ? 'border-[#FF6B6B]' : 'border-[#21262D] focus-within:border-[#2563EB]'
            }`}
          >
            <input
              type="email"
              placeholder={t('auth.email.placeholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              autoFocus
              className="w-full bg-transparent px-4 py-3 text-base text-[#F0EDE6] placeholder-[#4A4742] outline-none font-medium"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('auth.email.passwordLabel')}
          </label>
          <div
            className={`flex items-center bg-[#1A1A2E] border-1.5 rounded-xl overflow-hidden transition-colors ${
              error ? 'border-[#FF6B6B]' : 'border-[#21262D] focus-within:border-[#2563EB]'
            }`}
          >
            <input
              type="password"
              placeholder={t('auth.email.passwordPlaceholder')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full bg-transparent px-4 py-3 text-base text-[#F0EDE6] placeholder-[#4A4742] outline-none font-medium"
            />
          </div>
          {error && <span className="text-xs text-[#FF6B6B] mt-1 font-medium">{error}</span>}
        </div>

        <button
          type="submit"
          disabled={isPending || isPendingGoogle}
          className="w-full h-12 bg-[#2563EB] text-[#F0EDE6] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#1A4DB8] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-lg mt-1"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <span>{t('auth.email.createAccount')}</span>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full px-2 my-1">
          <div className="flex-1 h-px bg-[#21262D]" />
          <span className="text-xs text-[#A8A49E] font-medium">{t('auth.email.orDivider')}</span>
          <div className="flex-1 h-px bg-[#21262D]" />
        </div>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isPending || isPendingGoogle}
          className="w-full h-12 bg-white text-[#1F2937] rounded-full font-semibold text-[15px] flex items-center justify-center gap-2.5 hover:bg-neutral-100 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-md"
        >
          {isPendingGoogle ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#1F2937]" />
          ) : (
            <>
              <GoogleIcon />
              <span>{t('auth.email.continueWithGoogle')}</span>
            </>
          )}
        </button>
      </form>

      {/* Footer Link */}
      <div className="flex justify-center pb-2">
        <button
          onClick={() => setLocation('/signin')}
          className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="text-[#A8A49E]">{t('auth.email.alreadyHaveAccount')}</span>
          <span className="font-semibold text-[#2563EB]">{t('auth.email.signInAction')}</span>
        </button>
      </div>
    </div>
  );
}
