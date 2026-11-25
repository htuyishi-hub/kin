import React, { useEffect, useState, useCallback } from 'react';
import { Trophy, Sparkles, Flame, Share2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';

interface LeaderboardEntry {
  id: string;
  rank: number | null;
  firstName: string;
  zone: string;
  popularityScore: number;
  isSpotlight: boolean;
  isVerified: boolean;
  photoUrl: string | null;
}

const ZONES = [
  { key: 'All', labelKey: 'leaderboard.allRwanda' },
  { key: 'UR_Huye', label: 'UR Huye' },
  { key: 'UR_Gikondo', label: 'UR Gikondo' },
  { key: 'Kigali', label: 'Kigali' },
];

export function TrendingView({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const [zone, setZone] = useState('All');
  const [spotlight, setSpotlight] = useState<LeaderboardEntry[]>([]);
  const [topPodium, setTopPodium] = useState<LeaderboardEntry[]>([]);
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [boosting, setBoosting] = useState(false);

  const fetchBoard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/leaderboard?zone=${encodeURIComponent(zone)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSpotlight(Array.isArray(d.spotlight) ? d.spotlight : []);
        setTopPodium(Array.isArray(d.topPodium) ? d.topPodium : []);
        setRankings(Array.isArray(d.rankings) ? d.rankings : []);
      }
    } finally {
      setLoading(false);
    }
  }, [token, zone]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  async function handleVote(targetUserId: string, voteType: 'free' | 'rose') {
    if (!token) return;
    setVotingId(targetUserId);
    try {
      const res = await apiFetch('/api/leaderboard/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId, voteType }),
      });
      if (res.ok) {
        await fetchBoard();
      }
    } finally {
      setVotingId(null);
    }
  }

  async function handleJoinSpotlight() {
    if (!token) return;
    setBoosting(true);
    try {
      const res = await apiFetch('/api/leaderboard/spotlight', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchBoard();
      }
    } finally {
      setBoosting(false);
    }
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(t('leaderboard.shareText'));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  const podiumOrder = [topPodium[1], topPodium[0], topPodium[2]].filter(Boolean) as LeaderboardEntry[];

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#C9A84C]" />
          <h2 className="font-serif text-lg font-bold text-[#F0EDE6]">{t('leaderboard.mostWanted')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="px-2.5 py-1.5 rounded-xl bg-[#3FB950]/15 border border-[#3FB950]/40 text-[#3FB950] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t('leaderboard.shareStatus')}</span>
          </button>
          <button
            type="button"
            onClick={handleJoinSpotlight}
            disabled={boosting}
            className="px-2.5 py-1.5 rounded-xl bg-[#C9A84C] text-[#0D1117] text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('leaderboard.boostSpotlight')}</span>
          </button>
        </div>
      </div>

      {/* Zone Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ZONES.map((z) => {
          const active = zone === z.key;
          return (
            <button
              key={z.key}
              type="button"
              onClick={() => setZone(z.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                active
                  ? 'bg-[#C9A84C] text-[#0D1117] border-[#C9A84C]'
                  : 'bg-[#1A1A2E] text-[#A8A49E] border-[#21262D]'
              }`}
            >
              {z.labelKey ? t(z.labelKey) : z.label}
            </button>
          );
        })}
      </div>

      {/* VIP Spotlight Carousel */}
      {spotlight.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#C9A84C]">{t('leaderboard.spotlight')}</span>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {spotlight.map((s) => (
              <div key={s.id} className="shrink-0 flex flex-col items-center gap-1">
                <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-[#C9A84C] to-[#F59E0B] shadow-lg shadow-[#C9A84C]/30">
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt={s.firstName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#161B22]" />
                  )}
                </div>
                <span className="text-[11px] font-semibold text-[#F0EDE6]">{s.firstName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="w-7 h-7 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {podiumOrder.length > 0 && (
            <div className="grid grid-cols-3 gap-2 items-end pt-2">
              {podiumOrder.map((p) => {
                const isFirst = p.rank === 1;
                const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉';
                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-2xl bg-[#1A1A2E] border flex flex-col items-center gap-1.5 ${
                      isFirst ? 'border-[#C9A84C] -mt-2 pb-3' : 'border-[#21262D]'
                    }`}
                  >
                    <span className="text-base">{medal}</span>
                    <div className={`${isFirst ? 'w-16 h-16' : 'w-12 h-12'} rounded-full overflow-hidden border-2 border-[#C9A84C]/60 bg-[#161B22]`}>
                      {p.photoUrl && <img src={p.photoUrl} alt={p.firstName} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-[#F0EDE6] truncate max-w-[70px]">{p.firstName}</span>
                      {p.isVerified && <CheckCircle2 className="w-3 h-3 text-[#38BDF8] shrink-0" />}
                    </div>
                    <span className="text-[11px] font-bold text-[#C9A84C]">
                      {p.popularityScore} {t('leaderboard.points')}
                    </span>
                    <div className="flex gap-1 w-full">
                      <button
                        type="button"
                        onClick={() => handleVote(p.id, 'free')}
                        disabled={votingId === p.id}
                        className="flex-1 py-1 rounded-lg bg-[#21262D] text-[#F0EDE6] text-[10px] font-bold cursor-pointer"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVote(p.id, 'rose')}
                        disabled={votingId === p.id}
                        className="flex-1 py-1 rounded-lg bg-[#FF6B6B]/20 border border-[#FF6B6B]/40 text-[#FF6B6B] text-[10px] font-bold cursor-pointer"
                      >
                        🌹+5
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Rankings 4-25 */}
          <div className="flex flex-col gap-2 pb-16">
            {rankings.map((r) => (
              <div key={r.id} className="p-3 rounded-2xl bg-[#1A1A2E] border border-[#21262D] flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-[#8B949E] w-5 text-center">#{r.rank}</span>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#161B22] shrink-0">
                    {r.photoUrl && <img src={r.photoUrl} alt={r.firstName} className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-[#F0EDE6] truncate">{r.firstName}</span>
                      {r.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />}
                    </div>
                    <span className="text-[11px] text-[#8B949E]">{r.zone} · {r.popularityScore} {t('leaderboard.points')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleVote(r.id, 'free')}
                    disabled={votingId === r.id}
                    className="px-2.5 py-1.5 rounded-xl bg-[#21262D] text-[#F0EDE6] text-[11px] font-bold cursor-pointer"
                  >
                    {t('leaderboard.voteFree')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVote(r.id, 'rose')}
                    disabled={votingId === r.id}
                    className="px-2.5 py-1.5 rounded-xl bg-[#FF6B6B]/20 border border-[#FF6B6B]/40 text-[#FF6B6B] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Flame className="w-3 h-3" />
                    <span>🌹 100</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
