import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Clock, KeyRound, Share2, Copy, Check, Award, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

export default function OnboardingWaiting() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { token, user } = useAuth();

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(`https://kin.rw/invite/${user?.id?.slice(0, 8) || 'member'}`);

  useEffect(() => {
    if (token) {
      fetch('/api/invites/my-code', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.inviteLink) setInviteUrl(d.inviteLink);
        })
        .catch(() => {});
    }
  }, [token]);

  async function handleClaimCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = inviteCodeInput.trim().toUpperCase();

    if (!cleanCode) {
      setError(t('onboarding.invite.enterCodeError'));
      return;
    }

    setClaiming(true);
    setError('');

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
        if (data?.code === 'INVITE_INVALID') {
          setError(t('onboarding.invite.invalidCode'));
          return;
        }
        setError(data?.message || t('onboarding.invite.invalidCode'));
        return;
      }

      setClaimSuccess(t('onboarding.invite.verifiedByMember'));
      setTimeout(() => {
        setLocation('/app');
      }, 1000);
    } catch (err: any) {
      setError(err?.message || t('errors.generic'));
    } finally {
      setClaiming(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-2 pt-4">
        <div className="w-14 h-14 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C] flex items-center justify-center text-[#C9A84C] mb-1">
          <Clock className="w-7 h-7" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight">
          {t('waiting.almostThere')}
        </h1>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 my-auto py-2">
        {/* Claim Invite Code Card */}
        <form onSubmit={handleClaimCode} className="p-4 bg-[#1A1A2E]/70 border border-[#21262D] rounded-2xl flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-[#C9A84C]">
            <KeyRound className="w-4 h-4" />
            <label className="text-xs font-semibold uppercase tracking-wider text-[#F0EDE6]">
              {t('onboarding.invite.title')}
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t('onboarding.invite.placeholder')}
              value={inviteCodeInput}
              onChange={(e) => {
                setInviteCodeInput(e.target.value.toUpperCase());
                setError('');
              }}
              className="flex-1 bg-[#0D1117] border border-[#21262D] focus:border-[#2563EB] rounded-xl px-3 py-2 text-sm text-[#F0EDE6] placeholder-[#4A4742] outline-none font-mono tracking-wider font-bold uppercase"
            />
            <button
              type="submit"
              disabled={claiming}
              className="px-4 py-2 bg-[#2563EB] hover:bg-[#1A4DB8] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
            >
              {claiming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>{t('onboarding.invite.applyCode')}</span>
              )}
            </button>
          </div>

          {error && <span className="text-xs text-[#FF6B6B] font-medium">{error}</span>}
          {claimSuccess && <span className="text-xs text-[#3FB950] font-medium">{claimSuccess}</span>}
        </form>

        {/* Shareable Invite Link Card */}
        <div className="p-4 bg-[#1A1A2E]/70 border border-[#21262D] rounded-2xl flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('waiting.inviteLinkTitle')}
          </label>
          <div className="flex items-center gap-2 p-2.5 bg-[#0D1117] border border-[#21262D] rounded-xl">
            <span className="text-xs text-[#F0EDE6] font-mono truncate flex-1 select-all">
              {inviteUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 bg-[#2563EB] text-white rounded-lg hover:bg-[#1A4DB8] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          {copied && (
            <span className="text-[11px] text-[#3FB950] font-semibold text-center mt-0.5">
              {t('waiting.copied')}
            </span>
          )}
        </div>

        {/* UR Student Verification Pathway */}
        <button
          type="button"
          onClick={() => setLocation('/onboarding/ur')}
          className="p-3.5 bg-[#1A1A2E]/70 border border-[#21262D] rounded-2xl flex items-center justify-between text-left hover:border-[#2563EB]/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Award className="w-4 h-4 text-[#C9A84C]" />
            <span className="text-xs font-semibold text-[#F0EDE6]">
              {t('onboarding.ur.campusTitle')}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-[#A8A49E]" />
        </button>
      </div>

      {/* Share Button */}
      <div className="flex flex-col gap-2.5 pb-2">
        <button
          type="button"
          onClick={handleCopy}
          className="w-full h-13.5 bg-[#C9A84C] text-[#0D1117] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#C9A84C]/90 active:scale-[0.98] transition-all cursor-pointer shadow-lg"
        >
          <Share2 className="w-4 h-4" />
          <span>{copied ? t('waiting.copied') : t('waiting.share')}</span>
        </button>
      </div>
    </div>
  );
}
