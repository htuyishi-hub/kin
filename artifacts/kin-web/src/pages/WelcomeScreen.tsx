import React from 'react';
import { useLocation } from 'wouter';

export default function WelcomeScreen() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-8 relative bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Background Radial Ambient Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle 280px at 50% 40%, rgba(37,99,235,0.18) 0%, rgba(201,168,76,0.08) 50%, transparent 80%)',
        }}
      />

      {/* Kin Wordmark Brand */}
      <div className="pt-8 flex flex-col items-center relative z-10">
        <span className="font-serif text-3xl font-bold tracking-tight text-[#F0EDE6]">
          Kin
        </span>
        <span className="text-[10px] tracking-[0.25em] uppercase text-[#C9A84C] font-semibold mt-1">
          Rwanda's Trusted Network
        </span>
      </div>

      {/* Central Tagline */}
      <div className="flex flex-col items-center text-center px-4 my-auto relative z-10 gap-2">
        <h1 className="font-serif text-3xl font-bold text-[#F0EDE6] leading-snug">
          The person you will marry <br />
          <span className="italic text-[#C9A84C]">is here.</span>
        </h1>
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex flex-col items-center gap-3 w-full relative z-10 pb-4">
        {/* Button 1: University Student Sign Up */}
        <button
          onClick={() => setLocation('/signup?role=student')}
          className="w-full h-14 bg-[#F0EDE6] text-[#0D1117] rounded-full flex items-center justify-center gap-2.5 font-semibold text-[15px] hover:bg-white active:scale-[0.98] transition-all shadow-md cursor-pointer"
        >
          <span className="bg-[#2563EB] text-[#F0EDE6] text-[10px] font-bold px-2 py-0.5 rounded tracking-wider">
            UR
          </span>
          <span>Student Sign Up</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full px-2 my-1">
          <div className="flex-1 h-px bg-[#21262D]" />
          <span className="text-xs text-[#A8A49E] font-medium">or</span>
          <div className="flex-1 h-px bg-[#21262D]" />
        </div>

        {/* Button 2: Personal Account */}
        <button
          onClick={() => setLocation('/signup?role=personal')}
          className="w-full h-13.5 border-1.5 border-[#21262D] bg-[#1A1A2E]/50 text-[#F0EDE6] rounded-full flex items-center justify-center gap-2.5 font-semibold text-sm hover:border-[#A8A49E]/40 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="bg-[#242438] text-[#C9A84C] text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider">
            INVITE
          </span>
          <span>Personal Account</span>
        </button>

        {/* Sign In Link */}
        <button
          onClick={() => setLocation('/signin')}
          className="flex items-center gap-1.5 py-2 mt-1 text-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="text-[#A8A49E]">Already have an account?</span>
          <span className="font-semibold text-[#2563EB]">Sign in</span>
        </button>
      </div>
    </div>
  );
}
