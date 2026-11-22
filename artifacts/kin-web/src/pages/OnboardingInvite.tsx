import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, KeyRound, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

export default function OnboardingInvite() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { token } = useAuth();

  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleApplyCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = inviteCode.trim().toUpperCase();

    if (!cleanCode) {
      setError(t('onboarding.invite.enterCodeError'));
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const res = await fetch('/api/invites/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ code: cleanCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'INVITE_ALREADY_CLAIMED') {
          setError(t('errors.inviteAlreadyClaimed'));
          return;
        }
        if (data?.code === 'INVITE_MAX_CLAIMS_REACHED') {
          setError(t('errors.inviteMaxClaimsReached'));
          return;
        }
        if (data?.code === 'INVITE_RATE_LIMITED') {
          setError(t('errors.inviteRateLimited'));
          return;
        }
        if (data?.code === 'INVITE_OWN_CODE') {
          setError(t('errors.inviteOwnCode'));
          return;
        }
        if (data?.code === 'INVITE_CODE_REQUIRED') {
          setError(t('onboarding.invite.enterCodeError'));
          return;
        }
        setError(data?.message || t('onboarding.invite.invalidCode'));
        return;
      }

      setLocation('/app');
    } catch (err: any) {
      setError(err?.message || t('common.networkError'));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Step Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#A8A49E]">
          <span className="font-semibold text-[#2563EB]">{t('onboarding.invite.step')}</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-full h-full bg-[#2563EB] rounded-full" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight mt-3">
          {t('onboarding.invite.title')}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleApplyCode} className="flex flex-col gap-4 my-auto py-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.invite.codeLabel')}
          </label>
          <div
            className={`flex items-center bg-[#1A1A2E] border-1.5 rounded-xl overflow-hidden transition-colors ${
              error ? 'border-[#FF6B6B]' : 'border-[#21262D] focus-within:border-[#2563EB]'
            }`}
          >
            <input
              type="text"
              placeholder={t('onboarding.invite.placeholder')}
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value.toUpperCase());
                setError('');
              }}
              className="w-full bg-transparent px-4 py-3.5 text-base text-[#F0EDE6] placeholder-[#4A4742] outline-none font-mono tracking-widest font-bold uppercase"
            />
          </div>
          {error && <span className="text-xs text-[#FF6B6B] font-medium mt-1">{error}</span>}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-13.5 bg-[#C9A84C] text-[#0D1117] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#C9A84C]/90 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-lg mt-2"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#0D1117]" />
          ) : (
            <>
              <KeyRound className="w-5 h-5" />
              <span>{t('onboarding.invite.applyCode')}</span>
            </>
          )}
        </button>
      </form>

      {/* Waitlist option */}
      <div className="flex flex-col items-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => setLocation('/onboarding/waiting')}
          className="w-full py-3 px-4 border border-[#21262D] rounded-full text-xs font-semibold text-[#A8A49E] hover:text-[#F0EDE6] hover:border-[#A8A49E]/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Clock className="w-4 h-4 text-[#C9A84C]" />
          <span>{t('onboarding.invite.continueToWaiting')}</span>
        </button>
      </div>
    </div>
  );
}
