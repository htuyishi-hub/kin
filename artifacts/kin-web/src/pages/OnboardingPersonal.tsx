import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

export default function OnboardingPersonal() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { user, token } = useAuth();

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | ''>('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError(t('onboarding.personal.enterFullName'));
      return;
    }
    if (!dob) {
      setError(t('onboarding.personal.selectDob'));
      return;
    }

    // Check age 18+
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    if (age < 18) {
      setError(t('onboarding.personal.mustBe18'));
      return;
    }

    if (!gender) {
      setError(t('onboarding.personal.selectGender'));
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          dateOfBirth: dob,
          gender,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'UNDERAGE') {
          setError(t('onboarding.personal.mustBe18'));
          return;
        }
        setError(data?.message || t('onboarding.personal.saveFailed'));
        return;
      }

      setLocation('/onboarding/occupation');
    } catch (err: any) {
      setError(err?.message || t('onboarding.personal.saveFailed'));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Step Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#A8A49E]">
          <span className="font-semibold text-[#2563EB]">{t('onboarding.personal.step')}</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-1/3 h-full bg-[#2563EB] rounded-full" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight mt-3">
          {t('onboarding.personal.title')}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-auto py-4">
        {/* Full Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.personal.fullNameLabel')}
          </label>
          <input
            type="text"
            placeholder={t('onboarding.personal.fullNamePlaceholder')}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setError('');
            }}
            className="w-full bg-[#1A1A2E] border-1.5 border-[#21262D] rounded-xl px-4 py-3 text-[#F0EDE6] placeholder-[#4A4742] outline-none focus:border-[#2563EB] font-medium"
          />
        </div>

        {/* Date of Birth */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.personal.dobLabel')}
          </label>
          <input
            type="date"
            value={dob}
            onChange={(e) => {
              setDob(e.target.value);
              setError('');
            }}
            className="w-full bg-[#1A1A2E] border-1.5 border-[#21262D] rounded-xl px-4 py-3 text-[#F0EDE6] outline-none focus:border-[#2563EB] font-medium"
          />
        </div>

        {/* Gender Selection */}
        <div className="flex flex-col gap-1.5 mt-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.personal.genderLabel')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setGender('female');
                setError('');
              }}
              className={`py-3 rounded-xl border-1.5 font-semibold text-sm transition-all cursor-pointer ${
                gender === 'female'
                  ? 'border-[#2563EB] bg-[#2563EB]/15 text-[#F0EDE6]'
                  : 'border-[#21262D] bg-[#1A1A2E] text-[#A8A49E] hover:border-[#A8A49E]/40'
              }`}
            >
              {t('onboarding.personal.genderFemale')}
            </button>
            <button
              type="button"
              onClick={() => {
                setGender('male');
                setError('');
              }}
              className={`py-3 rounded-xl border-1.5 font-semibold text-sm transition-all cursor-pointer ${
                gender === 'male'
                  ? 'border-[#2563EB] bg-[#2563EB]/15 text-[#F0EDE6]'
                  : 'border-[#21262D] bg-[#1A1A2E] text-[#A8A49E] hover:border-[#A8A49E]/40'
              }`}
            >
              {t('onboarding.personal.genderMale')}
            </button>
          </div>
        </div>

        {error && <span className="text-xs text-[#FF6B6B] font-medium mt-1">{error}</span>}
      </form>

      {/* Next Button */}
      <div className="pb-2">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full h-13.5 bg-[#2563EB] text-[#F0EDE6] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#1A4DB8] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-lg"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <span>{t('onboarding.personal.continue')}</span>
          )}
        </button>
      </div>
    </div>
  );
}
