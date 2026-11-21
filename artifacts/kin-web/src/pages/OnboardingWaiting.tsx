import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Clock, Share2, Check, ShieldCheck, Users, Copy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function OnboardingWaiting() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const inviteUrl = `https://kin.rw/invite/${user?.id?.slice(0, 8) || 'member'}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-2 pt-4">
        <div className="w-14 h-14 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C] flex items-center justify-center text-[#C9A84C] mb-1">
          <Clock className="w-7 h-7" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight">
          The Waiting Room
        </h1>
      </div>

      {/* Card Stats */}
      <div className="flex flex-col gap-3 my-auto py-2">
        {/* Status card */}
        <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A8A49E] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#2563EB]" />
              Waitlist Position
            </span>
            <span className="text-xs font-bold text-[#F0EDE6] bg-[#242438] px-2.5 py-0.5 rounded-full font-mono">
              #42 in line
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#A8A49E] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3FB950]" />
              Trust Score
            </span>
            <span className="text-xs font-bold text-[#3FB950] font-mono">
              50 / 100
            </span>
          </div>
        </div>

        {/* Shareable Invite Link Card */}
        <div className="p-4 bg-[#1A1A2E]/70 border border-[#21262D] rounded-2xl flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            Your Invite Link
          </label>
          <div className="flex items-center gap-2 p-2.5 bg-[#0D1117] border border-[#21262D] rounded-xl">
            <span className="text-xs text-[#F0EDE6] font-mono truncate flex-1 select-all">
              {inviteUrl}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 bg-[#2563EB] text-white rounded-lg hover:bg-[#1A4DB8] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          {copied && (
            <span className="text-[11px] text-[#3FB950] font-semibold text-center mt-0.5">
              Invite link copied!
            </span>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-2.5 pb-2">
        <button
          onClick={handleCopy}
          className="w-full h-13.5 bg-[#C9A84C] text-[#0D1117] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#C9A84C]/90 active:scale-[0.98] transition-all cursor-pointer shadow-lg"
        >
          <Share2 className="w-4 h-4" />
          <span>{copied ? 'Copied' : 'Share Invite Link'}</span>
        </button>

        <button
          onClick={() => setLocation('/app')}
          className="py-2 text-xs font-medium text-[#A8A49E] hover:text-[#F0EDE6] transition-colors text-center cursor-pointer"
        >
          Preview Discovery
        </button>
      </div>
    </div>
  );
}
