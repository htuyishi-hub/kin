import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, KeyRound, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function OnboardingVouch() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleApplyCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = inviteCode.trim().toUpperCase();

    if (!cleanCode) {
      setError("Injiza kode y'ubutumire · Enter an invite code");
      return;
    }

    setError('');
    setIsPending(true);

    try {
      if (user?.id) {
        // Query if invite code belongs to another profile
        const { data: inviter } = await supabase
          .from('profiles')
          .select('id, invite_code')
          .eq('invite_code', cleanCode)
          .maybeSingle();

        if (inviter) {
          await supabase
            .from('profiles')
            .update({
              invited_by_profile: inviter.id,
              is_verified: true,
              account_status: 'active',
            })
            .eq('id', user.id);
        }
      }
      setLocation('/onboarding/prompts');
    } catch (err: any) {
      setError(err?.message || "Kode ntabwo yemewe cyangwa yarangiye.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Step Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#A8A49E]">
          <span className="font-semibold text-[#2563EB]">Intambwe ya 4/5</span>
          <span className="font-mono">Ubutumire</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-4/5 h-full bg-[#2563EB] rounded-full" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight mt-3">
          Ufite ubutumire?
        </h1>
        <h2 className="text-sm font-medium text-[#A8A49E] -mt-1">
          Velvet Rope · Member Invite
        </h2>
        <p className="text-xs text-[#A8A49E] leading-relaxed">
          Kin ni umuryango w'abantu bizewe. Niba ufite kode y'umunyamuryango wayiguhaye, yinjize hano winjire ako kanya.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleApplyCode} className="flex flex-col gap-4 my-auto py-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            Kode y'ubutumire · Invite Code
          </label>
          <div
            className={`flex items-center bg-[#1A1A2E] border-1.5 rounded-xl overflow-hidden transition-colors ${
              error ? 'border-[#FF6B6B]' : 'border-[#21262D] focus-within:border-[#2563EB]'
            }`}
          >
            <input
              type="text"
              placeholder="Urugero: KIN-A1B2C3"
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
              <span>Emeza Kode · Apply Code</span>
            </>
          )}
        </button>
      </form>

      {/* Waitlist option */}
      <div className="flex flex-col items-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => setLocation('/onboarding/prompts')}
          className="w-full py-3 px-4 border border-[#21262D] rounded-full text-xs font-semibold text-[#A8A49E] hover:text-[#F0EDE6] hover:border-[#A8A49E]/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Clock className="w-4 h-4 text-[#C9A84C]" />
          <span>Nta kode mfite · Continue to Waiting Room</span>
        </button>
      </div>
    </div>
  );
}
