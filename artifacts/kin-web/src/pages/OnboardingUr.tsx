import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, GraduationCap, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

const CAMPUSES = [
  'Huye',
  'Nyarugenge',
  'Remera',
  'Gikondo',
  'Busogo',
  'Rukara',
  'Nyagatare',
  'Rusizi',
];

export default function OnboardingUr() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { token } = useAuth();

  const [campus, setCampus] = useState('Huye');
  const [regNumber, setRegNumber] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const cleanReg = regNumber.trim();

    if (!cleanReg) {
      setError(t('onboarding.ur.enterRegNumber'));
      return;
    }

    if (cleanReg.length !== 9 || !/^\d{9}$/.test(cleanReg)) {
      setError(t('onboarding.ur.mustBe9Digits'));
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const res = await fetch('/api/me/ur/verify-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          registration_number: cleanReg,
          campus: campus.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.code === 'UR_REGISTRATION_INVALID') {
          setError(t('errors.urRegistrationInvalid'));
          return;
        }
        setError(data?.message || t('errors.generic'));
        return;
      }

      if (data?.status === 'already_claimed') {
        setError(t('onboarding.ur.alreadyClaimed'));
        return;
      }

      if (data?.verified === true || data?.status === 'verified') {
        setVerifiedSuccess(true);
        setTimeout(() => {
          setLocation('/app');
        }, 1000);
        return;
      }

      if (data?.code === 'UR_REGISTRATION_INVALID') {
        setError(t('errors.urRegistrationInvalid'));
        return;
      }

      setError(data?.message || t('errors.generic'));
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
          <span className="font-semibold text-[#2563EB]">{t('onboarding.ur.step')}</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-full h-full bg-[#2563EB] rounded-full" />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="bg-[#2563EB] text-[#F0EDE6] text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">
            UR BADGE
          </span>
          <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight">
            University of Rwanda
          </h1>
        </div>
      </div>

      {/* Form Area */}
      <form onSubmit={handleVerify} className="flex flex-col gap-4 my-auto py-4">
        {/* Campus Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.ur.campusLabel')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CAMPUSES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCampus(c)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  campus === c
                    ? 'border-[#2563EB] bg-[#2563EB]/15 text-[#F0EDE6]'
                    : 'border-[#21262D] bg-[#1A1A2E] text-[#A8A49E] hover:border-[#A8A49E]/40'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* 9-Digit Registration Number */}
        <div className="flex flex-col gap-1.5 mt-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.ur.registrationLabel')}
          </label>
          <div
            className={`flex items-center bg-[#1A1A2E] border-1.5 rounded-xl overflow-hidden transition-colors ${
              error ? 'border-[#FF6B6B]' : 'border-[#21262D] focus-within:border-[#2563EB]'
            }`}
          >
            <input
              type="text"
              placeholder={t('onboarding.ur.registrationPlaceholder')}
              value={regNumber}
              maxLength={9}
              onChange={(e) => {
                setRegNumber(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              className="w-full bg-transparent px-4 py-3.5 text-base text-[#F0EDE6] placeholder-[#4A4742] outline-none font-mono tracking-wider font-semibold"
            />
          </div>
          {error && <span className="text-xs text-[#FF6B6B] font-medium mt-1">{error}</span>}
        </div>

        {/* Success confirmation */}
        {verifiedSuccess && (
          <div className="p-3 bg-[#3FB950]/15 border border-[#3FB950] rounded-xl flex items-center gap-2.5 text-[#3FB950]">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-semibold">{t('onboarding.ur.verifiedSuccess')}</span>
          </div>
        )}
      </form>

      {/* Buttons */}
      <div className="flex flex-col gap-2.5 pb-2">
        <button
          onClick={handleVerify}
          disabled={isPending || verifiedSuccess}
          className="w-full h-13.5 bg-[#2563EB] text-[#F0EDE6] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#1A4DB8] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-lg"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <>
              <GraduationCap className="w-5 h-5" />
              <span>{t('onboarding.ur.verifyStudent')}</span>
            </>
          )}
        </button>

        {/* Skip button for non-UR members */}
        <button
          type="button"
          onClick={() => setLocation('/onboarding/invite')}
          className="py-2 text-xs font-medium text-[#A8A49E] hover:text-[#F0EDE6] transition-colors cursor-pointer text-center"
        >
          {t('onboarding.ur.skipNotUr')}
        </button>
      </div>
    </div>
  );
}
