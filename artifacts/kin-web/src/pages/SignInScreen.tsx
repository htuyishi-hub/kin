import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@workspace/i18n';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchProfileRouting,
  isValidEmail,
  signInWithGoogle,
  signInWithPassword,
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

export default function SignInScreen() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user, isLoading, setSession, signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isNotFound, setIsNotFound] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isPendingGoogle, setIsPendingGoogle] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      fetchProfileRouting(user.id).then((routing) => {
        if (routing.onboardingComplete) {
          setLocation('/app');
        } else {
          setLocation('/onboarding/personal');
        }
      });
    }
  }, [user, isLoading, setLocation]);

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
      setError(t('auth.signIn.enterPassword'));
      return;
    }

    setError('');
    setIsNotFound(false);
    setIsPending(true);

    try {
      const res = await signInWithPassword(cleanedEmail, cleanedPassword);
      if (!res.success || !res.user) {
        if (res.error === 'Invalid login credentials') {
          setError(t('auth.signIn.invalidCredentials'));
        } else {
          setError(res.error || t('auth.signIn.signInFailed'));
        }
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
      setError(err?.message || t('auth.signIn.signInFailed'));
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

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight">
          {t('auth.signIn.title')}
        </h1>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-auto py-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('auth.signIn.emailLabel')}
          </label>
          <div
            className={`flex items-center bg-[#1A1A2E] border-1.5 rounded-xl overflow-hidden transition-colors ${
              error ? 'border-[#FF6B6B]' : 'border-[#21262D] focus-within:border-[#2563EB]'
            }`}
          >
            <input
              type="email"
              placeholder={t('auth.signIn.emailPlaceholder')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
                setIsNotFound(false);
              }}
              autoFocus
              className="w-full bg-transparent px-4 py-3 text-base text-[#F0EDE6] placeholder-[#4A4742] outline-none font-medium"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('auth.signIn.passwordLabel')}
          </label>
          <div
            className={`flex items-center bg-[#1A1A2E] border-1.5 rounded-xl overflow-hidden transition-colors ${
              error ? 'border-[#FF6B6B]' : 'border-[#21262D] focus-within:border-[#2563EB]'
            }`}
          >
            <input
              type="password"
              placeholder={t('auth.signIn.passwordPlaceholder')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
                setIsNotFound(false);
              }}
              className="w-full bg-transparent px-4 py-3 text-base text-[#F0EDE6] placeholder-[#4A4742] outline-none font-medium"
            />
          </div>

          {error && (
            <div className="p-3 mt-1.5 rounded-lg bg-[#E5534B]/15 border border-[#FF6B6B] flex flex-col gap-2">
              <span className="text-xs text-[#FF6B6B] font-medium leading-relaxed">
                {error}
              </span>
              {isNotFound && (
                <button
                  type="button"
                  onClick={() => setLocation('/signup')}
                  className="self-start bg-[#FF6B6B] text-[#0D1117] text-[11px] font-bold px-3 py-1.5 rounded-md hover:bg-[#FF6B6B]/90 transition-colors cursor-pointer"
                >
                  {t('auth.signIn.createAccount')}
                </button>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isPending || isPendingGoogle}
          className="w-full h-12 bg-[#2563EB] text-[#F0EDE6] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#1A4DB8] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-lg mt-1"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <span>{t('auth.signIn.submit')}</span>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full px-2 my-1">
          <div className="flex-1 h-px bg-[#21262D]" />
          <span className="text-xs text-[#A8A49E] font-medium">{t('auth.signIn.orDivider')}</span>
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
              <span>{t('auth.signIn.continueWithGoogle')}</span>
            </>
          )}
        </button>

        {/* Forgot Account Link */}
        <button
          type="button"
          onClick={() => setLocation('/forgot-account')}
          className="self-center py-2 text-xs font-medium text-[#FF6B6B] hover:underline cursor-pointer"
        >
          {t('auth.signIn.forgotAccount')}
        </button>
      </form>

      {/* Footer Link */}
      <div className="flex justify-center pb-2">
        <button
          onClick={() => setLocation('/signup')}
          className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="text-[#A8A49E]">{t('auth.signIn.noAccount')}</span>
          <span className="font-semibold text-[#2563EB]">{t('auth.signIn.createAccount')}</span>
        </button>
      </div>
    </div>
  );
}
