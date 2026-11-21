import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, GraduationCap, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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
  const { user } = useAuth();

  const [campus, setCampus] = useState('Huye');
  const [regNumber, setRegNumber] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const cleanReg = regNumber.trim();

    if (!cleanReg) {
      setError('Injiza registration number yawe ya UR · Enter your 9-digit reg number');
      return;
    }

    if (cleanReg.length !== 9 || !/^\d{9}$/.test(cleanReg)) {
      setError('Registration number igomba kuba igizwe n\'imibare 9 (urugero: 222012345)');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      if (user?.id) {
        // Update user profile as verified UR student
        await supabase
          .from('profiles')
          .update({
            institution: 'university_of_rwanda',
            campus: campus,
            registration_number: cleanReg,
            institution_verified: true,
            is_verified: true,
            verification_method: 'ur_registration',
          })
          .eq('id', user.id);
      }

      setVerifiedSuccess(true);
      setTimeout(() => {
        setLocation('/onboarding/prompts');
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Ntibyashobotse kwemeza registration number.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Step Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#A8A49E]">
          <span className="font-semibold text-[#2563EB]">Intambwe ya 3/5</span>
          <span className="font-mono">UR Verification</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-3/5 h-full bg-[#2563EB] rounded-full" />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="bg-[#2563EB] text-[#F0EDE6] text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">
            UR BADGE
          </span>
          <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight">
            Kaminuza y'u Rwanda
          </h1>
        </div>
        <p className="text-xs text-[#A8A49E] leading-relaxed">
          Abanyeshuri n'abize muri UR bahabwa ikirango cy'icyizere (UR Badge) cyemeza umwirondoro wabo.
        </p>
      </div>

      {/* Form Area */}
      <form onSubmit={handleVerify} className="flex flex-col gap-4 my-auto py-4">
        {/* Campus Selection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            Hitamo Campus yawe · UR Campus
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
            Registration Number (Imibare 9)
          </label>
          <div
            className={`flex items-center bg-[#1A1A2E] border-1.5 rounded-xl overflow-hidden transition-colors ${
              error ? 'border-[#FF6B6B]' : 'border-[#21262D] focus-within:border-[#2563EB]'
            }`}
          >
            <input
              type="text"
              placeholder="Urugero: 222012345"
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
            <span className="text-xs font-semibold">UR Badge yemejwe neza! Uhawe ikirango cy'icyizere.</span>
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
              <span>Emeza UR Badge · Verify Student</span>
            </>
          )}
        </button>

        {/* Skip button for non-UR members */}
        <button
          type="button"
          onClick={() => setLocation('/onboarding/vouch')}
          className="py-2 text-xs font-medium text-[#A8A49E] hover:text-[#F0EDE6] transition-colors cursor-pointer text-center"
        >
          Ntabwo ndi umunyeshuri wa UR · Skip / Not a UR student
        </button>
      </div>
    </div>
  );
}
