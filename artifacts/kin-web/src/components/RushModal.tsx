import React, { useEffect, useState } from 'react';
import { Flame, X, Send, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';

interface RushPartner {
  id: string;
  age: number | null;
  campus: string;
  primaryIntent: string;
  passions: string[];
}

interface RushMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export function RushModal({
  open,
  onClose,
  token,
  currentUserId,
  onMatched,
}: {
  open: boolean;
  onClose: () => void;
  token: string | null;
  currentUserId?: string;
  onMatched: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [partner, setPartner] = useState<RushPartner | null>(null);
  const [endsAt, setEndsAt] = useState<number>(Date.now() + 180000);
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [messages, setMessages] = useState<RushMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<string>('joining');
  const [matchId, setMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    setStatus('joining');
    apiFetch('/api/rush/join', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.sessionId) {
          setSessionId(d.sessionId);
          setPartner(d.partner);
          setEndsAt(new Date(d.endsAt).getTime());
          setStatus('active');
        } else {
          setStatus('waiting');
        }
      })
      .catch(() => setStatus('waiting'));
  }, [open, token]);

  useEffect(() => {
    if (!open || status !== 'active') return;
    const id = setInterval(() => {
      const diff = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setSecondsLeft(diff);
    }, 1000);
    return () => clearInterval(id);
  }, [open, status, endsAt]);

  useEffect(() => {
    if (!open || !sessionId || !token) return;
    const poll = setInterval(() => {
      apiFetch(`/api/rush/session/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          if (Array.isArray(d.messages)) setMessages(d.messages);
          if (d.status === 'matched' && d.matchId) {
            setStatus('matched');
            setMatchId(d.matchId);
          } else if (d.status === 'passed') {
            setStatus('passed');
          }
        })
        .catch(() => {});
    }, 1500);
    return () => clearInterval(poll);
  }, [open, sessionId, token]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !token || !input.trim()) return;
    const text = input.trim();
    setInput('');
    const res = await apiFetch('/api/rush/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, text }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
    }
  }

  async function handleDecision(decision: 'reveal' | 'pass') {
    if (!sessionId || !token) return;
    const res = await apiFetch('/api/rush/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, decision }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.status === 'matched' && d.matchId) {
        setStatus('matched');
        setMatchId(d.matchId);
      } else if (decision === 'pass') {
        onClose();
      }
    }
  }

  if (!open) return null;

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161B22] border border-[#C9A84C]/40 rounded-3xl p-5 flex flex-col gap-4 max-h-[85vh]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#FF6B6B]" />
            <h3 className="font-serif text-lg font-bold text-[#F0EDE6]">{t('rush.title')}</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] text-xs font-mono font-bold">
              {mins}:{secs}
            </span>
            <button type="button" onClick={onClose} className="text-[#8B949E] cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {status === 'joining' || status === 'waiting' ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#FF6B6B] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-[#F0EDE6]">{t('rush.waitingPartner')}</span>
          </div>
        ) : status === 'matched' && matchId ? (
          <div className="py-10 flex flex-col items-center gap-4 text-center">
            <Heart className="w-12 h-12 text-[#3FB950] fill-current" />
            <p className="text-base font-bold text-[#F0EDE6]">{t('rush.itIsAMatch')}</p>
            <button
              type="button"
              onClick={() => {
                onMatched(matchId);
                onClose();
              }}
              className="px-6 py-2.5 rounded-full bg-[#3FB950] text-[#0D1117] text-sm font-bold cursor-pointer"
            >
              {t('rush.continueChat')}
            </button>
          </div>
        ) : (
          <>
            {partner && (
              <div className="p-3 rounded-2xl bg-[#1A1A2E] border border-[#21262D] flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2563EB] to-[#C9A84C] blur-[3px] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#F0EDE6]">
                    {partner.age ? `${partner.age} · ` : ''}{partner.campus}
                  </p>
                  <p className="text-[11px] text-[#C9A84C] font-semibold">{partner.primaryIntent}</p>
                  {partner.passions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {partner.passions.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#21262D] text-[#A8A49E]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-[180px] max-h-[260px] overflow-y-auto flex flex-col gap-2 p-2 bg-[#0D1117] rounded-2xl border border-[#21262D]">
              {messages.map((m) => {
                const mine = m.senderId === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${
                      mine
                        ? 'self-end bg-[#2563EB] text-white'
                        : 'self-start bg-[#1A1A2E] text-[#F0EDE6]'
                    }`}
                  >
                    {m.text}
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="..."
                className="flex-1 bg-[#1A1A2E] border border-[#21262D] rounded-xl px-3 py-2 text-xs text-[#F0EDE6] outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-[#2563EB] text-white cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDecision('pass')}
                className="py-2.5 rounded-xl bg-[#21262D] text-[#F0EDE6] text-xs font-bold cursor-pointer"
              >
                {t('rush.pass')}
              </button>
              <button
                type="button"
                onClick={() => handleDecision('reveal')}
                className="py-2.5 rounded-xl bg-[#3FB950] text-[#0D1117] text-xs font-bold cursor-pointer"
              >
                {t('rush.reveal')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
