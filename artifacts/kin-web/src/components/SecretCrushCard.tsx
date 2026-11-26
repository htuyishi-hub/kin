import React, { useEffect, useState, useCallback } from 'react';
import { Heart, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';

interface CrushItem {
  id: string;
  targetPhone: string;
  targetUserId: string | null;
  isMatched: boolean;
}

export function SecretCrushCard({
  token,
  onMatched,
}: {
  token: string | null;
  onMatched?: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const [crushes, setCrushes] = useState<CrushItem[]>([]);
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [inviteText, setInviteText] = useState<string | null>(null);

  const fetchCrushes = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch('/api/crush', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.crushes)) setCrushes(d.crushes);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchCrushes();
  }, [fetchCrushes]);

  async function handleAddCrush() {
    if (!token || !phone.trim()) return;
    setAdding(true);
    try {
      const res = await apiFetch('/api/crush/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetPhone: phone.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setPhone('');
        if (d.matched) {
          setMatchedName(d.partnerProfile?.firstName || 'kinn');
          if (d.matchId && onMatched) onMatched(d.matchId);
        } else if (d.inviteText) {
          setInviteText(d.inviteText);
        }
        await fetchCrushes();
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-3.5 rounded-2xl bg-[#161B22] border border-[#FF6B6B]/40 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#F0EDE6]">{t('crush.title')}</span>
        <span className="text-[11px] font-bold text-[#C9A84C]">
          {t('crush.slots', { count: crushes.length })}
        </span>
      </div>

      {matchedName && (
        <div className="p-2.5 rounded-xl bg-[#3FB950]/20 border border-[#3FB950]/50 text-xs font-bold text-[#3FB950] flex items-center gap-2">
          <Heart className="w-4 h-4 fill-current" />
          <span>{t('crush.matchedBanner')} ({matchedName})</span>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t('contacts.placeholder')}
          className="flex-1 bg-[#0D1117] border border-[#21262D] rounded-xl px-3 py-1.5 text-xs text-[#F0EDE6] outline-none"
        />
        <button
          type="button"
          onClick={handleAddCrush}
          disabled={adding || !phone.trim()}
          className="px-3 py-1.5 rounded-xl bg-[#FF6B6B] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
        >
          {t('crush.addCrush')}
        </button>
      </div>

      {crushes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {crushes.map((c) => (
            <span
              key={c.id}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                c.isMatched ? 'bg-[#3FB950]/20 text-[#3FB950]' : 'bg-[#1A1A2E] text-[#A8A49E]'
              }`}
            >
              {c.isMatched ? '💘 ' : '🔒 '}
              {c.targetPhone}
            </span>
          ))}
        </div>
      )}

      {inviteText && (
        <button
          type="button"
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, '_blank', 'noopener,noreferrer')}
          className="self-start inline-flex items-center gap-1.5 text-[11px] font-bold text-[#38BDF8] cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>{t('crush.inviteSecretly')}</span>
        </button>
      )}
    </div>
  );
}
