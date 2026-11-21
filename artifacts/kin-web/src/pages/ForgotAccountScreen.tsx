import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { isValidEmail, sendOtpForRecovery } from '@/lib/authService';

export default function ForgotAccountScreen() {
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = email.trim().toLowerCase();

    if (!cleaned) {
      setError('Injiza imeri yawe · Enter your email');
      return;
    }

    if (!isValidEmail(cleaned)) {
      setError('Injiza imeri ifite ireme (urugero: izina@gmail.com) · Invalid email format');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const res = await sendOtpForRecovery(cleaned);
      if (!res.success) {
        setError(res.error || 'Ntibyashobotse kohereza kode yo kugarura konti.');
        return;
      }

      setLocation(`/otp?email=${encodeURIComponent(cleaned)}&mode=recovery`);
    } catch (err: any) {
      setError(err?.message || 'Habaye ikibazo. Ongera ugerageze.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setLocation('/signin')}
          className="self-start py-1.5 text-sm font-medium text-[#FF6B6B] hover:opacity-80 transition-opacity cursor-pointer mb-2"
        >
          ← Inyuma · Back
        </button>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight">
          Kugarura Konti
        </h1>
        <h2 className="text-sm font-medium text-[#A8A49E] -mt-1">
          Recover Your Account
        </h2>

        <p className="text-xs text-[#A8A49E] leading-relaxed mt-1">
          Injiza imeri wakoresheje ufungura konti kugira ngo tukoherereze kode y'imibare 6 yo kugarura konti yawe.
        </p>
      </div>

      {/* Form Area */}
      <form onSubmit={handleRecoverySubmit} className="flex flex-col gap-4 my-auto py-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            Imeri yawe · Email Address
          </label>
          <div
            className={`flex items-center bg-[#1A1A2E] border-1.5 rounded-xl overflow-hidden transition-colors ${
              error ? 'border-[#FF6B6B]' : 'border-[#21262D] focus-within:border-[#2563EB]'
            }`}
          >
            <input
              type="email"
              placeholder="izina@gmail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              autoFocus
              className="w-full bg-transparent px-4 py-3.5 text-base text-[#F0EDE6] placeholder-[#4A4742] outline-none font-medium"
            />
          </div>
          {error && <span className="text-xs text-[#FF6B6B] mt-1 font-medium">{error}</span>}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-13.5 bg-[#2563EB] text-[#F0EDE6] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#1A4DB8] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-lg mt-2"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <span>Ohereza kode yo kugarura · Send Recovery Code</span>
          )}
        </button>
      </form>

      {/* Footer Link */}
      <div className="flex justify-center pb-2">
        <button
          onClick={() => setLocation('/signin')}
          className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="text-[#A8A49E]">Wibutse amakuru yawe?</span>
          <span className="font-semibold text-[#2563EB]">Injira · Sign in</span>
        </button>
      </div>
    </div>
  );
}
