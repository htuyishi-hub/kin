import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Shield,
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
  Check,
  CheckCheck,
  CheckCircle2,
  AlertCircle,
  ArrowDown,
  Loader2,
  Reply,
  Edit2,
  Flag,
  Plus,
  MoreHorizontal,
  EyeOff,
  Camera,
  Users,
  RotateCcw,
  Info,
  BadgeCheck,
  MapPin,
  Briefcase,
  Share2,
  Gift,
  Dices,
  Lock,
} from 'lucide-react';
import { useTranslation, changeLanguage, getCurrentLanguage, type SupportedLanguage } from '@workspace/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';
import { encryptMessage, decryptMessage } from '@/lib/e2eeService';
import { apiFetch, API_BASE } from '@/lib/api';
import { TrendingView } from '@/components/TrendingView';
import { RushModal } from '@/components/RushModal';
import { Trophy } from 'lucide-react';

function getIntentBadgeLabel(intent: string | null | undefined, t: (k: string) => string): string {
  const val = (intent || '').toLowerCase();
  if (val.includes('marriage')) return t('intent.marriage');
  if (val.includes('casual')) return t('intent.casual');
  return t('intent.serious');
}

function getDateKey(isoDateStr: string): string {
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDivider(isoDateStr: string, t: (key: string) => string): string {
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const dateKey = getDateKey(isoDateStr);
  if (dateKey === todayKey) return t('matches.today');
  if (dateKey === yesterdayKey) return t('matches.yesterday');

  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatMessageTime(isoDateStr: string): string {
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Candidate {
  id: string;
  name: string;
  age: number;
  location: string;
  occupation: string;
  isUrStudent: boolean;
  isVerified?: boolean;
  intent: string;
  trustScore: number;
  photoUrl: string;
  photos: string[];
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
    isVerified: true,
    intent: 'Serious Marriage',
    trustScore: 85,
    photoUrl: '/images/couple1.jpg',
    photos: ['/images/couple1.jpg', '/images/couple2.jpg', '/images/couple3.jpg'],
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
    isVerified: true,
    intent: 'Long-term Relationship',
    trustScore: 92,
    photoUrl: '/images/couple2.jpg',
    photos: ['/images/couple2.jpg', '/images/couple3.jpg'],
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
    isVerified: true,
    intent: 'Serious Marriage',
    trustScore: 78,
    photoUrl: '/images/couple3.jpg',
    photos: ['/images/couple3.jpg', '/images/couple1.jpg'],
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

  const [activeTab, setActiveTab] = useState<'discover' | 'admirers' | 'trending' | 'matches' | 'serious' | 'profile'>('discover');
  const [rushModalOpen, setRushModalOpen] = useState(false);
  const [admirers, setAdmirers] = useState<any[]>([]);
  const [admirersCount, setAdmirersCount] = useState(0);
  const [isAdmirersUnblurred, setIsAdmirersUnblurred] = useState(false);
  const [isUnblurringAdmirers, setIsUnblurringAdmirers] = useState(false);
  const [matchingAdmirerId, setMatchingAdmirerId] = useState<string | null>(null);
  const [deckProfiles, setDeckProfiles] = useState<Candidate[]>(SAMPLE_PROFILES);
  const [profileIndex, setProfileIndex] = useState(0);
  const [cardPhotoIndex, setCardPhotoIndex] = useState(0);
  const [showProfileDetail, setShowProfileDetail] = useState(false);
  const [swipeHistory, setSwipeHistory] = useState<Array<{ index: number; candidateId: string }>>([]);
  const [swipesRemaining, setSwipesRemaining] = useState<number>(25);
  const [outOfSwipesOpen, setOutOfSwipesOpen] = useState(false);
  const [myInviteCode, setMyInviteCode] = useState<string>('KINN');
  const [claimingBonus, setClaimingBonus] = useState(false);
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

  type WebChatMessage = {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
    status?: 'sending' | 'sent' | 'failed';
    localPlaintext?: string;
    mediaType?: 'text' | 'voice' | 'gift' | 'game_prompt' | 'date_invite';
    mediaUrl?: string | null;
    reactions?: Record<string, string[]>;
    gameData?: { question: string; answers: Record<string, string> } | null;
    replyToId?: string | null;
    replyTo?: { id: string; senderId: string; content: string } | null;
    editedAt?: string | null;
    deletedAt?: string | null;
    deliveredAt?: string | null;
    readAt?: string | null;
  };

  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<WebChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isCompletingPhase, setIsCompletingPhase] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showNewMessagesPill, setShowNewMessagesPill] = useState(false);
  const [wsConnected, setWsConnected] = useState(true);
  const [realMatches, setRealMatches] = useState<any[]>([]);

  // Part 2 state: replies, edits, reports, typing, read receipts
  const [replyingToMessage, setReplyingToMessage] = useState<WebChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<WebChatMessage | null>(null);
  const [reportingMatch, setReportingMatch] = useState<{ reportedUserId: string; matchId: string } | null>(null);
  const [reportReason, setReportReason] = useState<string>('harassment');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [readReceiptsEnabled, setReadReceiptsEnabled] = useState(false);
  const [hideFromPeople, setHideFromPeople] = useState(false);

  // Chat Playground state: gifts, question game, read peek, voice notes
  const [giftTrayOpen, setGiftTrayOpen] = useState(false);
  const [activeGiftOverlay, setActiveGiftOverlay] = useState<string | null>(null);
  const [gameAnswersDraft, setGameAnswersDraft] = useState<Record<string, string>>({});
  const [unlockedReadTimes, setUnlockedReadTimes] = useState<Record<string, string | null>>({});
  const [chatRecording, setChatRecording] = useState(false);
  const [playingChatVoiceId, setPlayingChatVoiceId] = useState<string | null>(null);
  const chatMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatAudioChunksRef = useRef<Blob[]>([]);
  const chatVoiceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Milestones 2-6 state: search reveal, photo compliments, selfie verify, incognito, date spots, PWA install
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchCount, setSearchCount] = useState(0);
  const [searchesUnmasked, setSearchesUnmasked] = useState(false);
  const [revealedSearchers, setRevealedSearchers] = useState<any[]>([]);
  const [complimentModalOpen, setComplimentModalOpen] = useState(false);
  const [complimentText, setComplimentText] = useState('');
  const [complimentSentToast, setComplimentSentToast] = useState(false);
  const [isSelfieVerified, setIsSelfieVerified] = useState(false);
  const [selfieModalOpen, setSelfieModalOpen] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [dateSpots, setDateSpots] = useState<Array<{ id: string; name: string; area: string; emoji: string }>>([]);
  const [dateTimeText, setDateTimeText] = useState('Saturday 4:00 PM');
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(null);
  const [showIosPwaModal, setShowIosPwaModal] = useState(false);

  // Discover Part B state: People list
  type WebPersonItem = {
    id: string;
    firstName: string;
    age?: number | null;
    campusName?: string | null;
    faculty?: string | null;
    city?: string | null;
    district?: string | null;
    bio?: string | null;
    tags: string[];
    photoUrl?: string | null;
    isVerified: boolean;
    hasInterested: boolean;
  };

  const [people, setPeople] = useState<WebPersonItem[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [peopleOffset, setPeopleOffset] = useState<number | null>(0);
  const [hasMorePeople, setHasMorePeople] = useState(true);
  const [dailyPeopleLimitReached, setDailyPeopleLimitReached] = useState(false);
  const [approachingPeopleIds, setApproachingPeopleIds] = useState<Set<string>>(new Set());

  // Discover Part A state: Posts feed
  type WebPostItem = {
    id: string;
    authorId: string;
    firstName: string;
    age?: number | null;
    location?: string | null;
    isVerified: boolean;
    text: string;
    photoUrls: string[];
    createdAt: string;
    isLiked: boolean;
    isOwn: boolean;
    likeCount?: number | null;
  };

  const isFeedEnabled =
    import.meta.env.VITE_FEED_ENABLED === 'true' ||
    import.meta.env.FEED_ENABLED === 'true';
  const isPeopleEnabled =
    import.meta.env.VITE_PEOPLE_ENABLED === 'true' ||
    import.meta.env.PEOPLE_ENABLED === 'true';
  const isRequestsEnabled =
    import.meta.env.VITE_REQUESTS_ENABLED === 'true' ||
    import.meta.env.REQUESTS_ENABLED === 'true';

  // Discover Part C state: Wants to talk requests
  type WebTalkRequestItem = {
    id: string;
    senderId: string;
    firstName: string;
    age?: number | null;
    campusName?: string | null;
    faculty?: string | null;
    city?: string | null;
    district?: string | null;
    bio?: string | null;
    tags: string[];
    photoUrl?: string | null;
    isVerified: boolean;
    createdAt: string;
  };

  const [pendingRequests, setPendingRequests] = useState<WebTalkRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isAcceptingRequest, setIsAcceptingRequest] = useState(false);
  const [isDecliningRequest, setIsDecliningRequest] = useState(false);
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());

  const [discoverSegment, setDiscoverSegment] = useState<'deck' | 'posts' | 'people'>('deck');
  const [posts, setPosts] = useState<WebPostItem[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [, setPostsCursor] = useState<string | null>(null);
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  const [createPostText, setCreatePostText] = useState('');
  const [createPostPhotos, setCreatePostPhotos] = useState<File[]>([]);
  const [createPostPhotoPreviews, setCreatePostPhotoPreviews] = useState<string[]>([]);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [createPostError, setCreatePostError] = useState<string | null>(null);
  const [postActionTarget, setPostActionTarget] = useState<WebPostItem | null>(null);
  const [postReportOpen, setPostReportOpen] = useState(false);
  const [postReportReason, setPostReportReason] = useState('post');
  const [isSubmittingPostReport, setIsSubmittingPostReport] = useState(false);

  function formatWebRelativeTime(isoDateStr: string): string {
    const d = new Date(isoDateStr);
    const now = Date.now();
    const diffSec = Math.floor((now - d.getTime()) / 1000);
    if (diffSec < 60) return 'now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  }

  const fetchWebPosts = useCallback(async (cursor?: string | null) => {
    setIsLoadingPosts(true);
    try {
      const url = cursor ? `/api/posts?limit=10&cursor=${encodeURIComponent(cursor)}` : '/api/posts?limit=10';
      const res = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        if (!cursor) {
          setPosts(data.posts ?? []);
        } else {
          setPosts((prev) => [...prev, ...(data.posts ?? [])]);
        }
        setPostsCursor(data.nextCursor ?? null);
      }
    } catch {
      // non-fatal
    } finally {
      setIsLoadingPosts(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'discover' && discoverSegment === 'posts') {
      fetchWebPosts();
    }
  }, [activeTab, discoverSegment, fetchWebPosts]);

  const fetchWebPeople = useCallback(async (offset = 0) => {
    if (!token) return;
    try {
      setIsLoadingPeople(true);
      const res = await apiFetch(`/api/people?limit=10&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const incoming: WebPersonItem[] = data.people ?? [];
        if (offset === 0) {
          setPeople(incoming);
        } else {
          setPeople((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...incoming.filter((p) => !seen.has(p.id))];
          });
        }
        setPeopleOffset(data.nextOffset ?? null);
        setHasMorePeople(Boolean(data.hasMore));
        setDailyPeopleLimitReached(Boolean(data.dailyLimitReached));
      }
    } catch {
      // non-fatal
    } finally {
      setIsLoadingPeople(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'discover' && discoverSegment === 'people') {
      fetchWebPeople(0);
    }
  }, [activeTab, discoverSegment, fetchWebPeople]);

  const handleWebApproach = async (person: WebPersonItem) => {
    if (!token || person.hasInterested || approachingPeopleIds.has(person.id)) return;
    setApproachingPeopleIds((prev) => new Set(prev).add(person.id));
    try {
      const res = await apiFetch('/api/interests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ toUserId: person.id }),
      });
      if (res.status === 429) {
        alert(t('errors.interestDailyLimit'));
        return;
      }
      if (res.ok) {
        setPeople((prev) =>
          prev.map((p) => (p.id === person.id ? { ...p, hasInterested: true } : p))
        );
      }
    } catch {
      alert(t('errors.generic'));
    } finally {
      setApproachingPeopleIds((prev) => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
    }
  };

  const fetchWebPendingRequests = useCallback(async () => {
    if (!token || !isRequestsEnabled) return;
    try {
      setIsLoadingRequests(true);
      const res = await apiFetch('/api/requests/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setIsLoadingRequests(false);
    }
  }, [token, isRequestsEnabled]);

  useEffect(() => {
    if (activeTab === 'discover' && discoverSegment === 'deck') {
      fetchWebPendingRequests();
    }
  }, [activeTab, discoverSegment, fetchWebPendingRequests]);

  const handleAcceptTalkRequest = async (requestId: string) => {
    if (!token || isAcceptingRequest) return;
    setIsAcceptingRequest(true);
    const req = pendingRequests.find((r) => r.id === requestId);
    try {
      const res = await apiFetch(`/api/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        setMatchAlert(req?.firstName ? t('discover.matchAlert', { name: req.firstName }) : t('matches.newMatchTitle'));
        setTimeout(() => setMatchAlert(null), 4000);
        apiFetch('/api/matches', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json() : []))
          .then((data) => {
            if (Array.isArray(data)) setRealMatches(data);
          })
          .catch(() => {});
      }
    } catch {
      alert(t('errors.generic'));
    } finally {
      setIsAcceptingRequest(false);
    }
  };

  const handleDeclineTalkRequest = async (requestId: string) => {
    if (!token || isDecliningRequest) return;
    setIsDecliningRequest(true);
    try {
      const res = await apiFetch(`/api/requests/${requestId}/decline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch {
      alert(t('errors.generic'));
    } finally {
      setIsDecliningRequest(false);
    }
  };

  const handleSendTalkRequest = async (person: WebPersonItem) => {
    if (!token || sentRequestIds.has(person.id)) return;
    try {
      const res = await apiFetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ toUserId: person.id }),
      });
      if (res.status === 429) {
        alert(t('errors.requestDailyLimit'));
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        if (err?.code === 'DUPLICATE_REQUEST') {
          alert(t('errors.requestAlreadySent'));
        } else {
          alert(t('errors.generic'));
        }
        return;
      }
      setSentRequestIds((prev) => new Set(prev).add(person.id));
    } catch {
      alert(t('errors.generic'));
    }
  };

  const handleToggleLikePost = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const newLiked = !p.isLiked;
        let newLikeCount = p.likeCount;
        if (p.isOwn && p.likeCount !== null && p.likeCount !== undefined) {
          newLikeCount = newLiked ? p.likeCount + 1 : Math.max(0, p.likeCount - 1);
        }
        return {
          ...p,
          isLiked: newLiked,
          likeCount: newLikeCount,
        };
      })
    );

    try {
      const res = await apiFetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        fetchWebPosts();
      }
    } catch {
      fetchWebPosts();
    }
  };

  const handleHidePostAuthor = async (post: WebPostItem) => {
    try {
      await apiFetch(`/api/posts/${post.id}/hide-author`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setPosts((prev) => prev.filter((p) => p.authorId !== post.authorId));
      setPostActionTarget(null);
    } catch {
      // non-fatal
    }
  };

  const handleDeletePost = async (post: WebPostItem) => {
    try {
      const res = await apiFetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        setPostActionTarget(null);
      }
    } catch {
      // non-fatal
    }
  };

  const handleReportPost = async () => {
    if (!postActionTarget) return;
    setIsSubmittingPostReport(true);
    try {
      const res = await apiFetch(`/api/posts/${postActionTarget.id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: postReportReason }),
      });
      if (res.ok) {
        setPostReportOpen(false);
        setPostActionTarget(null);
      }
    } catch {
      // non-fatal
    } finally {
      setIsSubmittingPostReport(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 2 - createPostPhotos.length);
    const validJpegs = files.filter(f => f.type === 'image/jpeg' || f.type === 'image/jpg');
    if (validJpegs.length === 0) return;

    setCreatePostPhotos(prev => [...prev, ...validJpegs].slice(0, 2));
    const previews = validJpegs.map(f => URL.createObjectURL(f));
    setCreatePostPhotoPreviews(prev => [...prev, ...previews].slice(0, 2));
  };

  const handleRemovePhoto = (idx: number) => {
    setCreatePostPhotos(prev => prev.filter((_, i) => i !== idx));
    setCreatePostPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreatePost = async () => {
    if (!createPostText.trim() || isSubmittingPost) return;
    setIsSubmittingPost(true);
    setCreatePostError(null);

    try {
      const uploadedPaths: string[] = [];

      for (const file of createPostPhotos) {
        if (file.size > 500 * 1024) {
          throw new Error('Photo exceeds 500 KB');
        }

        const urlRes = await apiFetch('/api/posts/media/upload-url', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!urlRes.ok) throw new Error('Failed to get upload URL');
        const { uploadUrl, path } = await urlRes.json();

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: file,
        });
        if (!putRes.ok) throw new Error('Upload failed');

        const confRes = await apiFetch('/api/posts/media/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ path }),
        });
        if (!confRes.ok) throw new Error('Confirmation failed');
        uploadedPaths.push(path);
      }

      const res = await apiFetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: createPostText.trim(),
          photoPaths: uploadedPaths,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.code === 'POST_CONTACT_INFO') {
          setCreatePostError(t('errors.postContactInfo'));
        } else if (err.code === 'POST_DAILY_LIMIT') {
          setCreatePostError(t('errors.postDailyLimit'));
        } else if (err.code === 'MAX_ACTIVE_POSTS') {
          setCreatePostError(t('errors.maxActivePosts'));
        } else if (err.code === 'POST_TOO_LONG') {
          setCreatePostError(t('errors.postTooLong'));
        } else {
          setCreatePostError(t('errors.generic'));
        }
        setIsSubmittingPost(false);
        return;
      }

      setCreatePostText('');
      setCreatePostPhotos([]);
      setCreatePostPhotoPreviews([]);
      setIsCreatePostModalOpen(false);
      fetchWebPosts();
    } catch {
      setCreatePostError(t('errors.generic'));
    } finally {
      setIsSubmittingPost(false);
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  function scrollToBottom(smooth = false) {
    if (scrollContainerRef.current) {
      if (smooth) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      } else {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }

  // WebSocket for Real-time chat & phase updates
  useEffect(() => {
    if (!token || !selectedMatch?.id || String(selectedMatch.id).startsWith('demo-')) {
      return;
    }

    const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws';
    let active = true;
    let timer: any = null;

    function connectWs() {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!active) return;
          setWsConnected(true);
          ws.send(JSON.stringify({ type: 'auth', token }));
          ws.send(JSON.stringify({ type: 'subscribe', matchId: selectedMatch.id }));
          ws.send(JSON.stringify({ type: 'delivered', matchId: selectedMatch.id }));
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_message' && data.message) {
              const incoming = data.message;
              const decrypted = await decryptMessage(incoming.content, selectedMatch.id);
              setChatMessages((prev) => {
                if (prev.some((m) => m.id === incoming.id)) return prev;
                return [
                  ...prev,
                  {
                    ...incoming,
                    content: decrypted,
                    status: 'sent',
                  },
                ];
              });
              if (!isNearBottom && incoming.senderId !== (user?.id || 'me')) {
                setShowNewMessagesPill(true);
              } else {
                setTimeout(() => scrollToBottom(true), 50);
              }
              // Mark read & acknowledge delivery for incoming message
              if (incoming.senderId !== (user?.id || 'me')) {
                apiFetch(`/api/matches/${selectedMatch.id}/read`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: 'delivered', matchId: selectedMatch.id }));
                }
              }
            } else if (data.type === 'phase_updated' && data.match) {
              setSelectedMatch((prev: any) => ({
                ...prev,
                ...data.match,
              }));
            } else if (data.type === 'typing' && data.matchId === selectedMatch.id && data.userId !== (user?.id || 'me')) {
              setIsOtherTyping(true);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3500);
            } else if (data.type === 'messages_delivered' && data.matchId === selectedMatch.id) {
              setChatMessages((prev) =>
                prev.map((m) => {
                  if ((m.senderId === user?.id || m.senderId === 'me') && !m.deliveredAt) {
                    return { ...m, deliveredAt: data.deliveredAt };
                  }
                  return m;
                })
              );
            } else if (data.type === 'messages_read' && data.matchId === selectedMatch.id) {
              setChatMessages((prev) =>
                prev.map((m) => {
                  if ((m.senderId === user?.id || m.senderId === 'me') && !m.readAt) {
                    return { ...m, readAt: data.readAt, deliveredAt: m.deliveredAt || data.readAt };
                  }
                  return m;
                })
              );
            } else if (data.type === 'message_edited' && data.message && data.message.matchId === selectedMatch.id) {
              const updated = data.message;
              const decrypted = await decryptMessage(updated.content, selectedMatch.id);
              setChatMessages((prev) =>
                prev.map((m) => (m.id === updated.id ? { ...m, ...updated, content: decrypted } : m))
              );
            } else if (data.type === 'message_reaction' && data.matchId === selectedMatch.id) {
              setChatMessages((prev) =>
                prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m))
              );
            } else if (data.type === 'game_updated' && data.matchId === selectedMatch.id) {
              setChatMessages((prev) =>
                prev.map((m) => (m.id === data.messageId ? { ...m, gameData: data.gameData } : m))
              );
            } else if (data.type === 'chat_gift' && data.matchId === selectedMatch.id) {
              setActiveGiftOverlay(data.giftType || 'rose');
              setTimeout(() => setActiveGiftOverlay(null), 2500);
            } else if (data.type === 'message_deleted' && data.matchId === selectedMatch.id) {
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === data.messageId
                    ? { ...m, deletedAt: data.deletedAt || new Date().toISOString(), content: '' }
                    : m
                )
              );
            }
          } catch {}
        };

        ws.onclose = () => {
          if (!active) return;
          setWsConnected(false);
          wsRef.current = null;
          timer = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          if (!active) return;
          setWsConnected(false);
          ws.close();
        };
      } catch {
        setWsConnected(false);
      }
    }

    connectWs();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [selectedMatch?.id, token, user?.id, isNearBottom]);

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
    setShowNewMessagesPill(false);
    setIsNearBottom(true);
    setReplyingToMessage(null);
    setEditingMessage(null);

    if (!token || !match.id || String(match.id).startsWith('demo-')) {
      setChatMessages([
        {
          id: '1',
          senderId: match.otherUserId || 'other',
          content: match.lastMessage || 'Muraho neza! Nshimishijwe no guhura nawe.',
          createdAt: new Date().toISOString(),
          status: 'sent',
        },
      ]);
      setTimeout(() => scrollToBottom(), 50);
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
            content: m.deletedAt ? '' : await decryptMessage(m.content, match.id),
            status: 'sent' as const,
          }))
        );
        setChatMessages(decryptedMsgs);
        setTimeout(() => scrollToBottom(), 50);
      }
      // Acknowledge read receipt on server
      apiFetch(`/api/matches/${match.id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'delivered', matchId: match.id }));
      }
    } catch {
      // fallback
    }
  }

  function handleStartReply(msg: WebChatMessage) {
    setEditingMessage(null);
    setReplyingToMessage(msg);
    if (textareaRef.current) textareaRef.current.focus();
  }

  function handleStartEdit(msg: WebChatMessage) {
    setReplyingToMessage(null);
    setEditingMessage(msg);
    setInputMessage(msg.content);
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
      }, 10);
    }
  }

  async function handleDeleteMessage(msgId: string) {
    setChatMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m))
    );
    try {
      await apiFetch(`/api/messages/${msgId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  }

  async function handleSubmitReport() {
    if (!reportingMatch) return;
    setIsSubmittingReport(true);
    try {
      await apiFetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reportedUserId: reportingMatch.reportedUserId,
          matchId: reportingMatch.matchId,
          reason: reportReason,
        }),
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportingMatch(null);
        setReportSuccess(false);
        setIsSubmittingReport(false);
      }, 1500);
    } catch {
      setIsSubmittingReport(false);
    }
  }

  async function handleSendMessage(textToSend?: string, retryLocalId?: string) {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || !selectedMatch) return;

    if (editingMessage) {
      const msgId = editingMessage.id;
      setEditingMessage(null);
      setInputMessage('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, content: text, editedAt: new Date().toISOString() } : m
        )
      );

      try {
        const encrypted = await encryptMessage(text, selectedMatch.id);
        const res = await apiFetch(`/api/messages/${msgId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: encrypted }),
        });
        if (!res.ok) throw new Error('Edit failed');
        const updated = await res.json();
        setChatMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, ...updated, content: text } : m))
        );
      } catch {
        // non-fatal
      }
      return;
    }

    const currentReply = replyingToMessage;
    setReplyingToMessage(null);

    const localId = retryLocalId || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tempMsg: WebChatMessage = {
      id: localId,
      senderId: user?.id || 'me',
      content: text,
      localPlaintext: text,
      replyToId: currentReply?.id ?? null,
      replyTo: currentReply
        ? { id: currentReply.id, senderId: currentReply.senderId, content: currentReply.content }
        : null,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };

    if (retryLocalId) {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === retryLocalId ? { ...m, status: 'sending' } : m))
      );
    } else {
      setInputMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      setChatMessages((prev) => [...prev, tempMsg]);
      setTimeout(() => scrollToBottom(true), 50);
    }

    if (!token || !selectedMatch.id || String(selectedMatch.id).startsWith('demo-')) {
      setTimeout(() => {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === localId ? { ...m, status: 'sent' } : m))
        );
      }, 300);
      return;
    }

    try {
      setIsSendingMessage(true);
      const encrypted = await encryptMessage(text, selectedMatch.id);
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: encrypted,
          replyToId: currentReply?.id ?? null,
        }),
      });

      if (!res.ok) throw new Error('Send failed');

      const savedMessage = await res.json();
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === localId
            ? { ...m, id: savedMessage.id, status: 'sent', replyTo: tempMsg.replyTo }
            : m
        )
      );
    } catch {
      setChatMessages((prev) =>
        prev.map((m) => (m.id === localId ? { ...m, status: 'failed' } : m))
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    if (!selectedMatch?.id || !token || messageId.startsWith('local-')) return;
    try {
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/messages/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageId, emoji }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch {}
  }

  async function handleSendGamePrompt() {
    if (!selectedMatch?.id || !token) return;
    const questions = [
      t('playground.icebreaker1'),
      t('playground.icebreaker2'),
      t('playground.icebreaker3'),
    ];
    const question = questions[Math.floor(Math.random() * questions.length)];
    try {
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: question,
          mediaType: 'game_prompt',
          gameData: { question, answers: {} },
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        setChatMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, { ...saved, status: 'sent' }]));
      }
    } catch {}
  }

  async function handleSubmitGameAnswer(messageId: string) {
    const answer = (gameAnswersDraft[messageId] || '').trim();
    if (!answer || !selectedMatch?.id || !token) return;
    try {
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/game/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messageId, answer }),
      });
      if (res.ok) {
        const data = await res.json();
        setGameAnswersDraft((prev) => ({ ...prev, [messageId]: '' }));
        setChatMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, gameData: data.gameData } : m))
        );
      }
    } catch {}
  }

  async function handleSendGift(giftType: 'rose' | 'champagne' | 'crown') {
    if (!selectedMatch?.id || !token) return;
    setGiftTrayOpen(false);
    try {
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/gifts/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ giftType }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveGiftOverlay(giftType);
        setTimeout(() => setActiveGiftOverlay(null), 2500);
        if (data.message) {
          setChatMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, { ...data.message, status: 'sent' }]));
        }
      }
    } catch {}
  }

  async function handleReviveMatch() {
    if (!selectedMatch?.id || !token) return;
    try {
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/revive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedMatch((prev: any) => ({ ...prev, expiresAt: data.expiresAt, isRevived: true, status: 'active' }));
      }
    } catch {}
  }

  async function handlePeekReadReceipt() {
    if (!selectedMatch?.id || !token) return;
    try {
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/read-peek`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.readTimes) {
          setUnlockedReadTimes(data.readTimes);
        }
      }
    } catch {}
  }

  async function handleToggleChatVoiceRecord() {
    if (!selectedMatch?.id || !token) return;
    if (chatRecording && chatMediaRecorderRef.current) {
      chatMediaRecorderRef.current.stop();
      setChatRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chatAudioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chatAudioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chatAudioChunksRef.current, { type: 'audio/webm' });
        let mediaUrl = '';
        try {
          const uploadRes = await apiFetch('/api/media/voice-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ matchId: selectedMatch.id, ext: 'webm' }),
          });
          if (uploadRes.ok) {
            const { uploadUrl, path } = await uploadRes.json();
            const putRes = await fetch(uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'audio/webm' },
              body: blob,
            });
            if (putRes.ok) mediaUrl = path;
          }
        } catch {}

        if (!mediaUrl) {
          mediaUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.readAsDataURL(blob);
          });
        }

        if (mediaUrl) {
          const msgRes = await apiFetch(`/api/matches/${selectedMatch.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              content: t('playground.recordVoice'),
              mediaType: 'voice',
              mediaUrl,
            }),
          });
          if (msgRes.ok) {
            const saved = await msgRes.json();
            setChatMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, { ...saved, status: 'sent' }]));
          }
        }
      };
      chatMediaRecorderRef.current = mr;
      mr.start();
      setChatRecording(true);
      setTimeout(() => {
        if (chatMediaRecorderRef.current?.state === 'recording') {
          chatMediaRecorderRef.current.stop();
          setChatRecording(false);
        }
      }, 60000);
    } catch {}
  }

  async function handlePlayChatVoice(msgId: string, mediaUrl?: string | null) {
    if (!mediaUrl) return;
    if (playingChatVoiceId === msgId && chatVoiceAudioRef.current) {
      chatVoiceAudioRef.current.pause();
      setPlayingChatVoiceId(null);
      return;
    }
    let playUrl = mediaUrl;
    if (!mediaUrl.startsWith('http') && !mediaUrl.startsWith('data:') && token) {
      try {
        const res = await apiFetch(`/api/media/chat-voice/url?path=${encodeURIComponent(mediaUrl)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const d = await res.json();
          if (d.url) playUrl = d.url;
        }
      } catch {}
    }
    if (!chatVoiceAudioRef.current) {
      chatVoiceAudioRef.current = new Audio();
    }
    chatVoiceAudioRef.current.src = playUrl;
    chatVoiceAudioRef.current.onended = () => setPlayingChatVoiceId(null);
    chatVoiceAudioRef.current.play().catch(() => {});
    setPlayingChatVoiceId(msgId);
  }

  const fetchAdmirers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch('/api/likes/received', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAdmirers(Array.isArray(data.admirers) ? data.admirers : []);
        setAdmirersCount(data.count ?? 0);
        setIsAdmirersUnblurred(Boolean(data.isUnblurred));
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchAdmirers();
  }, [fetchAdmirers, activeTab]);

  async function handleUnblurAdmirers() {
    if (!token) return;
    setIsUnblurringAdmirers(true);
    try {
      const res = await apiFetch('/api/likes/unblur', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setIsAdmirersUnblurred(true);
        await fetchAdmirers();
      }
    } finally {
      setIsUnblurringAdmirers(false);
    }
  }

  async function handleInstantMatch(admirerId: string) {
    if (!token) return;
    setMatchingAdmirerId(admirerId);
    try {
      const res = await apiFetch('/api/likes/instant-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ admirerId }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchAdmirers();
        if (data.matchId) {
          setActiveTab('matches');
        }
      }
    } finally {
      setMatchingAdmirerId(null);
    }
  }

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPwaPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/notifications/searches', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSearchCount(d.count ?? 0);
          setSearchesUnmasked(Boolean(d.isUnmasked));
          if (Array.isArray(d.searchers)) setRevealedSearchers(d.searchers);
        }
      })
      .catch(() => {});

    apiFetch('/api/dates/spots', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d)) setDateSpots(d);
      })
      .catch(() => {});

    apiFetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setIsSelfieVerified(Boolean(d.isVerified || d.verificationStatus === 'verified'));
          setIsIncognito(Boolean(d.isIncognito));
        }
      })
      .catch(() => {});
  }, [token]);

  async function handleSearchName(q: string) {
    setSearchQuery(q);
    if (!token || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/people/search?q=${encodeURIComponent(q.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSearchResults(Array.isArray(d.results) ? d.results : []);
      }
    } catch {}
  }

  async function handleRevealSearches() {
    if (!token) return;
    try {
      const res = await apiFetch('/api/notifications/searches/reveal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSearchesUnmasked(true);
        if (Array.isArray(d.searchers)) setRevealedSearchers(d.searchers);
      }
    } catch {}
  }

  async function handleSendPhotoCompliment() {
    if (!token || !complimentText.trim()) return;
    const photos = currentProfile.photos?.length ? currentProfile.photos : [currentProfile.photoUrl];
    const activePhoto = photos[cardPhotoIndex] || currentProfile.photoUrl;
    try {
      const res = await apiFetch('/api/photos/compliment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          targetProfileId: currentProfile.id,
          photoUrl: activePhoto,
          commentText: complimentText.trim(),
        }),
      });
      if (res.ok) {
        setComplimentText('');
        setComplimentModalOpen(false);
        setComplimentSentToast(true);
        setTimeout(() => setComplimentSentToast(false), 2000);
      }
    } catch {}
  }

  async function handleVerifySelfie() {
    if (!token) return;
    try {
      const res = await apiFetch('/api/me/verify-selfie', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setIsSelfieVerified(true);
        setSelfieModalOpen(false);
      }
    } catch {}
  }

  async function handleToggleIncognito() {
    const next = !isIncognito;
    setIsIncognito(next);
    if (!token) return;
    try {
      await apiFetch('/api/me/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isIncognito: next }),
      });
    } catch {}
  }

  const [blockedContacts, setBlockedContacts] = useState<{ id: string; blockedPhone: string }[]>([]);
  const [blockPhoneInput, setBlockPhoneInput] = useState('');
  const [blockingPhone, setBlockingPhone] = useState(false);
  const [photoCompliments, setPhotoCompliments] = useState<{ id: string; senderFirstName: string; commentText: string }[]>([]);

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/contacts/blocked', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && Array.isArray(d.contacts)) setBlockedContacts(d.contacts);
      })
      .catch(() => {});
    apiFetch('/api/photos/compliments', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d)) setPhotoCompliments(d);
      })
      .catch(() => {});
  }, [token]);

  async function handleBlockPhone() {
    if (!token || !blockPhoneInput.trim()) return;
    setBlockingPhone(true);
    try {
      const res = await apiFetch('/api/contacts/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phoneNumber: blockPhoneInput.trim() }),
      });
      if (res.ok) {
        const d = await res.json();
        setBlockedContacts(Array.isArray(d.contacts) ? d.contacts : []);
        setBlockPhoneInput('');
      }
    } finally {
      setBlockingPhone(false);
    }
  }

  async function handleUnblockPhone(id: string) {
    if (!token) return;
    setBlockedContacts((prev) => prev.filter((c) => c.id !== id));
    await apiFetch(`/api/contacts/block/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  const [bulkPasteText, setBulkPasteText] = useState('');
  const [isFreeTonight, setIsFreeTonight] = useState(false);
  const [passportCity, setPassportCity] = useState<string | null>(null);

  async function handleToggleFreeTonight() {
    const next = !isFreeTonight;
    setIsFreeTonight(next);
    if (!token) return;
    await apiFetch('/api/me/free-tonight', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isFreeTonight: next }),
    }).catch(() => {});
  }

  async function handleActivatePassport(city: string) {
    if (!token) return;
    const res = await apiFetch('/api/me/passport', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ city }),
    });
    if (res.ok) {
      setPassportCity(city);
    }
  }

  async function submitBulkPhones(rawNumbers: string[]) {
    if (!token || rawNumbers.length === 0) return;
    setBlockingPhone(true);
    try {
      const res = await apiFetch('/api/contacts/block-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phoneNumbers: rawNumbers }),
      });
      if (res.ok) {
        const listRes = await apiFetch('/api/contacts/blocked', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (listRes.ok) {
          const d = await listRes.json();
          if (Array.isArray(d.contacts)) setBlockedContacts(d.contacts);
        }
        setBulkPasteText('');
      }
    } finally {
      setBlockingPhone(false);
    }
  }

  async function handlePickContactsWeb() {
    const nav = navigator as any;
    if ('contacts' in nav && 'ContactsManager' in window) {
      try {
        const picked = await nav.contacts.select(['name', 'tel'], { multiple: true });
        const tels: string[] = [];
        for (const c of picked || []) {
          if (Array.isArray(c.tel)) tels.push(...c.tel);
        }
        await submitBulkPhones(tels);
      } catch {}
    }
  }

  async function handleBulkBlockPaste() {
    const parts = bulkPasteText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    await submitBulkPhones(parts);
  }

  async function handleSendDateInvite(spot: { name: string; area: string }) {
    if (!selectedMatch?.id || !token) return;
    setDateModalOpen(false);
    try {
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/date-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          spotName: spot.name,
          spotArea: spot.area,
          proposedTime: dateTimeText.trim() || t('dates.timePlaceholder'),
        }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.message) {
          setChatMessages((prev) => (prev.some((m) => m.id === d.message.id) ? prev : [...prev, { ...d.message, status: 'sent' }]));
        }
      }
    } catch {}
  }

  async function handleRespondDateInvite(messageId: string, inviteId: string, action: 'accept' | 'decline') {
    if (!selectedMatch?.id || !token) return;
    try {
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/date-invite/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inviteId, action }),
      });
      if (res.ok) {
        const status = action === 'accept' ? 'accepted' : 'declined';
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === messageId && m.gameData
              ? { ...m, gameData: { ...m.gameData, answers: { ...m.gameData.answers, status } } }
              : m
          )
        );
      }
    } catch {}
  }

  async function handleInstallPwa() {
    if (deferredPwaPrompt) {
      deferredPwaPrompt.prompt();
      await deferredPwaPrompt.userChoice.catch(() => {});
      setDeferredPwaPrompt(null);
    } else {
      setShowIosPwaModal(true);
    }
  }

  async function handleCompletePhase() {
    if (!token || !selectedMatch?.id || selectedMatch?.myPhaseComplete || isCompletingPhase) return;
    setIsCompletingPhase(true);
    try {
      const res = await apiFetch(`/api/matches/${selectedMatch.id}/phase-complete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedMatch((prev: any) => ({
          ...prev,
          ...updated,
          myPhaseComplete: true,
        }));
      }
    } catch {
      // non-fatal
    } finally {
      setIsCompletingPhase(false);
    }
  }

  const webChatItems = useMemo(() => {
    if (chatMessages.length === 0) return [];

    const sorted = [...chatMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const items: Array<
      | { type: 'divider'; id: string; text: string }
      | { type: 'message'; id: string; msg: WebChatMessage; isLastInGroup: boolean; timeText: string }
    > = [];

    let lastDateKey = '';

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const dateKey = getDateKey(m.createdAt);

      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        items.push({
          type: 'divider',
          id: `divider-${dateKey}-${i}`,
          text: formatDateDivider(m.createdAt, t),
        });
      }

      const next = sorted[i + 1];
      const isLastInGroup =
        !next ||
        next.senderId !== m.senderId ||
        Math.abs(new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime()) > 120000 ||
        getDateKey(next.createdAt) !== dateKey;

      items.push({
        type: 'message',
        id: m.id,
        msg: m,
        isLastInGroup,
        timeText: formatMessageTime(m.createdAt),
      });
    }

    return items;
  }, [chatMessages, t]);

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
          if (typeof data.readReceiptsEnabled === 'boolean') setReadReceiptsEnabled(data.readReceiptsEnabled);
          if (typeof data.hideFromPeople === 'boolean') setHideFromPeople(data.hideFromPeople);
        }
      })
      .catch(() => {});
  }, [token]);

  async function handleToggleReadReceipts() {
    const nextVal = !readReceiptsEnabled;
    setReadReceiptsEnabled(nextVal);
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ readReceiptsEnabled: nextVal }),
      });
    } catch {}
  }

  async function handleToggleHideFromPeople() {
    const nextVal = !hideFromPeople;
    setHideFromPeople(nextVal);
    try {
      await apiFetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ hideFromPeople: nextVal }),
      });
    } catch {}
  }

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

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/match-queue', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Candidate[] = data.map((c: any) => {
            const photos: string[] = Array.isArray(c.photos) && c.photos.length > 0
              ? c.photos
              : c.primaryPhotoPath
                ? [c.primaryPhotoPath]
                : ['/images/couple1.jpg'];
            return {
              id: c.id,
              name: c.firstName || 'kinn Member',
              age: c.age ?? 24,
              location: c.location || c.campusName || c.city || 'Kigali',
              occupation: c.occupation || '',
              isUrStudent: Boolean(c.isUrStudent),
              isVerified: Boolean(c.isVerified),
              intent: c.primaryIntent || c.intent_class || 'Serious',
              trustScore: c.trustScore ?? 1,
              photoUrl: photos[0] || '/images/couple1.jpg',
              photos,
              bio: c.bio ?? null,
              tags: Array.isArray(c.tags) ? c.tags : [],
              voiceIntroPath: c.voiceIntroPath ?? null,
              voiceIntroDurationMs: c.voiceIntroDurationMs ?? null,
            };
          });
          setDeckProfiles(mapped);
          setProfileIndex(0);
          setCardPhotoIndex(0);
        }
      })
      .catch(() => {});

    apiFetch('/api/swipes/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => {
        if (status && typeof status.remaining === 'number') {
          setSwipesRemaining(status.remaining);
        }
        if (status?.inviteCode) {
          setMyInviteCode(status.inviteCode);
        }
      })
      .catch(() => {});
  }, [token]);

  const currentProfile = deckProfiles[profileIndex % deckProfiles.length] || SAMPLE_PROFILES[0];

  useEffect(() => {
    setCardPhotoIndex(0);
    setShowProfileDetail(false);
  }, [profileIndex, currentProfile?.id]);

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

  async function handleSwipe(action: 'pass' | 'like' | 'bid') {
    if (swipesRemaining <= 0) {
      setOutOfSwipesOpen(true);
      return;
    }

    if (candidateAudioRef.current) {
      candidateAudioRef.current.pause();
    }
    setPlayingCandidateAudio(false);

    if (action === 'bid' && goldenBids <= 0) return;

    if (token && !['1', '2', '3'].includes(currentProfile.id)) {
      try {
        const endpoint = action === 'pass' ? '/api/passes' : '/api/interests';
        const payload =
          action === 'pass'
            ? { targetUserId: currentProfile.id, action: 'soft_pass' }
            : { toUserId: currentProfile.id, reactionType: 'serious', isGoldenBid: action === 'bid' };

        const res = await apiFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.status === 429) {
          setSwipesRemaining(0);
          setOutOfSwipesOpen(true);
          return;
        }
      } catch {}
    }

    setSwipesRemaining((prev) => Math.max(0, prev - 1));
    setSwipeHistory((prev) => [...prev.slice(-9), { index: profileIndex, candidateId: currentProfile.id }]);

    if (action === 'bid') {
      setGoldenBids((prev) => prev - 1);
      setMatchAlert(t('discover.goldenBidAlert', { name: currentProfile.name }));
    } else if (action === 'like') {
      setMatchAlert(t('discover.matchAlert', { name: currentProfile.name }));
    }

    setTimeout(() => {
      setMatchAlert(null);
      setProfileIndex((prev) => prev + 1);
    }, action === 'pass' ? 150 : 900);
  }

  async function handleRewind() {
    if (swipeHistory.length === 0) return;
    const last = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory((prev) => prev.slice(0, -1));
    setProfileIndex(last.index);
    setCardPhotoIndex(0);
    setMatchAlert(null);

    if (token && !['1', '2', '3'].includes(last.candidateId)) {
      try {
        const res = await apiFetch('/api/swipes/rewind', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUserId: last.candidateId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.remaining === 'number') setSwipesRemaining(data.remaining);
        }
      } catch {}
    }
  }

  async function handleClaimWhatsAppBonus() {
    const inviteLink = `https://kinn.ink/invite/${myInviteCode || 'KINN'}`;
    const text = encodeURIComponent(t('discover.whatsappInviteText', { link: inviteLink }));
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');

    setClaimingBonus(true);
    try {
      if (token) {
        const res = await apiFetch('/api/swipes/whatsapp-bonus', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.remaining === 'number') {
            setSwipesRemaining(data.remaining);
          } else {
            setSwipesRemaining((prev) => prev + 30);
          }
        } else {
          setSwipesRemaining((prev) => prev + 30);
        }
      } else {
        setSwipesRemaining((prev) => prev + 30);
      }
      setOutOfSwipesOpen(false);
    } finally {
      setClaimingBonus(false);
    }
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
        {/* TAB 1: DISCOVER SWIPE DECK OR POSTS FEED */}
        {activeTab === 'discover' && (
          <div className="flex-1 flex flex-col justify-between relative overflow-hidden">
            {/* 8 PM Rush Live Banner */}
            <button
              type="button"
              onClick={() => setRushModalOpen(true)}
              className="mx-4 mt-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-[#FF6B6B]/20 to-[#C9A84C]/20 border border-[#FF6B6B]/40 flex items-center justify-between cursor-pointer shrink-0"
            >
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#FF6B6B]" />
                <span className="text-xs font-bold text-[#F0EDE6]">{t('rush.liveBanner')}</span>
              </div>
              <span className="text-[11px] font-bold text-[#C9A84C]">{t('rush.joinQueue')} →</span>
            </button>
            {/* Segmented Control */}
            {(isFeedEnabled || isPeopleEnabled) && (
              <div className="px-4 py-2 border-b border-[#21262D] bg-[#0D1117]/80 flex gap-2 shrink-0">
                <button
                  onClick={() => setDiscoverSegment('deck')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    discoverSegment === 'deck'
                      ? 'bg-[#1A1A2E] text-[#C9A84C] border border-[#C9A84C]/40'
                      : 'text-[#A8A49E] hover:text-[#F0EDE6]'
                  }`}
                >
                  {t('posts.deck')}
                </button>
                {isFeedEnabled && (
                  <button
                    onClick={() => setDiscoverSegment('posts')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      discoverSegment === 'posts'
                        ? 'bg-[#1A1A2E] text-[#C9A84C] border border-[#C9A84C]/40'
                        : 'text-[#A8A49E] hover:text-[#F0EDE6]'
                    }`}
                  >
                    {t('posts.title')}
                  </button>
                )}
                {isPeopleEnabled && (
                  <button
                    onClick={() => setDiscoverSegment('people')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      discoverSegment === 'people'
                        ? 'bg-[#1A1A2E] text-[#C9A84C] border border-[#C9A84C]/40'
                        : 'text-[#A8A49E] hover:text-[#F0EDE6]'
                    }`}
                  >
                    {t('posts.people')}
                  </button>
                )}
              </div>
            )}

            {discoverSegment === 'posts' && isFeedEnabled ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Notice bar & Create Post button */}
                <div className="px-4 py-2 bg-[#161B22] border-b border-[#21262D] flex items-center justify-between text-xs text-[#A8A49E] shrink-0">
                  <span className="text-[11px]">🛡️ {t('posts.webCaptureNotice')}</span>
                  <button
                    onClick={() => setIsCreatePostModalOpen(true)}
                    className="flex items-center gap-1.5 bg-[#C9A84C] text-[#0D1117] font-bold px-3 py-1 rounded-full hover:bg-[#C9A84C]/90 transition-colors shadow-sm cursor-pointer text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('posts.createPost')}</span>
                  </button>
                </div>

                {/* Posts Feed list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoadingPosts ? (
                    <div className="py-20 flex justify-center items-center">
                      <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
                    </div>
                  ) : posts.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center gap-3">
                      <p className="text-[#A8A49E] font-medium text-sm">{t('posts.noPosts')}</p>
                      <button
                        onClick={() => setIsCreatePostModalOpen(true)}
                        className="flex items-center gap-1.5 bg-[#C9A84C] text-[#0D1117] font-bold px-4 py-2 rounded-full hover:bg-[#C9A84C]/90 transition-colors cursor-pointer text-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('posts.createPost')}</span>
                      </button>
                    </div>
                  ) : (
                    posts.map((post) => (
                      <div
                        key={post.id}
                        className="p-4 rounded-2xl bg-[#1A1A2E] border border-[#21262D] shadow-lg space-y-3"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#F0EDE6]">
                              {post.firstName}{post.age ? `, ${post.age}` : ''}
                            </span>
                            {post.isVerified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-[#3FB950]" />
                            )}
                            {post.location && (
                              <span className="text-xs text-[#A8A49E]">• {post.location}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#A8A49E]">
                              {formatWebRelativeTime(post.createdAt)}
                            </span>
                            <div className="relative">
                              <button
                                onClick={() => setPostActionTarget(postActionTarget?.id === post.id ? null : post)}
                                className="p-1 text-[#A8A49E] hover:text-[#F0EDE6] rounded transition-colors cursor-pointer"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                              {postActionTarget?.id === post.id && (
                                <div className="absolute right-0 top-full mt-1 w-36 bg-[#161B22] border border-[#21262D] rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                                  {post.isOwn ? (
                                    <button
                                      onClick={() => handleDeletePost(post)}
                                      className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>{t('posts.delete')}</span>
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setPostReportReason('post');
                                          setPostReportOpen(true);
                                        }}
                                        className="w-full px-3 py-1.5 text-left text-xs text-[#F0EDE6] hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                      >
                                        <Flag className="w-3.5 h-3.5" />
                                        <span>{t('posts.report')}</span>
                                      </button>
                                      <button
                                        onClick={() => handleHidePostAuthor(post)}
                                        className="w-full px-3 py-1.5 text-left text-xs text-[#F0EDE6] hover:bg-white/5 flex items-center gap-2 cursor-pointer"
                                      >
                                        <EyeOff className="w-3.5 h-3.5" />
                                        <span>{t('posts.hideAuthor')}</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Text */}
                        <p className="text-sm text-[#F0EDE6] leading-relaxed whitespace-pre-wrap">
                          {post.text}
                        </p>

                        {/* Photos (up to 2) */}
                        {post.photoUrls && post.photoUrls.length > 0 && (
                          <div className={`grid gap-2 rounded-xl overflow-hidden ${post.photoUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {post.photoUrls.slice(0, 2).map((url, idx) => (
                              <img
                                key={idx}
                                src={url}
                                alt="Post"
                                className="w-full h-52 object-cover rounded-lg bg-[#242438]"
                              />
                            ))}
                          </div>
                        )}

                        {/* Footer: Like */}
                        <div className="pt-2 border-t border-[#21262D] flex items-center gap-4">
                          <button
                            onClick={() => handleToggleLikePost(post.id)}
                            className="flex items-center gap-1.5 text-xs text-[#A8A49E] hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Heart
                              className={`w-4 h-4 ${post.isLiked ? 'fill-red-500 text-red-500' : ''}`}
                            />
                            {/* Viewers never see any count; author sees count ONLY when > 0 */}
                            {post.isOwn && typeof post.likeCount === 'number' && post.likeCount > 0 && (
                              <span className="font-semibold text-xs text-[#F0EDE6]">{post.likeCount}</span>
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : discoverSegment === 'people' && isPeopleEnabled ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Notice bar */}
                <div className="px-4 py-2 bg-[#161B22] border-b border-[#21262D] flex items-center justify-between text-xs text-[#A8A49E] shrink-0">
                  <span className="text-[11px]">🛡️ {t('posts.webCaptureNotice')}</span>
                </div>

                {/* People list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isLoadingPeople && people.length === 0 ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2563EB]" />
                    </div>
                  ) : people.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-[#A8A49E] space-y-2">
                      <Users className="w-10 h-10 text-[#4A4742]" />
                      <p className="text-sm font-semibold">{t('people.emptyTitle')}</p>
                    </div>
                  ) : (
                    people.map((person) => {
                      const locationStr =
                        person.campusName || person.faculty
                          ? [person.faculty, person.campusName].filter(Boolean).join(' · ')
                          : [person.city, person.district].filter(Boolean).join(' · ');

                      const isApproaching = approachingPeopleIds.has(person.id);

                      return (
                        <div
                          key={person.id}
                          className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex flex-col gap-3 shadow-sm"
                        >
                          {/* Card Header: Avatar, Name, Location */}
                          <div className="flex items-center gap-3">
                            {person.photoUrl ? (
                              <img
                                src={person.photoUrl}
                                alt={person.firstName}
                                className="w-12 h-12 rounded-full object-cover bg-[#242438] shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-[#242438] flex items-center justify-center shrink-0">
                                <User className="w-6 h-6 text-[#A8A49E]" />
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-base text-[#F0EDE6] truncate">
                                  {person.firstName}
                                  {person.age ? `, ${person.age}` : ''}
                                </span>
                                {person.isVerified && (
                                  <CheckCircle2 className="w-4 h-4 text-[#2563EB] shrink-0" />
                                )}
                              </div>
                              {locationStr && (
                                <p className="text-xs text-[#A8A49E] truncate">{locationStr}</p>
                              )}
                            </div>
                          </div>

                          {/* Bio */}
                          {person.bio && (
                            <p className="text-sm text-[#F0EDE6] leading-relaxed break-words whitespace-pre-wrap">
                              {person.bio}
                            </p>
                          )}

                          {/* Tags */}
                          {Array.isArray(person.tags) && person.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {person.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-[#242438] text-[11px] text-[#A8A49E] rounded-md font-medium"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons: Approach and Request */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleWebApproach(person)}
                              disabled={person.hasInterested || isApproaching}
                              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                person.hasInterested
                                  ? 'bg-[#242438] text-[#A8A49E] border border-[#21262D] cursor-not-allowed'
                                  : 'bg-[#2563EB] text-[#F0EDE6] hover:bg-[#1D4ED8]'
                              }`}
                            >
                              {isApproaching ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                              ) : person.hasInterested ? (
                                <>
                                  <Check className="w-4 h-4" />
                                  <span>{t('people.approached')}</span>
                                </>
                              ) : (
                                <>
                                  <Heart className="w-4 h-4" />
                                  <span>{t('people.approach')}</span>
                                </>
                              )}
                            </button>

                            {isRequestsEnabled && (
                              <button
                                onClick={() => handleSendTalkRequest(person)}
                                disabled={sentRequestIds.has(person.id)}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                  sentRequestIds.has(person.id)
                                    ? 'bg-[#242438] text-[#A8A49E] border border-[#21262D] cursor-not-allowed'
                                    : 'bg-[#C9A84C]/15 border border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C]/25'
                                }`}
                              >
                                {sentRequestIds.has(person.id) ? (
                                  <>
                                    <Check className="w-4 h-4" />
                                    <span>{t('requests.requestSent')}</span>
                                  </>
                                ) : (
                                  <>
                                    <MessageCircle className="w-4 h-4" />
                                    <span>{t('requests.sendRequest')}</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Load More Button */}
                  {hasMorePeople && !dailyPeopleLimitReached && people.length > 0 && (
                    <div className="flex justify-center pt-2 pb-4">
                      <button
                        onClick={() => peopleOffset !== null && fetchWebPeople(peopleOffset)}
                        disabled={isLoadingPeople}
                        className="px-4 py-2 bg-[#1A1A2E] border border-[#21262D] rounded-xl text-xs font-semibold text-[#A8A49E] hover:text-[#F0EDE6] transition-colors cursor-pointer"
                      >
                        {isLoadingPeople ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-[#2563EB]" />
                        ) : (
                          'Load more'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : isRequestsEnabled && pendingRequests.length > 0 ? (
              <div className="flex-1 flex flex-col px-4 py-3 justify-between relative">
                {/* Match Toast Notification */}
                {matchAlert && (
                  <div className="absolute top-4 left-4 right-4 z-30 p-3 bg-[#3FB950] text-[#0D1117] rounded-xl font-bold text-center text-xs shadow-xl animate-bounce">
                    🎉 {matchAlert}
                  </div>
                )}

                {/* Pending Talk Request Card */}
                <div className="w-full flex-1 rounded-3xl bg-[#1A1A2E] border-2 border-[#C9A84C]/60 overflow-hidden flex flex-col relative shadow-2xl">
                  {/* Photo Area */}
                  <div className="relative h-64 w-full bg-[#242438] overflow-hidden">
                    {pendingRequests[0].photoUrl ? (
                      <img
                        src={pendingRequests[0].photoUrl}
                        alt={pendingRequests[0].firstName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#242438]">
                        <User className="w-16 h-16 text-[#A8A49E]" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A2E] via-transparent to-black/30" />

                    {/* Badge: Wants to talk */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0D1117]/85 border border-[#C9A84C] text-[#C9A84C] text-xs font-bold shadow">
                      <Sparkles className="w-3.5 h-3.5 text-[#C9A84C]" />
                      <span>{t('requests.badge')}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-[#F0EDE6]">
                          {pendingRequests[0].firstName}
                          {pendingRequests[0].age ? `, ${pendingRequests[0].age}` : ''}
                        </h2>
                        {pendingRequests[0].isVerified && (
                          <CheckCircle2 className="w-5 h-5 text-[#2563EB]" />
                        )}
                      </div>

                      {(pendingRequests[0].campusName || pendingRequests[0].faculty || pendingRequests[0].city) && (
                        <p className="text-xs text-[#A8A49E] mt-1">
                          {[pendingRequests[0].faculty, pendingRequests[0].campusName, pendingRequests[0].city].filter(Boolean).join(' · ')}
                        </p>
                      )}

                      {pendingRequests[0].bio && (
                        <p className="text-sm text-[#F0EDE6] mt-3 leading-relaxed">
                          {pendingRequests[0].bio}
                        </p>
                      )}

                      {Array.isArray(pendingRequests[0].tags) && pendingRequests[0].tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {pendingRequests[0].tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-[#242438] text-[11px] text-[#A8A49E] rounded-md font-medium"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Decline and Accept */}
                    <div className="flex items-center gap-3 pt-4 border-t border-[#21262D]">
                      <button
                        onClick={() => handleDeclineTalkRequest(pendingRequests[0].id)}
                        disabled={isDecliningRequest || isAcceptingRequest}
                        className="flex-1 py-3 bg-[#E5534B]/15 border border-[#E5534B] text-[#E5534B] rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#E5534B]/25 transition-colors cursor-pointer"
                      >
                        {isDecliningRequest ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-[#E5534B]" />
                        ) : (
                          <>
                            <X className="w-4 h-4" />
                            <span>{t('requests.decline')}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleAcceptTalkRequest(pendingRequests[0].id)}
                        disabled={isDecliningRequest || isAcceptingRequest}
                        className="flex-1 py-3 bg-[#2563EB] text-[#F0EDE6] rounded-2xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#1D4ED8] transition-colors cursor-pointer shadow-lg"
                      >
                        {isAcceptingRequest ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                        ) : (
                          <>
                            <Heart className="w-4 h-4" />
                            <span>{t('requests.accept')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col px-4 py-3 justify-between relative">
                {/* Match Toast Notification */}
                {matchAlert && (
                  <div className="absolute top-4 left-4 right-4 z-30 p-3 bg-[#3FB950] text-[#0D1117] rounded-xl font-bold text-center text-xs shadow-xl animate-bounce">
                    🎉 {matchAlert}
                  </div>
                )}

                {/* Profile Card */}
                {(() => {
                  const photos = currentProfile.photos?.length ? currentProfile.photos : [currentProfile.photoUrl];
                  const activePhoto = photos[cardPhotoIndex] || currentProfile.photoUrl;
                  return (
                    <div className="w-full flex-1 rounded-3xl bg-[#1A1A2E] border border-[#21262D] overflow-hidden flex flex-col relative shadow-2xl min-h-[400px]">
                      {/* Full-bleed Photo Area with Story Tapping */}
                      <div className="relative flex-1 w-full bg-[#242438] overflow-hidden">
                        <img
                          src={activePhoto}
                          alt={currentProfile.name}
                          className="w-full h-full object-cover transition-opacity duration-200"
                        />

                        {/* Segmented Progress Bars at Top */}
                        {photos.length > 1 && (
                          <div className="absolute top-2.5 left-3 right-3 z-20 flex gap-1.5">
                            {photos.map((_, idx) => (
                              <div
                                key={idx}
                                className={`h-1 flex-1 rounded-full transition-colors ${
                                  idx === cardPhotoIndex ? 'bg-white shadow' : 'bg-white/35'
                                }`}
                              />
                            ))}
                          </div>
                        )}

                        {/* Left / Right Tap Zones */}
                        <div className="absolute inset-0 z-10 flex">
                          <button
                            type="button"
                            aria-label="Previous photo"
                            onClick={() =>
                              setCardPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
                            }
                            className="w-1/2 h-full cursor-pointer bg-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            aria-label="Next photo"
                            onClick={() =>
                              setCardPhotoIndex((prev) => (prev + 1) % photos.length)
                            }
                            className="w-1/2 h-full cursor-pointer bg-transparent focus:outline-none"
                          />
                        </div>

                        {/* Top Badges */}
                        <div className="absolute top-6 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
                          <div className="flex flex-wrap gap-1.5">
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
                          <span className="bg-[#0D1117]/80 backdrop-blur-sm text-[#F0EDE6] text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-[#21262D]">
                            {getIntentBadgeLabel(currentProfile.intent, t)}
                          </span>
                        </div>

                        {/* Dark Bottom Gradient + Rich Info Overlay */}
                        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#0D1117] via-[#0D1117]/85 to-transparent pt-16 pb-4 px-4 flex flex-col gap-1.5 pointer-events-none">
                          <div className="flex items-end justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h2 className="text-2xl font-bold font-serif text-[#F0EDE6] truncate">
                                  {currentProfile.name}, {currentProfile.age}
                                </h2>
                                {(currentProfile.isVerified || currentProfile.isUrStudent) && (
                                  <BadgeCheck className="w-5 h-5 text-[#38BDF8] shrink-0" />
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#CBD5E1] mt-0.5">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
                                  {currentProfile.location}
                                </span>
                                {currentProfile.occupation && (
                                  <span className="flex items-center gap-1">
                                    <Briefcase className="w-3.5 h-3.5 text-[#C9A84C]" />
                                    {currentProfile.occupation}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Icons: Photo Compliment (200 RWF) + Info */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setComplimentModalOpen(true)}
                                aria-label={t('compliment.title')}
                                title={t('compliment.title')}
                                className="pointer-events-auto w-9 h-9 rounded-full bg-[#C9A84C]/90 text-[#0D1117] flex items-center justify-center hover:bg-[#C9A84C] transition-colors cursor-pointer"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowProfileDetail(true)}
                                aria-label={t('discover.fullProfile')}
                                className="pointer-events-auto w-9 h-9 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[#F0EDE6] flex items-center justify-center hover:bg-white/25 transition-colors cursor-pointer"
                              >
                                <Info className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Passion Pill Tags */}
                          {currentProfile.tags && currentProfile.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {currentProfile.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="bg-white/12 backdrop-blur-sm text-[#F0EDE6] text-[10px] font-semibold px-2.5 py-0.5 rounded-full border border-white/15"
                                >
                                  #{t(`tags.${tag}`, { defaultValue: tag })}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Voice Intro Pill */}
                          {currentProfile.voiceIntroPath && (
                            <button
                              type="button"
                              onClick={() => toggleCandidateVoice(currentProfile.voiceIntroPath!)}
                              className="pointer-events-auto self-start flex items-center gap-1.5 bg-[#0D1117]/90 hover:bg-[#0D1117] border border-[#C9A84C]/40 px-2.5 py-1 rounded-full text-xs font-medium text-[#C9A84C] transition-colors cursor-pointer mt-1"
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

                          {/* Bio Snippet */}
                          {currentProfile.bio && (
                            <p className="text-xs text-[#CBD5E1] line-clamp-2 mt-0.5">
                              {currentProfile.bio}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Action Dock: Rewind, Coffee (100), Pass, Like, Cocktail (200), Super Like */}
                <div className="flex items-center justify-center gap-3 py-3">
                  {/* Rewind */}
                  <button
                    type="button"
                    onClick={handleRewind}
                    disabled={swipeHistory.length === 0}
                    title={t('discover.rewind')}
                    aria-label={t('discover.rewind')}
                    className="w-10 h-10 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#F59E0B] flex items-center justify-center hover:border-[#F59E0B] active:scale-95 transition-all shadow-md disabled:opacity-35 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Send Coffee (100 RWF) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!token || !currentProfile) return;
                      apiFetch('/api/deck/drink', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ targetUserId: currentProfile.id, drinkType: 'coffee' }),
                      }).catch(() => {});
                    }}
                    title={t('deck.sendCoffee')}
                    className="w-10 h-10 rounded-full bg-[#1A1A2E] border border-[#C9A84C]/50 text-base flex items-center justify-center hover:border-[#C9A84C] active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    ☕
                  </button>

                  {/* Pass */}
                  <button
                    type="button"
                    onClick={() => handleSwipe('pass')}
                    title={t('discover.pass')}
                    aria-label={t('discover.pass')}
                    className="w-14 h-14 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#FF6B6B] flex items-center justify-center hover:border-[#FF6B6B] active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    <X className="w-7 h-7" />
                  </button>

                  {/* Like */}
                  <button
                    type="button"
                    onClick={() => handleSwipe('like')}
                    title={t('discover.like')}
                    aria-label={t('discover.like')}
                    className="w-14 h-14 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#3FB950] flex items-center justify-center hover:border-[#3FB950] active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    <Heart className="w-7 h-7 fill-current" />
                  </button>

                  {/* Send Cocktail (200 RWF) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!token || !currentProfile) return;
                      apiFetch('/api/deck/drink', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ targetUserId: currentProfile.id, drinkType: 'cocktail' }),
                      }).catch(() => {});
                    }}
                    title={t('deck.sendCocktail')}
                    className="w-10 h-10 rounded-full bg-[#1A1A2E] border border-[#FF6B6B]/50 text-base flex items-center justify-center hover:border-[#FF6B6B] active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    🍸
                  </button>

                  {/* Super Like */}
                  <button
                    type="button"
                    onClick={() => handleSwipe('bid')}
                    disabled={goldenBids <= 0}
                    title={t('discover.superLike')}
                    aria-label={t('discover.superLike')}
                    className="w-10 h-10 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold active:scale-95 transition-all shadow-[0_0_16px_rgba(37,99,235,0.4)] disabled:opacity-40 cursor-pointer"
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                </div>

                {/* Full Profile Details Slide-Up Modal */}
                {showProfileDetail && (
                  <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#161B22] border border-[#21262D] rounded-3xl p-5 flex flex-col gap-3 max-h-[80vh] overflow-y-auto shadow-2xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif text-xl font-bold text-[#F0EDE6]">
                            {currentProfile.name}, {currentProfile.age}
                          </h3>
                          {(currentProfile.isVerified || currentProfile.isUrStudent) && (
                            <BadgeCheck className="w-5 h-5 text-[#38BDF8]" />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowProfileDetail(false)}
                          className="p-1.5 rounded-full bg-[#21262D] text-[#A8A49E] hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-[#0D1117] text-[#F0EDE6] text-xs font-semibold px-3 py-1 rounded-full border border-[#21262D]">
                          {getIntentBadgeLabel(currentProfile.intent, t)}
                        </span>
                        {currentProfile.isUrStudent && (
                          <span className="bg-[#2563EB] text-white text-xs font-bold px-3 py-1 rounded-full">
                            {t('discover.urStudentBadge')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#CBD5E1] space-y-1">
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
                          {currentProfile.location}
                        </p>
                        {currentProfile.occupation && (
                          <p className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-[#C9A84C]" />
                            {currentProfile.occupation}
                          </p>
                        )}
                      </div>
                      {currentProfile.bio && (
                        <p className="text-sm text-[#F0EDE6] leading-relaxed bg-[#0D1117] p-3 rounded-xl border border-[#21262D]">
                          {currentProfile.bio}
                        </p>
                      )}
                      {currentProfile.tags && currentProfile.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {currentProfile.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-[#1A1A2E] text-[#CBD5E1] text-xs px-2.5 py-1 rounded-full border border-[#21262D]"
                            >
                              #{t(`tags.${tag}`, { defaultValue: tag })}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Out of Swipes Modal */}
                {outOfSwipesOpen && (
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-[#161B22] border border-[#21262D] rounded-3xl p-6 flex flex-col items-center text-center gap-4 shadow-2xl">
                      <div className="w-14 h-14 rounded-full bg-[#2563EB]/20 border border-[#2563EB] flex items-center justify-center text-[#38BDF8]">
                        <Flame className="w-7 h-7" />
                      </div>
                      <h3 className="font-serif text-xl font-bold text-[#F0EDE6]">
                        {t('discover.outOfSwipesTitle')}
                      </h3>
                      <button
                        type="button"
                        onClick={handleClaimWhatsAppBonus}
                        disabled={claimingBonus}
                        className="w-full py-3.5 px-4 bg-[#25D366] text-[#0D1117] rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer shadow-lg"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>{t('discover.inviteWhatsAppButton')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutOfSwipesOpen(false)}
                        className="text-xs text-[#8B949E] hover:text-[#F0EDE6] cursor-pointer"
                      >
                        {t('chat.cancel')}
                      </button>
                    </div>
                  </div>
                )}
          </div>
        )}
      </div>
    )}

        {/* TAB 2: MATCHES & 3-PHASE CHAT */}
        {activeTab === 'matches' && (
          <div className="flex-1 flex flex-col p-4 gap-3">
            {selectedMatch ? (
              /* Active Conversation View */
              <div className="flex-1 flex flex-col min-h-[480px] relative">
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
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-[#F0EDE6] leading-tight">
                          {selectedMatch.otherUserName || selectedMatch.name}
                        </h3>
                        <span className="w-2 h-2 rounded-full bg-[#3FB950] shadow-[0_0_6px_#3FB950]" title={t('playground.activeNow')} />
                        {(selectedMatch.streakCount ?? 0) > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
                            {t('playground.streakDays', { count: selectedMatch.streakCount })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isOtherTyping ? (
                          <span className="text-[10px] font-medium text-emerald-400 animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                            {t('chat.typing')}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-[#2563EB]">
                              {t('matches.phase', { phase: selectedMatch.conversationPhase || 1 })}
                            </span>
                            {selectedMatch.expiresAt && (
                              <span className="text-[10px] font-semibold text-[#A8A49E] flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {t('matches.hoursLeft', {
                                  count: Math.max(0, Math.ceil((new Date(selectedMatch.expiresAt).getTime() - Date.now()) / 3600000)),
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Date Spot Button */}
                    <button
                      type="button"
                      onClick={() => setDateModalOpen(true)}
                      title={t('dates.title')}
                      aria-label={t('dates.title')}
                      className="p-2 rounded-full border border-[#21262D] bg-[#1A1A2E] text-[#38BDF8] hover:border-[#38BDF8]/60 transition-all cursor-pointer"
                    >
                      <MapPin className="w-4 h-4" />
                    </button>

                    {/* Nudge Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!token || !selectedMatch?.id) return;
                        apiFetch(`/api/matches/${selectedMatch.id}/nudge`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` },
                        }).catch(() => {});
                      }}
                      title={t('nudge.sendNudge')}
                      aria-label={t('nudge.sendNudge')}
                      className="p-2 rounded-full border border-[#21262D] bg-[#1A1A2E] text-[#C9A84C] hover:border-[#C9A84C]/60 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-bold">⚡</span>
                    </button>

                    {/* Question Game Button */}
                    <button
                      type="button"
                      onClick={handleSendGamePrompt}
                      title={t('playground.questionGame')}
                      aria-label={t('playground.questionGame')}
                      className="p-2 rounded-full border border-[#21262D] bg-[#1A1A2E] text-[#C9A84C] hover:border-[#C9A84C]/60 transition-all cursor-pointer"
                    >
                      <Dices className="w-4 h-4" />
                    </button>
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

                    {/* Report Match Button */}
                    <button
                      type="button"
                      onClick={() => setReportingMatch({ reportedUserId: selectedMatch.otherUserId || selectedMatch.id, matchId: selectedMatch.id })}
                      title={t('chat.report')}
                      aria-label={t('chat.report')}
                      className="p-2 rounded-full border border-[#21262D] bg-[#1A1A2E] text-[#A8A49E] hover:text-[#FF6B6B] hover:border-[#FF6B6B]/40 transition-all cursor-pointer"
                    >
                      <Flag className="w-4 h-4" />
                    </button>

                    {/* Complete Phase Button */}
                    <button
                      type="button"
                      onClick={handleCompletePhase}
                      disabled={isCompletingPhase || selectedMatch?.myPhaseComplete}
                      title={selectedMatch?.myPhaseComplete ? t('matches.phaseCompleted') : t('matches.completePhase')}
                      aria-label={selectedMatch?.myPhaseComplete ? t('matches.phaseCompleted') : t('matches.completePhase')}
                      className={`p-2 rounded-full border transition-all cursor-pointer ${
                        selectedMatch?.myPhaseComplete
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 cursor-default'
                          : 'border-[#21262D] bg-[#1A1A2E] text-[#A8A49E] hover:text-[#F0EDE6] hover:border-[#2563EB]'
                      } disabled:opacity-70`}
                    >
                      {isCompletingPhase ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
                      ) : selectedMatch?.myPhaseComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Connection Status Line */}
                {!wsConnected && (
                  <div className="flex items-center justify-center gap-1.5 py-1 bg-[#161B22] border-b border-[#21262D] text-[11px] text-[#A8A49E]">
                    <Loader2 className="w-3 h-3 animate-spin text-[#2563EB]" />
                    <span>{t('matches.reconnecting')}</span>
                  </div>
                )}

                {/* Messages List Area */}
                <div className="flex-1 relative flex flex-col min-h-0">
                  <div
                    ref={scrollContainerRef}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                      setIsNearBottom(near);
                      if (near) setShowNewMessagesPill(false);
                    }}
                    className="flex-1 flex flex-col py-3 overflow-y-auto max-h-[380px] scroll-smooth"
                  >
                    {chatMessages.length === 0 ? (
                      <div className="my-auto flex flex-col items-center justify-center py-12 gap-3 text-center">
                        <MessageCircle className="w-10 h-10 text-[#4A4742]" />
                        <span className="text-sm font-semibold text-[#A8A49E]">{t('matches.noMessages')}</span>
                      </div>
                    ) : (
                      webChatItems.map((item) => {
                        if (item.type === 'divider') {
                          return (
                            <div key={item.id} className="flex justify-center my-3">
                              <span className="px-3 py-1 rounded-full bg-[#161B22] border border-[#21262D] text-[11px] font-semibold text-[#8B949E]">
                                {item.text}
                              </span>
                            </div>
                          );
                        }
                        const msg = item.msg;
                        const isMe = msg.senderId === user?.id || msg.senderId === 'me';
                        const isDeleted = Boolean(msg.deletedAt);
                        const canEdit = isMe && !isDeleted && (Date.now() - new Date(msg.createdAt).getTime() <= 15 * 60 * 1000);
                        const partnerPhoto = selectedMatch?.otherUserPrimaryPhoto || selectedMatch?.photoUrl;

                        return (
                          <div
                            key={item.id}
                            className={`group relative flex flex-col ${isMe ? 'items-end' : 'items-start'} ${
                              item.isLastInGroup ? 'mb-2.5' : 'mb-0.5'
                            }`}
                          >
                            <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
                              {!isMe && (
                                <div className="w-8 h-8 shrink-0 flex items-center justify-center">
                                  {item.isLastInGroup && (
                                    partnerPhoto ? (
                                      <img
                                        src={partnerPhoto}
                                        alt={selectedMatch?.otherUserName || 'Partner'}
                                        className="w-8 h-8 rounded-full object-cover border border-[#21262D]"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-[#1A1A2E] border border-[#21262D] flex items-center justify-center text-xs font-bold text-[#A8A49E]">
                                        {(selectedMatch?.otherUserName || 'K').charAt(0)}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            {isDeleted ? (
                              <div className="px-3.5 py-1.5 rounded-2xl text-xs italic bg-[#161B22] border border-[#21262D] text-[#8B949E] flex items-center gap-1.5">
                                <Trash2 className="w-3 h-3 text-[#6E7681]" />
                                <span>{t('chat.deletedMessage')}</span>
                              </div>
                            ) : (
                              <div
                                className="relative group/bubble max-w-[78%]"
                                onDoubleClick={() => handleToggleReaction(msg.id, '❤️')}
                              >
                                {msg.mediaType === 'gift' ? (
                                  <div className="px-5 py-3 rounded-2xl bg-gradient-to-br from-[#C9A84C]/25 to-[#2563EB]/25 border border-[#C9A84C]/50 text-center shadow-lg">
                                    <div className="text-3xl mb-1">
                                      {msg.mediaUrl === 'crown' ? '👑' : msg.mediaUrl === 'champagne' ? '🥂' : '🌹'}
                                    </div>
                                    <div className="text-xs font-bold text-[#F0EDE6]">{msg.content}</div>
                                  </div>
                                ) : msg.mediaType === 'voice' ? (
                                  <button
                                    type="button"
                                    onClick={() => handlePlayChatVoice(msg.id, msg.mediaUrl)}
                                    className={`px-4 py-2.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold cursor-pointer ${
                                      isMe
                                        ? 'bg-[#2563EB] text-[#F0EDE6]'
                                        : 'bg-[#1A1A2E] border border-[#21262D] text-[#F0EDE6]'
                                    }`}
                                  >
                                    {playingChatVoiceId === msg.id ? (
                                      <Pause className="w-4 h-4 fill-current" />
                                    ) : (
                                      <Play className="w-4 h-4 fill-current" />
                                    )}
                                    <Volume2 className="w-4 h-4 opacity-80" />
                                    <span>{t('playground.recordVoice')}</span>
                                  </button>
                                ) : msg.mediaType === 'date_invite' && msg.gameData ? (
                                  (() => {
                                    const status = msg.gameData.answers?.status || 'pending';
                                    const inviteId = msg.gameData.answers?.inviteId || msg.mediaUrl || '';
                                    return (
                                      <div className="px-4 py-3 rounded-2xl bg-[#161B22] border border-[#38BDF8]/50 text-[#F0EDE6] space-y-2 min-w-[220px]">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#38BDF8] uppercase tracking-wider">
                                          <MapPin className="w-3.5 h-3.5" />
                                          <span>{t('dates.title')}</span>
                                        </div>
                                        <p className="text-sm font-semibold">{msg.gameData.question}</p>
                                        {status === 'pending' && !isMe ? (
                                          <div className="flex items-center gap-2 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => handleRespondDateInvite(msg.id, inviteId, 'accept')}
                                              className="flex-1 py-1.5 rounded-lg bg-[#3FB950] text-[#0D1117] text-xs font-bold cursor-pointer"
                                            >
                                              {t('dates.accept')}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleRespondDateInvite(msg.id, inviteId, 'decline')}
                                              className="px-3 py-1.5 rounded-lg bg-[#21262D] text-[#A8A49E] text-xs font-bold cursor-pointer"
                                            >
                                              {t('dates.decline')}
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col gap-1.5">
                                            <span className={`inline-block text-[11px] font-bold ${status === 'accepted' ? 'text-[#3FB950]' : 'text-[#8B949E]'}`}>
                                              {status === 'accepted' ? t('dates.accepted') : status === 'declined' ? t('dates.declined') : '...'}
                                            </span>
                                            {status === 'accepted' && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const text = encodeURIComponent(
                                                    t('safety.shareDateText', {
                                                      name: selectedMatch?.otherUserName || 'kinn Member',
                                                      spot: msg.gameData?.question || '',
                                                      time: '',
                                                      link: `https://kinn.ink/p/${selectedMatch?.otherUserId || ''}`,
                                                    })
                                                  );
                                                  window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
                                                }}
                                                className="px-2.5 py-1 rounded-lg bg-[#2563EB]/20 border border-[#38BDF8]/40 text-[#38BDF8] text-[10px] font-bold text-left cursor-pointer"
                                              >
                                                {t('safety.shareDateBestie')}
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : msg.mediaType === 'game_prompt' && msg.gameData ? (
                                  (() => {
                                    const answers = msg.gameData.answers || {};
                                    const myAns = user?.id ? answers[user.id] : undefined;
                                    const otherId = selectedMatch?.otherUserId;
                                    const otherAns = otherId ? answers[otherId] : Object.entries(answers).find(([k]) => k !== user?.id)?.[1];
                                    const bothAnswered = Boolean(myAns && otherAns);
                                    return (
                                      <div className="px-4 py-3 rounded-2xl bg-[#161B22] border border-[#C9A84C]/50 text-[#F0EDE6] space-y-2 min-w-[220px]">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#C9A84C] uppercase tracking-wider">
                                          <Dices className="w-3.5 h-3.5" />
                                          <span>{t('playground.questionGame')}</span>
                                        </div>
                                        <p className={`text-sm font-semibold ${!bothAnswered ? 'blur-[3px] select-none' : ''}`}>
                                          {msg.gameData.question}
                                        </p>
                                        {bothAnswered ? (
                                          <div className="space-y-1.5 pt-1 border-t border-[#21262D] text-xs">
                                            <p><span className="text-[#38BDF8] font-bold">You:</span> {myAns}</p>
                                            <p><span className="text-[#C9A84C] font-bold">{selectedMatch?.otherUserName?.split(' ')[0] || 'Match'}:</span> {otherAns}</p>
                                          </div>
                                        ) : myAns ? (
                                          <p className="text-[11px] text-[#8B949E]">{t('playground.waitingPartnerAnswer')}</p>
                                        ) : (
                                          <div className="flex items-center gap-1.5 pt-1">
                                            <input
                                              type="text"
                                              value={gameAnswersDraft[msg.id] || ''}
                                              onChange={(e) => setGameAnswersDraft((prev) => ({ ...prev, [msg.id]: e.target.value }))}
                                              placeholder={t('playground.yourAnswer')}
                                              className="flex-1 bg-[#0D1117] border border-[#21262D] rounded-lg px-2.5 py-1.5 text-xs text-[#F0EDE6] outline-none"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleSubmitGameAnswer(msg.id)}
                                              className="px-2.5 py-1.5 rounded-lg bg-[#C9A84C] text-[#0D1117] text-xs font-bold cursor-pointer"
                                            >
                                              {t('playground.submitAnswer')}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <div
                                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                                      isMe
                                        ? 'bg-[#2563EB] text-[#F0EDE6] rounded-br-xs'
                                        : 'bg-[#1A1A2E] border border-[#21262D] text-[#F0EDE6] rounded-bl-xs'
                                    }`}
                                  >
                                    {msg.replyTo && (
                                      <div className="text-[11px] bg-black/25 border-l-2 border-[#93C5FD] pl-2 py-1 mb-2 rounded-r text-[#CBD5E1] truncate">
                                        <span className="font-semibold block text-[10px] text-[#BFDBFE]">
                                          {msg.replyTo.senderId === user?.id || msg.replyTo.senderId === 'me'
                                            ? t('chat.replyingTo')
                                            : t('chat.reply')}
                                        </span>
                                        <span className="truncate block opacity-90">{msg.replyTo.content || t('chat.deletedMessage')}</span>
                                      </div>
                                    )}
                                    {msg.content}
                                  </div>
                                )}

                                {/* Reaction Pills */}
                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                  <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    {Object.entries(msg.reactions).map(([emoji, users]) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleToggleReaction(msg.id, emoji)}
                                        className={`px-1.5 py-0.5 rounded-full text-[11px] border flex items-center gap-1 cursor-pointer ${
                                          user?.id && users.includes(user.id)
                                            ? 'bg-[#2563EB]/25 border-[#2563EB] text-white'
                                            : 'bg-[#161B22] border-[#21262D] text-[#CBD5E1]'
                                        }`}
                                      >
                                        <span>{emoji}</span>
                                        {users.length > 1 && <span className="text-[10px]">{users.length}</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Hover action buttons + reaction picker */}
                                <div
                                  className={`absolute top-1/2 -translate-y-1/2 ${
                                    isMe ? '-left-36' : '-right-36'
                                  } hidden group-hover/bubble:flex items-center gap-0.5 bg-[#161B22] border border-[#21262D] rounded-full px-1.5 py-0.5 shadow-md z-10`}
                                >
                                  {['❤️', '😂', '🔥', '😮', '👏'].map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleToggleReaction(msg.id, emoji)}
                                      className="p-0.5 text-xs hover:scale-125 transition-transform cursor-pointer"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => handleStartReply(msg)}
                                    title={t('chat.reply')}
                                    className="p-1 hover:text-[#2563EB] text-[#8B949E] transition-colors cursor-pointer"
                                  >
                                    <Reply className="w-3.5 h-3.5" />
                                  </button>
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(msg)}
                                      title={t('chat.edit')}
                                      className="p-1 hover:text-[#C9A84C] text-[#8B949E] transition-colors cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {isMe && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMessage(msg.id)}
                                      title={t('chat.delete')}
                                      className="p-1 hover:text-[#FF6B6B] text-[#8B949E] transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                            </div>

                            {item.isLastInGroup && (
                              <div className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] text-[#8B949E] ${!isMe ? 'ml-10' : ''}`}>
                                <span>{item.timeText}</span>
                                {msg.editedAt && (
                                  <span className="italic text-[9px] text-[#6E7681]">({t('chat.edited')})</span>
                                )}
                                {isMe && (
                                  <span className="flex items-center gap-1">
                                    {msg.status === 'sending' ? (
                                      <Clock className="w-2.5 h-2.5 text-[#8B949E]" />
                                    ) : msg.status === 'failed' ? (
                                      <button
                                        type="button"
                                        onClick={() => handleSendMessage(msg.localPlaintext || msg.content, msg.id)}
                                        title={t('chat.retry')}
                                        className="text-red-400 hover:text-red-300 cursor-pointer"
                                      >
                                        <AlertCircle className="w-3 h-3 text-red-400" />
                                      </button>
                                    ) : msg.readAt || unlockedReadTimes[msg.id] ? (
                                      <span title={t('chat.read')} className="flex items-center gap-1">
                                        <CheckCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                                        {unlockedReadTimes[msg.id] && (
                                          <span className="text-[9px] text-[#22C55E]">
                                            {t('playground.seenAt', { time: formatMessageTime(unlockedReadTimes[msg.id]!) })}
                                          </span>
                                        )}
                                      </span>
                                    ) : msg.deliveredAt ? (
                                      <button
                                        type="button"
                                        onClick={handlePeekReadReceipt}
                                        title={t('playground.peekReadTime')}
                                        className="cursor-pointer hover:opacity-80"
                                      >
                                        <CheckCheck className="w-3.5 h-3.5 text-[#8B949E]" />
                                      </button>
                                    ) : (
                                      <span title={t('chat.sent')}><Check className="w-3 h-3 text-[#8B949E]" /></span>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* New Messages Pill */}
                  {showNewMessagesPill && (
                    <button
                      type="button"
                      onClick={() => {
                        scrollToBottom(true);
                        setShowNewMessagesPill(false);
                      }}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-[#2563EB] text-[#F0EDE6] text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-[#1A4DB8] transition-all cursor-pointer z-20"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                      <span>{t('matches.newMessages')}</span>
                    </button>
                  )}
                </div>

                {/* Replying banner */}
                {replyingToMessage && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#161B22] border-l-4 border-[#2563EB] rounded-lg text-xs text-[#CBD5E1] mx-1 mb-1">
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-semibold text-[11px] text-[#60A5FA]">{t('chat.replyingTo')}</span>
                      <span className="truncate text-[11px] text-[#8B949E]">{replyingToMessage.content}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingToMessage(null)}
                      className="p-1 text-[#8B949E] hover:text-[#F0EDE6] cursor-pointer"
                      title={t('chat.cancel')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Editing banner */}
                {editingMessage && (
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#161B22] border-l-4 border-[#C9A84C] rounded-lg text-xs text-[#CBD5E1] mx-1 mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Edit2 className="w-3.5 h-3.5 text-[#C9A84C]" />
                      <span className="font-semibold text-[11px] text-[#C9A84C]">{t('chat.editing')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessage(null);
                        setInputMessage('');
                        if (textareaRef.current) textareaRef.current.style.height = 'auto';
                      }}
                      className="p-1 text-[#8B949E] hover:text-[#F0EDE6] cursor-pointer"
                      title={t('chat.cancel')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Icebreaker Roulette (when no messages yet) */}
                {chatMessages.length === 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 px-1">
                    {[t('playground.icebreaker1'), t('playground.icebreaker2'), t('playground.icebreaker3')].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handleSendMessage(prompt)}
                        className="shrink-0 px-3 py-1.5 rounded-full bg-[#1A1A2E] border border-[#2563EB]/40 text-xs font-medium text-[#F0EDE6] hover:border-[#2563EB] transition-colors cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Gift Tray */}
                {giftTrayOpen && (
                  <div className="flex items-center justify-around gap-2 p-2 mb-2 rounded-2xl bg-[#161B22] border border-[#C9A84C]/40">
                    <button
                      type="button"
                      onClick={() => handleSendGift('rose')}
                      className="flex-1 py-2 px-2 rounded-xl bg-[#1A1A2E] hover:bg-[#2563EB]/20 text-xs font-bold text-[#F0EDE6] cursor-pointer"
                    >
                      {t('playground.giftRose')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendGift('champagne')}
                      className="flex-1 py-2 px-2 rounded-xl bg-[#1A1A2E] hover:bg-[#2563EB]/20 text-xs font-bold text-[#F0EDE6] cursor-pointer"
                    >
                      {t('playground.giftChampagne')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendGift('crown')}
                      className="flex-1 py-2 px-2 rounded-xl bg-[#1A1A2E] hover:bg-[#2563EB]/20 text-xs font-bold text-[#F0EDE6] cursor-pointer"
                    >
                      {t('playground.giftCrown')}
                    </button>
                  </div>
                )}

                {/* Gift Celebration Overlay */}
                {activeGiftOverlay && (
                  <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
                    <div className="text-7xl animate-bounce drop-shadow-2xl">
                      {activeGiftOverlay === 'crown' ? '👑' : activeGiftOverlay === 'champagne' ? '🥂' : '🌹'}
                    </div>
                  </div>
                )}

                {/* Expired Match Revive Banner OR Message Input Bar */}
                {selectedMatch?.expiresAt && new Date(selectedMatch.expiresAt).getTime() < Date.now() && !selectedMatch?.isRevived ? (
                  <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#21262D]">
                    <span className="text-xs font-semibold text-[#FF6B6B]">
                      {t('playground.matchExpired')}
                    </span>
                    <button
                      type="button"
                      onClick={handleReviveMatch}
                      className="px-4 py-2 rounded-full bg-[#C9A84C] text-[#0D1117] text-xs font-bold hover:opacity-90 cursor-pointer"
                    >
                      {t('playground.reviveMatch')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 pt-2 border-t border-[#21262D]">
                    <button
                      type="button"
                      onClick={() => setGiftTrayOpen((prev) => !prev)}
                      className="w-10 h-10 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#C9A84C] flex items-center justify-center hover:border-[#C9A84C] transition-colors cursor-pointer shrink-0 mb-0.5"
                      title={t('playground.giftRose')}
                    >
                      <Gift className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleChatVoiceRecord}
                      className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 mb-0.5 ${
                        chatRecording
                          ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444] animate-pulse'
                          : 'bg-[#1A1A2E] border-[#21262D] text-[#38BDF8] hover:border-[#38BDF8]'
                      }`}
                      title={chatRecording ? t('playground.recording') : t('playground.recordVoice')}
                    >
                      {chatRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      placeholder={t('matches.typeMessage')}
                      value={inputMessage}
                      maxLength={1000}
                      onChange={(e) => {
                        setInputMessage(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

                        const now = Date.now();
                        if (selectedMatch?.id && now - lastTypingSentRef.current > 3000 && wsRef.current?.readyState === WebSocket.OPEN) {
                          lastTypingSentRef.current = now;
                          wsRef.current.send(JSON.stringify({ type: 'typing', matchId: selectedMatch.id }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (inputMessage.trim() && !isSendingMessage) {
                            handleSendMessage();
                          }
                        }
                      }}
                      className="flex-1 bg-[#1A1A2E] border border-[#21262D] focus:border-[#2563EB] rounded-2xl px-4 py-2 text-sm text-[#F0EDE6] placeholder-[#4A4742] outline-none resize-none max-h-[120px] leading-relaxed"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={isSendingMessage || !inputMessage.trim()}
                      className="w-10 h-10 rounded-full bg-[#2563EB] text-[#F0EDE6] flex items-center justify-center hover:bg-[#1A4DB8] transition-colors disabled:opacity-40 cursor-pointer shrink-0 mb-0.5"
                      aria-label={t('matches.send')}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Report User Modal */}
                {reportingMatch && (
                  <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#1A1A2E] border border-[#21262D] rounded-2xl p-5 max-w-sm w-full flex flex-col gap-4 shadow-xl">
                      <div className="flex items-center justify-between">
                        <h3 className="font-serif text-base font-bold text-[#F0EDE6] flex items-center gap-2">
                          <Flag className="w-4 h-4 text-[#FF6B6B]" />
                          <span>{t('chat.report')}</span>
                        </h3>
                        <button
                          type="button"
                          onClick={() => setReportingMatch(null)}
                          className="text-[#8B949E] hover:text-[#F0EDE6] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {reportSuccess ? (
                        <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                          <span className="text-sm font-semibold text-[#F0EDE6]">{t('chat.reportSubmitted')}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-[#8B949E]">{t('chat.selectReason')}</span>
                            {(['harassment', 'wrong_intent', 'fake_profile', 'other'] as const).map((r) => {
                              const labelKey = r === 'harassment' ? 'chat.reasonHarassment'
                                : r === 'wrong_intent' ? 'chat.reasonInappropriate'
                                : r === 'fake_profile' ? 'chat.reasonFake'
                                : 'chat.reasonOther';
                              return (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setReportReason(r)}
                                  className={`py-2 px-3 rounded-xl border text-left text-xs font-medium transition-colors cursor-pointer ${
                                    reportReason === r
                                      ? 'border-[#2563EB] bg-[#2563EB]/15 text-[#F0EDE6]'
                                      : 'border-[#21262D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0EDE6]'
                                  }`}
                                >
                                  {t(labelKey)}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setReportingMatch(null)}
                              className="flex-1 py-2 px-3 border border-[#21262D] text-[#8B949E] hover:text-[#F0EDE6] rounded-xl text-xs font-semibold cursor-pointer"
                            >
                              {t('chat.cancel')}
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmitReport}
                              disabled={isSubmittingReport}
                              className="flex-1 py-2 px-3 bg-[#FF6B6B] hover:bg-[#FF5252] text-white rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              {isSubmittingReport && <Loader2 className="w-3 h-3 animate-spin" />}
                              <span>{t('chat.report')}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
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

        {/* TAB: ADMIRERS (LIKES YOU) */}
        {activeTab === 'admirers' && (
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-[#FF6B6B] fill-current" />
                <h2 className="font-serif text-lg font-bold text-[#F0EDE6]">
                  {t('admirers.tabTitle')}
                </h2>
                {admirersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FF6B6B]/20 text-[#FF6B6B] text-xs font-bold">
                    {admirersCount}
                  </span>
                )}
              </div>
              {isAdmirersUnblurred && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#3FB950]/15 border border-[#3FB950]/40 text-[#3FB950] text-[10px] font-bold">
                  {t('admirers.unblurredBadge')}
                </span>
              )}
            </div>

            {/* Received Photo Compliments */}
            {photoCompliments.length > 0 && (
              <div className="flex flex-col gap-2">
                {photoCompliments.map((c) => (
                  <div key={c.id} className="px-3.5 py-2.5 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/40 flex items-center gap-2">
                    <span className="text-xs font-bold text-[#C9A84C]">{c.senderFirstName}:</span>
                    <span className="text-xs text-[#F0EDE6] italic truncate">"{c.commentText}"</span>
                  </div>
                ))}
              </div>
            )}

            {/* Name Search & Who Searched Your Name (300 RWF) */}
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchName(e.target.value)}
                placeholder={t('search.placeholder')}
                className="w-full bg-[#1A1A2E] border border-[#21262D] focus:border-[#2563EB] rounded-xl px-3.5 py-2 text-xs text-[#F0EDE6] placeholder-[#4A4742] outline-none"
              />
              {searchResults.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {searchResults.map((r) => (
                    <div key={r.id} className="shrink-0 px-3 py-1.5 rounded-xl bg-[#1A1A2E] border border-[#21262D] text-xs text-[#F0EDE6] flex items-center gap-1.5">
                      <span className="font-semibold">{r.firstName}</span>
                      <span className="text-[10px] text-[#8B949E]">{r.campus}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchCount > 0 && (
                <div className="p-3 rounded-2xl bg-[#161B22] border border-[#C9A84C]/40 flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#F0EDE6]">
                      🔎 {t('search.searchedYouCount', { count: searchCount })}
                    </span>
                    {searchesUnmasked && revealedSearchers.length > 0 && (
                      <span className="text-[11px] text-[#38BDF8] mt-0.5">
                        {revealedSearchers.map((s) => s.firstName).join(', ')}
                      </span>
                    )}
                  </div>
                  {!searchesUnmasked && (
                    <button
                      type="button"
                      onClick={handleRevealSearches}
                      className="px-3 py-1.5 rounded-full bg-[#C9A84C] text-[#0D1117] text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      {t('search.revealCta')}
                    </button>
                  )}
                </div>
              )}
            </div>

            {admirers.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center py-14 gap-3 text-center">
                <Heart className="w-10 h-10 text-[#4A4742]" />
                <span className="text-sm font-semibold text-[#A8A49E]">{t('admirers.emptyTitle')}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pb-20">
                {admirers.map((adm) => (
                  <div
                    key={adm.id}
                    className="rounded-2xl bg-[#1A1A2E] border border-[#21262D] overflow-hidden flex flex-col relative shadow-lg"
                  >
                    <div className="relative h-44 w-full bg-[#242438] overflow-hidden">
                      {adm.photoUrl ? (
                        <img
                          src={adm.photoUrl}
                          alt={adm.displayName || t('admirers.secretAdmirer')}
                          className={`w-full h-full object-cover transition-all ${
                            !isAdmirersUnblurred ? 'blur-lg scale-110' : ''
                          }`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-10 h-10 text-[#4A4742]" />
                        </div>
                      )}
                      {!isAdmirersUnblurred && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-[#0D1117]/80 border border-[#C9A84C] flex items-center justify-center text-[#C9A84C]">
                            <Lock className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 right-2 flex justify-between">
                        <span className="bg-[#0D1117]/80 text-[#F0EDE6] text-[9px] font-semibold px-2 py-0.5 rounded-full">
                          {getIntentBadgeLabel(adm.primaryIntent, t)}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-[#F0EDE6] truncate">
                          {isAdmirersUnblurred
                            ? `${adm.displayName || t('admirers.secretAdmirer')}${adm.age ? `, ${adm.age}` : ''}`
                            : t('admirers.secretAdmirer')}
                        </span>
                        {adm.isVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />}
                      </div>
                      <span className="text-[10px] text-[#8B949E] truncate">{adm.campus}</span>
                      {isAdmirersUnblurred && (
                        <button
                          type="button"
                          onClick={() => handleInstantMatch(adm.id)}
                          disabled={matchingAdmirerId === adm.id}
                          className="mt-1 w-full py-1.5 rounded-xl bg-[#3FB950] text-[#0D1117] text-xs font-bold hover:opacity-90 cursor-pointer"
                        >
                          {matchingAdmirerId === adm.id ? '...' : t('admirers.matchInstantly')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isAdmirersUnblurred && admirers.length > 0 && (
              <div className="sticky bottom-2 left-0 right-0 p-3 rounded-2xl bg-[#161B22]/95 backdrop-blur-md border border-[#C9A84C]/50 flex items-center justify-between gap-3 shadow-2xl">
                <span className="text-xs font-bold text-[#C9A84C]">{t('admirers.momoPay')}</span>
                <button
                  type="button"
                  onClick={handleUnblurAdmirers}
                  disabled={isUnblurringAdmirers}
                  className="px-4 py-2 rounded-full bg-[#C9A84C] text-[#0D1117] text-xs font-bold hover:opacity-95 cursor-pointer"
                >
                  {isUnblurringAdmirers ? '...' : t('admirers.unblurCta')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB: TRENDING (MOST WANTED) */}
        {activeTab === 'trending' && <TrendingView token={token} />}

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
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="bg-[#3FB950]/20 text-[#3FB950] text-[10px] font-bold px-2 py-0.5 rounded">
                      {t('profile.trustScore', { score: 50 })}
                    </span>
                    <span className="bg-[#2563EB]/20 text-[#2563EB] text-[10px] font-bold px-2 py-0.5 rounded">
                      {t('profile.urBadge')}
                    </span>
                    {isSelfieVerified ? (
                      <span className="bg-[#38BDF8]/20 text-[#38BDF8] text-[10px] font-bold px-2 py-0.5 rounded">
                        {t('trust.verified')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelfieModalOpen(true)}
                        className="bg-[#C9A84C] text-[#0D1117] text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer"
                      >
                        {t('trust.getVerified')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Free Tonight Toggle */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center justify-between">
                <span className="text-sm font-semibold text-[#F0EDE6]">{t('deck.freeTonight')}</span>
                <button
                  type="button"
                  onClick={handleToggleFreeTonight}
                  className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                    isFreeTonight ? 'bg-[#3FB950]' : 'bg-[#21262D]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      isFreeTonight ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Weekend Travel Passport (200 RWF) */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#F0EDE6]">{t('passport.title')}</span>
                  {passportCity && (
                    <span className="text-[11px] font-bold text-[#38BDF8]">
                      {t('passport.activeIn', { city: passportCity })}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {['Rubavu', 'Musanze', 'Huye'].map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => handleActivatePassport(city)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                        passportCity === city
                          ? 'bg-[#C9A84C] text-[#0D1117] border-[#C9A84C]'
                          : 'bg-[#161B22] text-[#F0EDE6] border-[#21262D]'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>

              {/* Incognito Mode & PWA Install */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-sm font-semibold text-[#F0EDE6]">{t('trust.incognito')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleIncognito}
                  className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                    isIncognito ? 'bg-[#2563EB]' : 'bg-[#21262D]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      isIncognito ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Hide Friends & Block Contacts */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-sm font-semibold text-[#F0EDE6]">{t('contacts.title')}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={blockPhoneInput}
                    onChange={(e) => setBlockPhoneInput(e.target.value)}
                    placeholder={t('contacts.placeholder')}
                    className="flex-1 bg-[#161B22] border border-[#21262D] focus:border-[#C9A84C] rounded-xl px-3 py-2 text-xs text-[#F0EDE6] placeholder-[#4A4742] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleBlockPhone}
                    disabled={blockingPhone || !blockPhoneInput.trim()}
                    className="px-3.5 py-2 rounded-xl bg-[#C9A84C] text-[#0D1117] text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {t('contacts.block')}
                  </button>
                </div>
                {'contacts' in navigator && 'ContactsManager' in window && (
                  <button
                    type="button"
                    onClick={handlePickContactsWeb}
                    disabled={blockingPhone}
                    className="w-full py-2 rounded-xl bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#38BDF8] text-xs font-bold cursor-pointer"
                  >
                    📖 {t('contacts.importButton')}
                  </button>
                )}
                <div className="flex flex-col gap-1.5">
                  <textarea
                    rows={2}
                    value={bulkPasteText}
                    onChange={(e) => setBulkPasteText(e.target.value)}
                    placeholder={t('contacts.bulkPastePlaceholder')}
                    className="w-full bg-[#161B22] border border-[#21262D] focus:border-[#C9A84C] rounded-xl px-3 py-2 text-xs text-[#F0EDE6] placeholder-[#4A4742] outline-none resize-none"
                  />
                  {bulkPasteText.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkBlockPaste}
                      disabled={blockingPhone}
                      className="self-end px-3 py-1.5 rounded-xl bg-[#C9A84C] text-[#0D1117] text-[11px] font-bold cursor-pointer"
                    >
                      {t('contacts.blockSelected')}
                    </button>
                  )}
                </div>
                {blockedContacts.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {blockedContacts.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#161B22] border border-[#21262D]">
                        <span className="text-xs text-[#F0EDE6] font-mono">{c.blockedPhone}</span>
                        <button
                          type="button"
                          onClick={() => handleUnblockPhone(c.id)}
                          className="text-[11px] font-semibold text-[#FF6B6B] hover:underline cursor-pointer"
                        >
                          {t('contacts.unblock')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleInstallPwa}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#161B22] border border-[#2563EB]/40 text-xs font-bold text-[#38BDF8] flex items-center justify-center gap-2 hover:border-[#38BDF8] cursor-pointer"
              >
                <span>📲 {t('pwa.install')}</span>
              </button>

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

              {/* Read Receipts Setting Row */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCheck className="w-5 h-5 text-[#A8A49E]" />
                  <span className="text-sm font-medium text-[#F0EDE6]">{t('profile.readReceipts')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleReadReceipts}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    readReceiptsEnabled ? 'bg-[#2563EB]' : 'bg-[#21262D]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      readReceiptsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Hide from People Setting Row */}
              <div className="p-4 bg-[#1A1A2E] border border-[#21262D] rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <EyeOff className="w-5 h-5 text-[#A8A49E]" />
                  <span className="text-sm font-medium text-[#F0EDE6]">{t('profile.hideFromPeople')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleHideFromPeople}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    hideFromPeople ? 'bg-[#2563EB]' : 'bg-[#21262D]'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      hideFromPeople ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
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
          onClick={() => setActiveTab('admirers')}
          className={`relative flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'admirers' ? 'text-[#FF6B6B]' : 'text-[#A8A49E]'
          }`}
        >
          <Heart className="w-5 h-5" />
          {admirersCount > 0 && (
            <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-[#FF6B6B] text-white text-[9px] font-bold">
              {admirersCount}
            </span>
          )}
          <span>{t('admirers.tabTitle')}</span>
        </button>

        <button
          onClick={() => setActiveTab('trending')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer ${
            activeTab === 'trending' ? 'text-[#C9A84C]' : 'text-[#A8A49E]'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span>{t('leaderboard.title')}</span>
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

      {/* CREATE POST MODAL */}
      {isCreatePostModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161B22] border border-[#21262D] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-[#21262D] flex items-center justify-between">
              <span className="font-bold text-sm text-[#F0EDE6]">{t('posts.newPost')}</span>
              <button
                onClick={() => {
                  setIsCreatePostModalOpen(false);
                  setCreatePostError(null);
                }}
                className="p-1 text-[#A8A49E] hover:text-[#F0EDE6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error banner */}
            {createPostError && (
              <div className="px-5 py-2 bg-red-500/15 border-b border-red-500/30 text-xs font-semibold text-red-400">
                {createPostError}
              </div>
            )}

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <textarea
                value={createPostText}
                onChange={(e) => setCreatePostText(e.target.value)}
                maxLength={200}
                placeholder={t('posts.textPlaceholder')}
                className="w-full h-28 bg-[#0D1117] border border-[#21262D] rounded-xl p-3 text-sm text-[#F0EDE6] placeholder-[#A8A49E]/60 focus:outline-none focus:border-[#C9A84C]/60 resize-none"
              />

              <div className="flex justify-end text-[11px] text-[#A8A49E]">
                <span>{createPostText.length}/200</span>
              </div>

              {/* Photo Preview & Upload */}
              <div className="flex items-center gap-3">
                {createPostPhotoPreviews.map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#21262D]">
                    <img src={url} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {createPostPhotos.length < 2 && (
                  <label className="w-20 h-20 rounded-xl border border-dashed border-[#21262D] hover:border-[#C9A84C]/50 flex flex-col items-center justify-center gap-1 cursor-pointer text-[#A8A49E] hover:text-[#C9A84C] transition-colors">
                    <Camera className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">{t('posts.addPhoto')}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-[#21262D] bg-[#0D1117] flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsCreatePostModalOpen(false);
                  setCreatePostError(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold text-[#A8A49E] hover:text-[#F0EDE6] cursor-pointer"
              >
                {t('matches.cancel')}
              </button>
              <button
                onClick={handleCreatePost}
                disabled={!createPostText.trim() || isSubmittingPost}
                className="flex items-center gap-1.5 bg-[#C9A84C] text-[#0D1117] font-bold px-4 py-1.5 rounded-full text-xs hover:bg-[#C9A84C]/90 transition-colors disabled:opacity-40 cursor-pointer shadow-md"
              >
                {isSubmittingPost && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{t('posts.publish')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST REPORT MODAL */}
      {postReportOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161B22] border border-[#21262D] rounded-2xl shadow-2xl p-5 space-y-4">
            <span className="font-bold text-sm text-[#F0EDE6] block">{t('posts.report')}</span>
            <div className="space-y-2">
              {[
                { id: 'post', label: t('posts.report') },
                { id: 'harassment', label: t('matches.reasonHarassment') },
                { id: 'inappropriate', label: t('matches.reasonInappropriate') },
                { id: 'fake', label: t('matches.reasonFake') },
                { id: 'other', label: t('matches.reasonOther') },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setPostReportReason(r.id)}
                  className={`w-full p-2.5 rounded-xl text-left text-xs flex items-center justify-between cursor-pointer border transition-colors ${
                    postReportReason === r.id
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C] font-bold'
                      : 'border-[#21262D] text-[#F0EDE6] hover:bg-white/5'
                  }`}
                >
                  <span>{r.label}</span>
                  {postReportReason === r.id && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPostReportOpen(false)}
                className="px-3 py-1.5 text-xs text-[#A8A49E] hover:text-[#F0EDE6] cursor-pointer"
              >
                {t('matches.cancel')}
              </button>
              <button
                onClick={handleReportPost}
                disabled={isSubmittingPostReport}
                className="bg-[#C9A84C] text-[#0D1117] font-bold px-4 py-1.5 rounded-full text-xs hover:bg-[#C9A84C]/90 transition-colors cursor-pointer"
              >
                {isSubmittingPostReport ? <Loader2 className="w-3 h-3 animate-spin" /> : t('matches.report')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compliment Sent Toast */}
      {complimentSentToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#3FB950] text-[#0D1117] text-xs font-bold shadow-xl">
          {t('compliment.sent')}
        </div>
      )}

      {/* Photo Compliment Modal (200 RWF) */}
      {complimentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161B22] border border-[#21262D] rounded-3xl p-5 flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-serif text-base font-bold text-[#F0EDE6]">{t('compliment.title')}</span>
              <button type="button" onClick={() => setComplimentModalOpen(false)} className="text-[#8B949E] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              maxLength={100}
              value={complimentText}
              onChange={(e) => setComplimentText(e.target.value)}
              placeholder={t('compliment.placeholder')}
              className="w-full bg-[#0D1117] border border-[#21262D] rounded-xl px-3.5 py-2.5 text-sm text-[#F0EDE6] outline-none"
            />
            <button
              type="button"
              onClick={handleSendPhotoCompliment}
              disabled={!complimentText.trim()}
              className="w-full py-2.5 rounded-full bg-[#C9A84C] text-[#0D1117] font-bold text-xs cursor-pointer disabled:opacity-40"
            >
              {t('compliment.send')}
            </button>
          </div>
        </div>
      )}

      {/* Curated Kigali Date Spot Picker Modal */}
      {dateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161B22] border border-[#21262D] rounded-3xl p-5 flex flex-col gap-3 max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-serif text-base font-bold text-[#F0EDE6]">📍 {t('dates.title')}</span>
              <button type="button" onClick={() => setDateModalOpen(false)} className="text-[#8B949E] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={dateTimeText}
              onChange={(e) => setDateTimeText(e.target.value)}
              placeholder={t('dates.timePlaceholder')}
              className="w-full bg-[#0D1117] border border-[#21262D] rounded-xl px-3.5 py-2 text-xs text-[#F0EDE6] outline-none"
            />
            <div className="flex flex-col gap-2">
              {dateSpots.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => handleSendDateInvite(spot)}
                  className="w-full p-3 rounded-2xl bg-[#1A1A2E] border border-[#21262D] hover:border-[#38BDF8] flex items-center justify-between text-left cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-bold text-[#F0EDE6]">{spot.emoji} {spot.name}</div>
                    <div className="text-[11px] text-[#8B949E]">{spot.area}</div>
                  </div>
                  <span className="text-xs font-bold text-[#38BDF8]">{t('dates.sendInvite')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selfie Verification Modal */}
      {selfieModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161B22] border border-[#21262D] rounded-3xl p-6 flex flex-col items-center text-center gap-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-[#38BDF8]/15 border border-[#38BDF8] flex items-center justify-center text-[#38BDF8]">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#F0EDE6]">{t('trust.smileCamera')}</h3>
            <button
              type="button"
              onClick={handleVerifySelfie}
              className="w-full py-3 rounded-full bg-[#38BDF8] text-[#0D1117] font-bold text-sm cursor-pointer"
            >
              {t('trust.verifyNow')}
            </button>
            <button type="button" onClick={() => setSelfieModalOpen(false)} className="text-xs text-[#8B949E] cursor-pointer">
              {t('chat.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* iOS PWA Install Modal */}
      {showIosPwaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#161B22] border border-[#21262D] rounded-3xl p-5 flex flex-col items-center text-center gap-3 shadow-2xl">
            <h3 className="font-serif text-base font-bold text-[#F0EDE6]">📲 {t('pwa.install')}</h3>
            <div className="text-xs text-[#CBD5E1] space-y-1.5">
              <p>1. {t('pwa.iosStep1')}</p>
              <p>2. {t('pwa.iosStep2')}</p>
            </div>
            <button type="button" onClick={() => setShowIosPwaModal(false)} className="text-xs text-[#38BDF8] font-bold cursor-pointer">
              OK
            </button>
          </div>
        </div>
      )}
      <RushModal
        open={rushModalOpen}
        onClose={() => setRushModalOpen(false)}
        token={token}
        currentUserId={user?.id}
        onMatched={(matchId) => {
          setActiveTab('matches');
          if (matchId) {
            setSelectedMatch({ id: matchId } as any);
          }
        }}
      />
    </div>
  );
}
