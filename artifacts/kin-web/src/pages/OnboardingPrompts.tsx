import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, MessageSquareHeart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchProfileRouting } from '@/lib/authService';

const PROMPTS = [
  {
    key: 'values_guide',
    question: 'Ni ikihe gitekerezo cyagufasha kubana neza n\'abandi?',
    questionEn: 'What values guide how you treat people?',
  },
  {
    key: 'free_time',
    question: 'Wikend y\'amahoro uyimara gute?',
    questionEn: 'How do you spend a peaceful weekend?',
  },
  {
    key: 'partner_words',
    question: 'Sobanura inshuti y\'ubuzima bwawe mu magambo atatu.',
    questionEn: 'In three words, describe your ideal life partner.',
  },
];

export default function OnboardingPrompts() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [answers, setAnswers] = useState<Record<string, string>>({
    values_guide: '',
    free_time: '',
    partner_words: '',
  });
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault();
    if (!answers.values_guide.trim() || !answers.free_time.trim() || !answers.partner_words.trim()) {
      setError('Subiza ibibazo byose uko ari 3 mbere yo gukomeza · Please answer all 3 prompts');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      if (user?.id) {
        await supabase
          .from('profiles')
          .update({
            onboarding_complete: true,
          })
          .eq('id', user.id);

        const routing = await fetchProfileRouting(user.id);
        if (routing.isVerified || routing.institutionVerified || routing.accountStatus === 'active') {
          setLocation('/app');
        } else {
          setLocation('/onboarding/waiting');
        }
      } else {
        setLocation('/app');
      }
    } catch (err: any) {
      setError(err?.message || 'Habaye ikibazo.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none overflow-y-auto">
      {/* Step Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#A8A49E]">
          <span className="font-semibold text-[#2563EB]">Intambwe ya 5/5</span>
          <span className="font-mono">Ibibazo by'ingenzi</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-full h-full bg-[#2563EB] rounded-full" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight mt-3">
          Ibibazo by'Umutima
        </h1>
        <h2 className="text-sm font-medium text-[#A8A49E] -mt-1">
          Profile Prompts · Max 160 chars
        </h2>
      </div>

      {/* Prompts Form */}
      <form onSubmit={handleFinish} className="flex flex-col gap-4 my-4">
        {PROMPTS.map((p, idx) => (
          <div key={p.key} className="flex flex-col gap-1.5 p-3.5 bg-[#1A1A2E]/70 border border-[#21262D] rounded-xl">
            <div className="flex items-start gap-2">
              <MessageSquareHeart className="w-4 h-4 text-[#FF6B6B] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-[#F0EDE6]">{p.question}</p>
                <p className="text-[11px] text-[#A8A49E]">{p.questionEn}</p>
              </div>
            </div>

            <textarea
              rows={2}
              maxLength={160}
              placeholder="Andika igisubizo cyawe..."
              value={answers[p.key]}
              onChange={(e) => {
                setAnswers({ ...answers, [p.key]: e.target.value });
                setError('');
              }}
              className="w-full bg-[#0D1117] border border-[#21262D] rounded-lg p-2.5 text-xs text-[#F0EDE6] placeholder-[#4A4742] outline-none focus:border-[#2563EB] resize-none mt-1 font-medium"
            />
            <span className="self-end text-[10px] text-[#A8A49E]/70">
              {answers[p.key].length}/160
            </span>
          </div>
        ))}

        {error && <span className="text-xs text-[#FF6B6B] font-medium">{error}</span>}
      </form>

      {/* Complete Button */}
      <div className="pb-2">
        <button
          onClick={handleFinish}
          disabled={isPending}
          className="w-full h-13.5 bg-[#3FB950] text-[#0D1117] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#3FB950]/90 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-lg"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#0D1117]" />
          ) : (
            <span>Rangiza Onboarding · Complete Profile</span>
          )}
        </button>
      </div>
    </div>
  );
}
