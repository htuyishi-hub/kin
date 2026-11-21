import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function OnboardingPersonal() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | ''>('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Injiza amazina yawe yose · Enter your full name');
      return;
    }
    if (!dob) {
      setError("Hitamo itariki y'amavuko · Select your birth date");
      return;
    }

    // Check age 18+
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    if (age < 18) {
      setError('Ugomba kuba ufite nibura imyaka 18 · Must be 18 or older');
      return;
    }

    if (!gender) {
      setError('Hitamo igitsina cyawe · Select your gender');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            date_of_birth: dob,
            gender,
            verified_adult: true,
          })
          .eq('id', user.id);
      }
      setLocation('/onboarding/occupation');
    } catch (err: any) {
      setError(err?.message || 'Habaye ikibazo cyo kubika amakuru.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Step Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#A8A49E]">
          <span className="font-semibold text-[#2563EB]">Intambwe ya 1/5</span>
          <span className="font-mono">Amakuru yawe</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-1/5 h-full bg-[#2563EB] rounded-full" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight mt-3">
          Tukumenye neza
        </h1>
        <h2 className="text-sm font-medium text-[#A8A49E] -mt-1">
          Tell us about yourself
        </h2>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-auto py-4">
        {/* Full Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            Amazina yawe yose · Full Name
          </label>
          <input
            type="text"
            placeholder="Amazina asanzwe"
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
            Itariki y'amavuko · Date of Birth
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
            Igitsina · Gender
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
              Gore · Female
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
              Gabo · Male
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
            <span>Komeza · Continue</span>
          )}
        </button>
      </div>
    </div>
  );
}
