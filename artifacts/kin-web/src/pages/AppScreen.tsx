import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  Flame,
  MessageCircle,
  Sparkles,
  User,
  Heart,
  X,
  Star,
  GraduationCap,
  ShieldCheck,
  Clock,
  LogOut,
  Send,
  Globe,
  Play,
  Pause,
  Volume2,
  Mic,
  Square,
  Trash2,
  Lock,
} from 'lucide-react';
import { useTranslation, changeLanguage, getCurrentLanguage, type SupportedLanguage } from '@workspace/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';
import { encryptMessage, decryptMessage } from '@/lib/e2eeService';
import { apiFetch } from '@/lib/api';

interface Candidate {
  id: string;
  name: string;
  age: number;
  location: string;
  occupation: string;
  isUrStudent: boolean;
  intent: string;
  trustScore: number;
  photoUrl: string;
  bio?: string | null;
  tags?: string[];
  voiceIntroPath?: string | null;
  voiceIntroDurationMs?: number | null;
}

const ALL_TAGS = [
  'faith', 'family', 'career', 'education', 'business',
  'travel', 'music', 'football', 'humor', 'kindness',
  'honesty', 'ambition', 'nature', 'cooking', 'reading',
  'art', 'fitness', 'technology', 'community', 'culture',
];

const SAMPLE_PROFILES: Candidate[] = [
  {
    id: '1',
    name: 'Keza Diane',
    age: 23,
    location: 'Kigali, Nyarugenge',
    occupation: 'Software Engineer & UR Alum',
    isUrStudent: true,
    intent: 'Serious Marriage',
    trustScore: 85,
    photoUrl: '/images/couple1.jpg',
    tags: ['technology', 'faith', 'reading'],
    bio: 'Software engineer building tools for community growth.',
    voiceIntroPath: 'https://actions.google.com/sounds/v1/speech/hello_world.ogg',
    voiceIntroDurationMs: 6000,
  },
  {
    id: '2',
    name: 'Manzi Eric',
    age: 25,
    location: 'Huye Campus',
    occupation: 'UR Medicine Student (Year 4)',
    isUrStudent: true,
    intent: 'Long-term Relationship',
    trustScore: 92,
    photoUrl: '/images/couple2.jpg',
    tags: ['education', 'fitness', 'music'],
    bio: 'Medical student passionate about healthcare and running.',
    voiceIntroPath: 'https://actions.google.com/sounds/v1/speech/hello_world.ogg',
    voiceIntroDurationMs: 8000,
  },
  {
    id: '3',
    name: 'Ineza Grace',
    age: 24,
    location: 'Kigali, Remera',
    occupation: 'Architect & Designer',
    isUrStudent: false,
    intent: 'Serious Marriage',
    trustScore: 78,
    photoUrl: '/images/couple3.jpg',
    tags: ['art', 'travel', 'cooking'],
    bio: 'Architect designing sustainable spaces across Rwanda.',
  },
];

import { KinnLogo } from '@/components/KinnLogo';

export default function AppScreen() {
  const [, setLocation] = useLocation();
  const { user, token, signOut } = useAuth();
  const { t } = useTranslation();
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(getCurrentLanguage());

  const [activeTab, setActiveTab] = useState<'discover' | 'matches' | 'serious' | 'profile'>('discover');
  const [profileIndex, setProfileIndex] = useState(0);
  const [goldenBids, setGoldenBids] = useState(3);
  const [matchAlert, setMatchAlert] = useState<string | null>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [bioText, setBioText] = useState('');
  const [isSavingExtras, setIsSavingExtras] = useState(false);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  const [extrasSuccess, setExtrasSuccess] = useState(false);

  const [voiceIntroPath, setVoiceIntroPath] = useState<string | null>(null);
  const [voiceIntroDurationMs, setVoiceIntroDurationMs] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSavingVoice, setIsSavingVoice] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const profileAudioRef = useRef<HTMLAudioElement | null>(null);

  const candidateAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingCandidateAudio, setPlayingCandidateAudio] = useState(false);

  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; senderId: string; content: string; createdAt: string }>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [realMatches, setRealMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/matches', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRealMatches(data);
        }
      })
      .catch(() => {});
  }, [token, activeTab]);

  async function handleOpenMatch(match: any) {
    setSelectedMatch(match);
    if (!token || !match.id || String(match.id).startsWith('demo-')) {
      setChatMessages([
        {
          id: '1',
          senderId: match.otherUserId || 'other',
          content: match.lastMessage || 'Muraho neza! Nshimishijwe no guhura nawe.',
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }
    try {
      const res = await apiFetch(`/api/matches/${match.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const msgs = await res.json();
        const decryptedMsgs = await Promise.all(
          msgs.map(async (m: any) => ({
            ...m,
            content: await decryptMessage(m.content, match.id),
          }))
        );
        setChatMessages(decryptedMsgs);
      }
    } catch {
      // fallback
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || !selectedMatch) return;

    setInputMessage('');
    const tempMsg = {
      id: String(Date.now()),
      senderId: user?.id || 'me',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempMsg]);

    if (!token || !selectedMatch.id || String(selectedMatch.id).startsWith('demo-')) return;

    try {
      setIsSendingMessage(true);
      const encrypted = await encryptMessage(text, selectedMatch.id);
      await apiFetch(`/api/matches/${selectedMatch.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: encrypted }),
      });
    } catch {
      // non-fatal
    } finally {
      setIsSendingMessage(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (Array.isArray(data.tags)) setSelectedTags(data.tags);
          if (typeof data.bio === 'string') setBioText(data.bio);
          if (typeof data.voiceIntroPath === 'string') setVoiceIntroPath(data.voiceIntroPath);
          if (typeof data.voiceIntroDurationMs === 'number') setVoiceIntroDurationMs(data.voiceIntroDurationMs);
        }
      })
      .catch(() => {});
  }, [token]);

  function toggleTag(tag: string) {
    setExtrasError(null);
    setExtrasSuccess(false);
    if (selectedTags.includes(tag)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag));
    } else {
      if (selectedTags.length >= 5) {
        setExtrasError(t('errors.tagsLimitExceeded'));
        return;
      }
      setSelectedTags((prev) => [...prev, tag]);
    }
  }

  async function handleSaveExtras() {
    setExtrasError(null);
    setExtrasSuccess(false);
    setIsSavingExtras(true);
    try {
      const res = await apiFetch('/api/me/profile-extras', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bio: bioText.trim() || null,
          tags: selectedTags,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {}
      if (!res.ok) {
        if (data?.code === 'BIO_CONTACT_INFO') {
          setExtrasError(t('errors.bioContactInfo'));
        } else if (data?.code === 'TOO_MANY_EDITS') {
          setExtrasError(t('errors.tooManyEdits'));
        } else if (data?.code === 'TAGS_LIMIT_EXCEEDED') {
          setExtrasError(t('errors.tagsLimitExceeded'));
        } else {
          setExtrasError(t('errors.generic'));
        }
      } else {
        setExtrasSuccess(true);
        setTimeout(() => setExtrasSuccess(false), 2000);
      }
    } catch {
      setExtrasError(t('errors.generic'));
    } finally {
      setIsSavingExtras(false);
    }
  }

  async function handleClearExtras() {
    setExtrasError(null);
    setExtrasSuccess(false);
    setBioText('');
    setSelectedTags([]);
    setIsSavingExtras(true);
    try {
      await apiFetch('/api/me/profile-extras', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bio: null,
          tags: [],
        }),
      });
      setExtrasSuccess(true);
      setTimeout(() => setExtrasSuccess(false), 2000);
    } catch {
      setExtrasError(t('errors.generic'));
    } finally {
      setIsSavingExtras(false);
    }
  }

  async function handleStartRecording() {
    setVoiceError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setVoiceError(t('errors.micPermission'));
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const durMs = Math.max(1000, recordSeconds * 1000);
        await handleSaveVoice(audioBlob, durMs);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev >= 29) {
            handleStopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setVoiceError(t('errors.micPermission'));
    }
  }

  function handleStopRecording() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  const webVoiceUrlCache = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());

  async function getWebVoiceSignedUrl(userIdOrPath: string, forceRefresh = false): Promise<string | null> {
    if (!userIdOrPath) return null;
    if (userIdOrPath.startsWith('http://') || userIdOrPath.startsWith('https://')) {
      return userIdOrPath;
    }
    const cached = webVoiceUrlCache.current.get(userIdOrPath);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    try {
      const target = userIdOrPath.includes('/') ? userIdOrPath.split('/')[1] || userIdOrPath : userIdOrPath;
      const res = await apiFetch(`/api/media/voice/${encodeURIComponent(target)}/url`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        webVoiceUrlCache.current.delete(userIdOrPath);
        return null;
      }
      const data = await res.json();
      if (data?.url) {
        webVoiceUrlCache.current.set(userIdOrPath, {
          url: data.url,
          expiresAt: Date.now() + Math.max(30, (data.expiresIn || 300) - 30) * 1000,
        });
        return data.url;
      }
    } catch (err) {
      console.warn('Failed to get voice signed URL:', err);
    }
    return null;
  }

  async function handleSaveVoice(blob: Blob, durationMs: number) {
    setIsSavingVoice(true);
    setVoiceError(null);
    try {
      // 1. Get signed upload URL from server
      const urlRes = await apiFetch('/api/media/voice/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!urlRes.ok) {
        setVoiceError(t('errors.generic'));
        return;
      }

      const { uploadUrl, path } = await urlRes.json();

      // 2. Upload audio binary directly to signed URL
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': blob.type || 'audio/m4a',
        },
        body: blob,
      });

      if (!putRes.ok) {
        setVoiceError(t('errors.generic'));
        return;
      }

      // 3. Confirm with server (server validates duration 1-20s using music-metadata)
      const confirmRes = await apiFetch('/api/media/voice/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ path }),
      });

      let data: any = null;
      try {
        data = await confirmRes.json();
      } catch {}
      if (!confirmRes.ok) {
        if (data?.code === 'VOICE_INTRO_TOO_LONG') {
          setVoiceError(t('errors.voiceTooLong'));
        } else if (data?.code === 'VOICE_INTRO_TOO_SHORT') {
          setVoiceError(t('errors.voiceTooShort'));
        } else {
          setVoiceError(t('errors.generic'));
        }
      } else {
        setVoiceIntroPath(data?.voiceIntroPath || path);
        setVoiceIntroDurationMs(data?.durationMs || durationMs);
      }
    } catch {
      setVoiceError(t('errors.generic'));
    } finally {
      setIsSavingVoice(false);
    }
  }

  async function handleDeleteVoice() {
    setVoiceError(null);
    setIsSavingVoice(true);
    try {
      const res = await apiFetch('/api/media/voice', {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        setVoiceIntroPath(null);
        setVoiceIntroDurationMs(null);
        if (profileAudioRef.current) {
          profileAudioRef.current.pause();
          setIsPlayingVoice(false);
        }
      } else {
        setVoiceError(t('errors.generic'));
      }
    } catch {
      setVoiceError(t('errors.generic'));
    } finally {
      setIsSavingVoice(false);
    }
  }

  async function toggleProfileVoicePlay() {
    if (!voiceIntroPath) return;
    if (isPlayingVoice) {
      if (profileAudioRef.current) {
        profileAudioRef.current.pause();
      }
      setIsPlayingVoice(false);
    } else {
      let playUrl = await getWebVoiceSignedUrl('me');
      if (!playUrl) {
        playUrl = voiceIntroPath.startsWith('http') ? voiceIntroPath : null;
      }
      if (!playUrl) return;

      if (!profileAudioRef.current) {
        profileAudioRef.current = new Audio(playUrl);
        profileAudioRef.current.onended = () => setIsPlayingVoice(false);
        profileAudioRef.current.onerror = async () => {
          const refreshed = await getWebVoiceSignedUrl('me', true);
          if (refreshed && profileAudioRef.current) {
            profileAudioRef.current.src = refreshed;
            profileAudioRef.current.play().catch(() => {});
          }
        };
      } else {
        profileAudioRef.current.src = playUrl;
      }
      profileAudioRef.current.play().catch(() => {});
      setIsPlayingVoice(true);
    }
  }

  async function toggleCandidateVoice(path: string) {
    if (playingCandidateAudio) {
      if (candidateAudioRef.current) {
        candidateAudioRef.current.pause();
      }
      setPlayingCandidateAudio(false);
    } else {
      let playUrl = await getWebVoiceSignedUrl(path);
      if (!playUrl) {
        playUrl = path.startsWith('http') ? path : null;
      }
      if (!playUrl) return;

      if (!candidateAudioRef.current) {
        candidateAudioRef.current = new Audio(playUrl);
        candidateAudioRef.current.onended = () => setPlayingCandidateAudio(false);
        candidateAudioRef.current.onerror = async () => {
          const refreshed = await getWebVoiceSignedUrl(path, true);
          if (refreshed && candidateAudioRef.current) {
            candidateAudioRef.current.src = refreshed;
            candidateAudioRef.current.play().catch(() => {});
          }
        };
      } else {
        candidateAudioRef.current.src = playUrl;
      }
      candidateAudioRef.current.play().catch(() => {});
      setPlayingCandidateAudio(true);
    }
  }

  const currentProfile = SAMPLE_PROFILES[profileIndex % SAMPLE_PROFILES.length];

  async function handleLanguageSelect(lang: SupportedLanguage) {
    await changeLanguage(lang);
    setCurrentLang(lang);
    try {
      localStorage.setItem('kin_language', lang);
    } catch {}
    if (user?.id) {
      try {
        const supabase = getSupabaseClient();
        await supabase.from('profiles').update({ language: lang }).eq('id', user.id);
      } catch {}
    }
  }

  function handleSwipe(action: 'pass' | 'like' | 'bid') {
    if (candidateAudioRef.current) {
      candidateAudioRef.current.pause();
    }
    setPlayingCandidateAudio(false);

    if (action === 'bid') {
      if (goldenBids <= 0) return;
      setGoldenBids((prev) => prev - 1);
      setMatchAlert(t('discover.goldenBidAlert', { name: currentProfile.name }));
    } else if (action === 'like') {
      setMatchAlert(t('discover.matchAlert', { name: currentProfile.name }));
    }

    setTimeout(() => {
      setMatchAlert(null);
      setProfileIndex((prev) => prev + 1);
    }, 1500);
  }

  async function handleSignOut() {
    await signOut();
    setLocation('/');
  }

  return (
    <div className="flex-1 flex flex-col justify-between bg-[#0D1117] text-[#F0EDE6] select-none relative overflow-hidden">
      {/* App Top Bar */}
      <div className="px-5 py-3 border-b border-[#21262D] flex items-center justify-between bg-[#0D1117]/95 z-20">
        <div className="flex items-center gap-2">
          <KinnLogo size={22} />
          <span className="font-serif text-xl font-bold text-[#F0EDE6] tracking-tight">kinn</span>
          <span className="text-[10px] font-bold text-[#C9A84C] bg-[#C9A84C]/15 border border-[#C9A84C]/30 px-2 py-0.5 rounded-full">
            RWANDA
          </span>
        </div>

        {/* Golden Bids Pill */}
        <div className="flex items-center gap-1.5 bg-[#242438] border border-[#C9A84C]/40 px-2.5 py-1 rounded-full text-xs font-semibold text-[#C9A84C]">
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>{goldenBids} {t('discover.goldenBids')}</span>
        </div>
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 flex flex-col relative overflow-y-auto">
        {/* TAB 1: DISCOVER SWIPE DECK */}
        {activeTab === 'discover' && (
          <div className="flex-1 flex flex-col px-4 py-3 justify-between relative">
            {/* Match Toast Notification */}
            {matchAlert && (
              <div className="absolute top-4 left-4 right-4 z-30 p-3 bg-[#3FB950] text-[#0D1117] rounded-xl font-bold text-center text-xs shadow-xl animate-bounce">
                🎉 {matchAlert}
              </div>
            )}

            {/* Profile Card */}
            <div className="w-full flex-1 rounded-3xl bg-[#1A1A2E] border border-[#21262D] overflow-hidden flex flex-col relative shadow-2xl">
              {/* Photo Area */}
              <div className="relative h-64 w-full bg-[#242438] overflow-hidden">
                <img
                  src={currentProfile.photoUrl}
                  alt={currentProfile.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A2E] via-transparent to-black/30" />

                {/* Badge tags */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {currentProfile.isUrStudent && (
                    <span className="bg-[#2563EB] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                      <GraduationCap className="w-3 h-3" />
                      {t('discover.urStudentBadge')}
                    </span>
                  )}
                  <span className="bg-[#0D1117]/80 backdrop-blur-sm text-[#3FB950] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#3FB950]/30">
                    <ShieldCheck className="w-3 h-3" />
                    {t('discover.trustBadge', { score: currentProfile.trustScore })}
                  </span>
                </div>

                {/* Bottom Photo Info */}
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-xl font-bold font-serif text-[#F0EDE6]">
                      {currentProfile.name}, {currentProfile.age}
                    </h2>
                    <p className="text-xs text-[#A8A49E] font-medium">{currentProfile.location}</p>
                  </div>
                </div>
              </div>

              {/* Card Details */}
              <div className="p-4 flex flex-col gap-3 flex-1 justify-between bg-[#1A1A2E]">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-[#C9A84C] font-semibold">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span>{currentProfile.intent}</span>
                  </div>
                  <p className="text-xs text-[#F0EDE6]/90 font-medium">
                    {currentProfile.occupation}
                  </p>
                  {currentProfile.tags && currentProfile.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {currentProfile.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="bg-white/10 text-white/80 text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/15"
                        >
                          {t(`tags.${tag}`, { defaultValue: tag })}
                        </span>
                      ))}
                    </div>
                  )}
                  {currentProfile.voiceIntroPath && (
                    <button
                      type="button"
                      onClick={() => toggleCandidateVoice(currentProfile.voiceIntroPath!)}
                      className="self-start flex items-center gap-1.5 bg-[#0D1117]/80 hover:bg-[#0D1117] border border-[#C9A84C]/40 px-2.5 py-1 rounded-full text-xs font-medium text-[#C9A84C] transition-colors cursor-pointer mt-1"
                    >
                      {playingCandidateAudio ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <Volume2 className="w-3.5 h-3.5 text-[#A8A49E]" />
                      <span>
                        {t('profile.voiceDuration', {
                          seconds: Math.max(1, Math.round((currentProfile.voiceIntroDurationMs || 5000) / 1000)),
                        })}
                      </span>
                    </button>
                  )}
                  {currentProfile.bio && (
                    <p className="text-xs text-[#A8A49E] line-clamp-2 mt-0.5">
                      {currentProfile.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Swipe Action Buttons */}
            <div className="flex items-center justify-center gap-6 py-3">
              {/* Pass Button */}
              <button
                onClick={() => handleSwipe('pass')}
                className="w-13 h-13 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#A8A49E] flex items-center justify-center hover:text-[#FF6B6B] hover:border-[#FF6B6B] active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Golden Bid Button */}
              <button
                onClick={() => handleSwipe('bid')}
                disabled={goldenBids <= 0}
                className="w-15 h-15 rounded-full bg-[#C9A84C] text-[#0D1117] flex items-center justify-center font-bold active:scale-95 transition-all shadow-[0_0_20px_rgba(201,168,76,0.35)] disabled:opacity-50 cursor-pointer"
                title={t('discover.goldenBids')}
              >
                <Star className="w-7 h-7 fill-current" />
              </button>

              {/* Like Button */}
              <button
                onClick={() => handleSwipe('like')}
                className="w-13 h-13 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#A8A49E] flex items-center justify-center hover:text-[#3FB950] hover:border-[#3FB950] active:scale-95 transition-all shadow-md cursor-pointer"
              >
                <Heart className="w-6 h-6 fill-current text-[#FF6B6B]" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MATCHES & 3-PHASE CHAT */}
        {activeTab === 'matches' && (
          <div className="flex-1 flex flex-col p-4 gap-3">
            {selectedMatch ? (
              /* Active Conversation View */
              <div className="flex-1 flex flex-col min-h-[460px]">
                {/* Chat Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#21262D]">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedMatch(null)}
                      className="text-sm font-medium text-[#FF6B6B] hover:opacity-80 transition-opacity cursor-pointer p-1"
                    >
                      ←
                    </button>
                    <div className="w-9 h-9 rounded-full bg-[#1A1A2E] border border-[#2563EB] overflow-hidden flex items-center justify-center">
                      {selectedMatch.otherUserPrimaryPhoto || selectedMatch.photoUrl ? (
                        <img
                          src={selectedMatch.otherUserPrimaryPhoto || selectedMatch.photoUrl}
                          alt="Match"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-[#A8A49E]" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#F0EDE6] leading-tight">
                        {selectedMatch.otherUserName || selectedMatch.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold text-[#2563EB]">
                          {t('matches.phase', { phase: selectedMatch.conversationPhase || 1 })}
                        </span>
                        <span className="text-[9px] text-[#A8A49E] flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-[#2563EB]" />
                          {t('matches.e2eeBadge')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Voice Intro Player in Chat Header */}
                  {(selectedMatch.voiceIntroPath || selectedMatch.otherUser?.voiceIntroPath) && (
                    <button
                      type="button"
                      onClick={() => toggleCandidateVoice(selectedMatch.voiceIntroPath || selectedMatch.otherUser?.voiceIntroPath)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1A1A2E] border border-[#C9A84C]/40 text-[#C9A84C] text-[11px] font-semibold hover:border-[#C9A84C] transition-colors cursor-pointer"
                    >
                      {playingCandidateAudio ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Messages List */}
                <div className="flex-1 flex flex-col gap-2.5 py-4 overflow-y-auto max-h-[380px]">
                  {chatMessages.length === 0 ? (
                    <div className="my-auto text-center py-8">
                      <p className="text-xs text-[#A8A49E]">{t('matches.waitingFirstMessage')}</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMe = msg.senderId === user?.id || msg.senderId === 'me';
                      return (
                        <div
                          key={msg.id}
                          className={`max-w-[78%] p-3 rounded-2xl text-sm leading-relaxed ${
                            isMe
                              ? 'self-end bg-[#2563EB] text-[#F0EDE6] rounded-br-xs'
                              : 'self-start bg-[#1A1A2E] border border-[#21262D] text-[#F0EDE6] rounded-bl-xs'
                          }`}
                        >
                          {msg.content}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message Input Bar */}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2 pt-2 border-t border-[#21262D]">
                  <input
                    type="text"
                    placeholder={t('matches.typeMessage')}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    className="flex-1 bg-[#1A1A2E] border border-[#21262D] focus:border-[#2563EB] rounded-full px-4 py-2.5 text-sm text-[#F0EDE6] placeholder-[#4A4742] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSendingMessage || !inputMessage.trim()}
                    className="w-10 h-10 rounded-full bg-[#2563EB] text-[#F0EDE6] flex items-center justify-center hover:bg-[#1A4DB8] transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : (
              /* Match List */
              <>
                <h2 className="font-serif text-lg font-bold text-[#F0EDE6]">
                  {t('matches.guidedChatTitle')}
                </h2>

                {(realMatches.length > 0 ? realMatches : [
                  {
                    id: 'demo-1',
                    otherUserName: 'Keza Diane',
                    otherUserAge: 23,
                    conversationPhase: 1,
                    lastMessage: 'Muraho neza! Nshimishijwe no...',
                    expiresAt: new Date(Date.now() + 71 * 3600000).toISOString(),
                    photoUrl: '/images/couple1.jpg',
                    voiceIntroPath: 'https://actions.google.com/sounds/v1/speech/hello_world.ogg',
                  },
                  {
                    id: 'demo-2',
                    otherUserName: 'Manzi Eric',
                    otherUserAge: 25,
                    conversationPhase: 2,
                    lastMessage: 'Golden Bid Accepted! Mwatangiye...',
                    expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
                    photoUrl: '/images/couple2.jpg',
                    voiceIntroPath: 'https://actions.google.com/sounds/v1/speech/hello_world.ogg',
                  },
                ]).map((matchItem: any) => {
                  const hoursLeft = Math.max(0, Math.round((new Date(matchItem.expiresAt).getTime() - Date.now()) / 3600000));
                  return (
                    <div
                      key={matchItem.id}
                      onClick={() => handleOpenMatch(matchItem)}
                      className="p-3.5 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center gap-3.5 hover:border-[#2563EB]/50 transition-colors cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-[#242438] border border-[#2563EB] flex items-center justify-center shrink-0">
                        {matchItem.otherUserPrimaryPhoto || matchItem.photoUrl ? (
                          <img
                            src={matchItem.otherUserPrimaryPhoto || matchItem.photoUrl}
                            alt="Match"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6 text-[#A8A49E]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-[#F0EDE6] truncate">
                            {matchItem.otherUserName || matchItem.name}
                            {matchItem.otherUserAge ? `, ${matchItem.otherUserAge}` : ''}
                          </h3>
                          <span className="text-[10px] text-[#A8A49E] shrink-0 font-mono">
                            {t('matches.hoursLeft', { count: hoursLeft })}
                          </span>
                        </div>
                        <p className="text-xs text-[#A8A49E] truncate mt-0.5">
                          {matchItem.lastMessage || '...'}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] font-bold bg-[#2563EB]/20 text-[#2563EB] px-2 py-0.5 rounded">
                            {t('matches.phase', { phase: matchItem.conversationPhase || 1 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* TAB 3: SERIOUS INTENT QUEUE */}
        {activeTab === 'serious' && (
          <div className="flex-1 flex flex-col p-5 gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#C9A84C]" />
              <h2 className="font-serif text-lg font-bold text-[#F0EDE6]">
                {t('serious.queueTitle')}
              </h2>
            </div>
            <p className="text-xs text-[#A8A49E] leading-relaxed">
              {t('serious.description')}
            </p>

            <div className="p-4 bg-[#1A1A2E] border border-[#C9A84C]/30 rounded-2xl flex flex-col gap-3 mt-2">
              <span className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">
                {t('serious.connectionTokens')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold text-[#F0EDE6]">3</span>
                <span className="text-xs text-[#A8A49E]">{t('serious.tokensRemaining')}</span>
              </div>
              <p className="text-[11px] text-[#A8A49E]">
                {t('serious.tokenExplainer')}
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE & SETTINGS */}
        {activeTab === 'profile' && (
          <div className="flex-1 flex flex-col p-5 gap-4 justify-between">
            <div className="flex flex-col gap-4">
              <h2 className="font-serif text-lg font-bold text-[#F0EDE6]">
                {t('profile.myProfile')}
              </h2>

              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-full bg-[#2563EB]/20 border border-[#2563EB] flex items-center justify-center text-[#2563EB] text-xl font-bold font-serif">
                  {user?.email?.charAt(0).toUpperCase() || 'K'}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#F0EDE6] truncate max-w-[200px]">
                    {user?.email || 'kin.user@gmail.com'}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="bg-[#3FB950]/20 text-[#3FB950] text-[10px] font-bold px-2 py-0.5 rounded">
                      {t('profile.trustScore', { score: 50 })}
                    </span>
                    <span className="bg-[#2563EB]/20 text-[#2563EB] text-[10px] font-bold px-2 py-0.5 rounded">
                      {t('profile.urBadge')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#F0EDE6]">{t('profile.tagsTitle')}</span>
                  <span className="text-xs text-[#A8A49E]">{selectedTags.length}/5</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#2563EB] border-[#2563EB] text-white'
                            : 'bg-[#0D1117] border-[#21262D] text-[#A8A49E] hover:text-[#F0EDE6]'
                        }`}
                      >
                        {t(`tags.${tag}`, { defaultValue: tag })}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bio Section */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#F0EDE6]">{t('profile.bioTitle')}</span>
                  <span className="text-xs text-[#A8A49E]">{bioText.length}/140</span>
                </div>
                <textarea
                  value={bioText}
                  onChange={(e) => {
                    setBioText(e.target.value);
                    setExtrasError(null);
                    setExtrasSuccess(false);
                  }}
                  placeholder={t('profile.bioPlaceholder')}
                  maxLength={140}
                  rows={3}
                  className="w-full bg-[#0D1117] border border-[#21262D] rounded-xl p-3 text-xs text-[#F0EDE6] placeholder-[#8B949E] resize-none focus:outline-none focus:border-[#2563EB]"
                />

                {extrasError && (
                  <p className="text-xs text-[#FF6B6B]">{extrasError}</p>
                )}

                {extrasSuccess && (
                  <p className="text-xs text-[#3FB950]">{t('profile.saved')}</p>
                )}

                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleSaveExtras}
                    disabled={isSavingExtras}
                    className="flex-1 py-2 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearExtras}
                    disabled={isSavingExtras}
                    className="py-2 px-4 bg-[#0D1117] border border-[#21262D] text-[#A8A49E] hover:text-[#F0EDE6] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {t('profile.clearExtras')}
                  </button>
                </div>
              </div>

              {/* Voice Intro Section */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#F0EDE6]">{t('profile.voiceIntroTitle')}</span>
                  <span className="text-xs text-[#A8A49E]">{t('profile.voiceLimit')}</span>
                </div>

                {voiceIntroPath ? (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={toggleProfileVoicePlay}
                      disabled={isSavingVoice}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isPlayingVoice ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                      <span>{isPlayingVoice ? t('profile.pauseVoice') : t('profile.playVoice')}</span>
                    </button>
                    <span className="bg-[#0D1117] border border-[#21262D] px-3 py-2 rounded-xl text-xs font-semibold text-[#C9A84C]">
                      {t('profile.voiceDuration', {
                        seconds: Math.max(1, Math.round((voiceIntroDurationMs || 5000) / 1000)),
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={handleDeleteVoice}
                      disabled={isSavingVoice}
                      className="p-2 bg-[#0D1117] border border-[#FF6B6B]/40 hover:bg-[#FF6B6B]/10 text-[#FF6B6B] rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 mt-1">
                    {isRecording ? (
                      <div className="flex items-center justify-between bg-[#0D1117] border border-[#FF6B6B]/40 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B] animate-pulse" />
                          <span className="text-xs font-medium text-[#F0EDE6]">{recordSeconds}s / 30s</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleStopRecording}
                          disabled={isSavingVoice}
                          className="flex items-center gap-1.5 py-1.5 px-3 bg-[#FF6B6B] hover:bg-[#FF5252] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>{t('profile.stopRecording')}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        disabled={isSavingVoice}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0D1117] hover:bg-[#161B22] border border-[#21262D] text-[#F0EDE6] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        <span>{t('profile.recordVoice')}</span>
                      </button>
                    )}
                  </div>
                )}

                {voiceError && (
                  <p className="text-xs text-[#FF6B6B]">{voiceError}</p>
                )}
              </div>

              {/* Language Setting Row */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-[#A8A49E]" />
                  <span className="text-sm font-medium text-[#F0EDE6]">{t('profile.language')}</span>
                </div>
                <div className="flex items-center bg-[#0D1117] border border-[#21262D] rounded-full p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => handleLanguageSelect('en')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      currentLang === 'en'
                        ? 'bg-[#2563EB] text-[#F0EDE6]'
                        : 'text-[#8B949E] hover:text-[#F0EDE6]'
                    }`}
                  >
                    {t('profile.languageEn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageSelect('rw')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      currentLang === 'rw'
                        ? 'bg-[#2563EB] text-[#F0EDE6]'
                        : 'text-[#8B949E] hover:text-[#F0EDE6]'
                    }`}
                  >
                    {t('profile.languageRw')}
                  </button>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="w-full py-3.5 px-4 bg-[#E5534B]/15 border border-[#FF6B6B] rounded-full text-xs font-bold text-[#FF6B6B] flex items-center justify-center gap-2 hover:bg-[#E5534B]/25 transition-colors cursor-pointer mb-2"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('profile.signOut')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="h-16 px-6 bg-[#0D1117] border-t border-[#21262D] flex items-center justify-around z-20">
        <button
          onClick={() => setActiveTab('discover')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'discover' ? 'text-[#2563EB]' : 'text-[#A8A49E]'
          }`}
        >
          <Flame className="w-5 h-5" />
          <span>{t('discover.tabTitle')}</span>
        </button>

        <button
          onClick={() => setActiveTab('matches')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'matches' ? 'text-[#2563EB]' : 'text-[#A8A49E]'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          <span>{t('matches.tabTitle')}</span>
        </button>

        <button
          onClick={() => setActiveTab('serious')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'serious' ? 'text-[#C9A84C]' : 'text-[#A8A49E]'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>{t('serious.tabTitle')}</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'text-[#2563EB]' : 'text-[#A8A49E]'
          }`}
        >
          <User className="w-5 h-5" />
          <span>{t('profile.tabTitle')}</span>
        </button>
      </div>
    </div>
  );
}
