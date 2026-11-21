import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Clock, Share2, Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

export default function OnboardingWaiting() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
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
          {t('waiting.title')}
        </h1>
      </div>

      {/* Card Stats */}
      <div className="flex flex-col gap-3 my-auto py-2">
        {/* Shareable Invite Link Card */}
        <div className="p-4 bg-[#1A1A2E]/70 border border-[#21262D] rounded-2xl flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('waiting.inviteLinkTitle')}
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
              {t('waiting.copied')}
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
          <span>{copied ? t('waiting.copied') : t('waiting.share')}</span>
        </button>

        <button
          onClick={() => setLocation('/app')}
          className="py-2 text-xs font-medium text-[#A8A49E] hover:text-[#F0EDE6] transition-colors text-center cursor-pointer"
        >
          {t('waiting.previewDiscovery')}
        </button>
      </div>
    </div>
  );
}
