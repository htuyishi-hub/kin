import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, Heart, Sparkles, Coffee } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function OnboardingOccupation() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [occupation, setOccupation] = useState('');
  const [intent, setIntent] = useState<'marriage' | 'long_term' | 'casual'>('marriage');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!occupation.trim()) {
      setError('Injiza ibyo ukora cyangwa umwuga wawe · Enter your occupation');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({
            faculty: occupation.trim(),
            primary_intent: intent,
          })
          .eq('id', user.id);
      }
      setLocation('/onboarding/ur');
    } catch (err: any) {
      setError(err?.message || 'Habaye ikibazo.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Step Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#A8A49E]">
          <span className="font-semibold text-[#2563EB]">Intambwe ya 2/5</span>
          <span className="font-mono">Intego & Umwuga</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-2/5 h-full bg-[#2563EB] rounded-full" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight mt-3">
          Ibyo ukora & Intego yawe
        </h1>
        <h2 className="text-sm font-medium text-[#A8A49E] -mt-1">
          Career & Relationship Intent
        </h2>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 my-auto py-4">
        {/* Occupation input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            Umwuga wawe · Career / Occupation
          </label>
          <input
            type="text"
            placeholder="Urugero: Software Engineer, Umuganga, Umunyeshuri..."
            value={occupation}
            onChange={(e) => {
              setOccupation(e.target.value);
              setError('');
            }}
            className="w-full bg-[#1A1A2E] border-1.5 border-[#21262D] rounded-xl px-4 py-3 text-[#F0EDE6] placeholder-[#4A4742] outline-none focus:border-[#2563EB] font-medium"
          />
        </div>

        {/* Intent Cards */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            Intego yawe muri Kin · Your Intent
          </label>

          {/* Option 1: Marriage */}
          <div
            onClick={() => setIntent('marriage')}
            className={`p-3.5 rounded-xl border-1.5 flex items-start gap-3 cursor-pointer transition-all ${
              intent === 'marriage'
                ? 'border-[#C9A84C] bg-[#C9A84C]/10'
                : 'border-[#21262D] bg-[#1A1A2E]/60 hover:border-[#A8A49E]/40'
            }`}
          >
            <div className={`p-2 rounded-lg ${intent === 'marriage' ? 'bg-[#C9A84C] text-[#0D1117]' : 'bg-[#242438] text-[#C9A84C]'}`}>
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[#F0EDE6]">Gushyingirwa · Serious Marriage</span>
                <span className="text-[10px] font-bold text-[#C9A84C] bg-[#C9A84C]/20 px-2 py-0.5 rounded">Tier 1</span>
              </div>
              <p className="text-xs text-[#A8A49E] mt-0.5">Niteguye kubaka urugo rugari kandi rwiza mu gihe cya vuba.</p>
            </div>
          </div>

          {/* Option 2: Long-term */}
          <div
            onClick={() => setIntent('long_term')}
            className={`p-3.5 rounded-xl border-1.5 flex items-start gap-3 cursor-pointer transition-all ${
              intent === 'long_term'
                ? 'border-[#2563EB] bg-[#2563EB]/10'
                : 'border-[#21262D] bg-[#1A1A2E]/60 hover:border-[#A8A49E]/40'
            }`}
          >
            <div className={`p-2 rounded-lg ${intent === 'long_term' ? 'bg-[#2563EB] text-[#F0EDE6]' : 'bg-[#242438] text-[#2563EB]'}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm text-[#F0EDE6]">Umubano w'Igihe Kirekire · Long-term</span>
              <p className="text-xs text-[#A8A49E] mt-0.5">Gukundana n'umuntu dushyigikirana mu buzima.</p>
            </div>
          </div>

          {/* Option 3: Casual */}
          <div
            onClick={() => setIntent('casual')}
            className={`p-3.5 rounded-xl border-1.5 flex items-start gap-3 cursor-pointer transition-all ${
              intent === 'casual'
                ? 'border-[#A8A49E] bg-white/5'
                : 'border-[#21262D] bg-[#1A1A2E]/60 hover:border-[#A8A49E]/40'
            }`}
          >
            <div className={`p-2 rounded-lg ${intent === 'casual' ? 'bg-[#A8A49E] text-[#0D1117]' : 'bg-[#242438] text-[#A8A49E]'}`}>
              <Coffee className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm text-[#F0EDE6]">Kumenyana · Casual Dating</span>
              <p className="text-xs text-[#A8A49E] mt-0.5">Kuganira no kumenyana nta gitutu.</p>
            </div>
          </div>
        </div>

        {error && <span className="text-xs text-[#FF6B6B] font-medium mt-1">{error}</span>}
      </form>

      {/* Continue Button */}
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
