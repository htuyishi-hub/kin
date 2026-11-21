import React, { useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Loader2 } from 'lucide-react';
import { isValidEmail, sendOtpForSignUp } from '@/lib/authService';

export default function EmailScreen() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const role = params.get('role') || 'student';
  const isStudent = role === 'student';

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
      const res = await sendOtpForSignUp(cleaned);
      if (!res.success) {
        setError(res.error || 'Ntibyashobotse kohereza kode. Ongera ugerageze.');
        return;
      }

      setLocation(`/otp?email=${encodeURIComponent(cleaned)}&role=${role}&mode=signup`);
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
          onClick={() => setLocation('/')}
          className="self-start py-1.5 text-sm font-medium text-[#FF6B6B] hover:opacity-80 transition-opacity cursor-pointer mb-2"
        >
          ← Inyuma · Back
        </button>

        <div className="flex items-center mb-1">
          {isStudent ? (
            <span className="bg-[#2563EB] text-[#F0EDE6] text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">
              UR STUDENT
            </span>
          ) : (
            <span className="bg-[#242438] text-[#C9A84C] text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">
              INVITE ONLY
            </span>
          )}
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight">
          {isStudent ? "Injira nk'Umunyeshuri" : 'Fungura Konti Isanzwe'}
        </h1>
        <h2 className="text-sm font-medium text-[#A8A49E] -mt-1">
          {isStudent ? 'Student Sign Up' : 'Personal Account Sign Up'}
        </h2>

        <p className="text-xs text-[#A8A49E] leading-relaxed mt-1">
          {isStudent
            ? "Koresha imeri yawe. Icyemezo cy'umunyeshuri (UR Badge) kizakorwa mu ntambwe ikurikira ukoresheje registration number yawe."
            : "Koresha imeri yawe. Kwinjira bisaba ubutumire bw'umunyamuryango (Invite code) cyangwa kwemeza n'abandi."}
        </p>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-auto py-6">
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
            <span>Ohereza kode · Send 6-Digit Code</span>
          )}
        </button>
      </form>

      {/* Footer Link */}
      <div className="flex justify-center pb-2">
        <button
          onClick={() => setLocation('/signin')}
          className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="text-[#A8A49E]">Ufite konti isanzwe?</span>
          <span className="font-semibold text-[#2563EB]">Injira · Sign in</span>
        </button>
      </div>
    </div>
  );
}
