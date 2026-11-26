import React, { useEffect, useState, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  BadgeCheck,
  MapPin,
  GraduationCap,
  Loader2,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';

export interface FeedPostItem {
  postId: string;
  photoUrl: string;
  caption: string;
  locationName: string;
  likesCount: number;
  createdAt: string;
  hasLiked: boolean;
  user: {
    id: string;
    displayName: string;
    age: number | null;
    avatarUrl: string | null;
    isVerified: boolean;
    campus: string | null;
    neighborhood: string;
    primaryIntent: string;
    tags: string[];
  };
}

interface DatingFeedProps {
  token: string | null;
  onCompliment: (userId: string) => void;
  onMatched: (matchId: string, partnerName?: string) => void;
  onReport?: (userId: string) => void;
}

export function DatingFeed({ token, onCompliment, onMatched, onReport }: DatingFeedProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<FeedPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [burstPostId, setBurstPostId] = useState<string | null>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);

  const loadFeed = useCallback(
    async (offset = 0, append = false) => {
      if (!token) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await apiFetch(`/api/feed?limit=12&offset=${offset}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.posts) ? data.posts : [];
          setPosts((prev) => (append ? [...prev, ...list] : list));
          setHasMore(Boolean(data?.hasMore));
        }
      } catch {}
      setLoading(false);
      setLoadingMore(false);
    },
    [token],
  );

  useEffect(() => {
    loadFeed(0, false);
  }, [loadFeed]);

  async function handleLikePost(post: FeedPostItem, showBurst = false) {
    if (!token) return;
    if (showBurst) {
      setBurstPostId(post.postId);
      setTimeout(() => setBurstPostId((cur) => (cur === post.postId ? null : cur)), 700);
    }
    if (!post.hasLiked) {
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === post.postId
            ? { ...p, hasLiked: true, likesCount: p.likesCount + 1 }
            : p,
        ),
      );
    }
    try {
      const res = await apiFetch('/api/feed/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postId: post.postId, targetUserId: post.user.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.isMatch && data?.matchId) {
          onMatched(data.matchId, data.partnerProfile?.displayName || post.user.displayName);
        }
      }
    } catch {}
  }

  function formatIntentLabel(intent: string): string {
    const val = (intent || '').toLowerCase();
    if (val.includes('marriage')) return `💍 ${t('intent.marriage')}`;
    if (val.includes('casual')) return `✨ ${t('intent.casual')}`;
    return `❤️ ${t('intent.serious')}`;
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 text-[#C9A84C] animate-spin" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
        <Heart className="w-10 h-10 text-[#4A4742]" />
        <p className="text-sm font-semibold text-[#A8A49E]">{t('discover.noMoreTitle')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto divide-y divide-[#21262D]">
      {posts.map((post) => (
        <article key={post.postId} className="flex flex-col bg-[#0D1117]">
          {/* Post Header */}
          <div className="px-4 py-3 flex items-center justify-between gap-2 relative">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-[#3FB950] via-[#C9A84C] to-[#FF6B6B] shrink-0">
                {post.user.avatarUrl ? (
                  <img
                    src={post.user.avatarUrl}
                    alt={post.user.displayName}
                    className="w-full h-full rounded-full object-cover border border-[#0D1117]"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#161B22] flex items-center justify-center">
                    <User className="w-4 h-4 text-[#A8A49E]" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-sm text-[#F0EDE6] truncate">
                    {post.user.displayName}
                    {post.user.age ? `, ${post.user.age}` : ''}
                  </span>
                  {post.user.isVerified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#8B949E] truncate">
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-3 h-3 text-[#38BDF8]" />
                    {post.user.neighborhood}
                  </span>
                  {post.user.campus && (
                    <span className="flex items-center gap-0.5 truncate">
                      <GraduationCap className="w-3 h-3 text-[#C9A84C]" />
                      {post.user.campus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMenuPostId((cur) => (cur === post.postId ? null : post.postId))}
              className="p-1.5 text-[#8B949E] hover:text-[#F0EDE6] cursor-pointer"
              aria-label={t('chatMenu.menu')}
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {menuPostId === post.postId && (
              <div className="absolute right-4 top-12 z-30 bg-[#161B22] border border-[#21262D] rounded-xl shadow-xl py-1 w-40">
                <button
                  type="button"
                  onClick={() => {
                    setMenuPostId(null);
                    const url = `https://kinn.ink/p/${post.user.id}`;
                    if (navigator.share) navigator.share({ url }).catch(() => {});
                    else window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-[#F0EDE6] hover:bg-[#1A1A2E] cursor-pointer"
                >
                  🔗 {t('deck.shareProfile')}
                </button>
                {onReport && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuPostId(null);
                      onReport(post.user.id);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-[#FF6B6B] hover:bg-[#1A1A2E] cursor-pointer"
                  >
                    🚩 {t('chat.report')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Full-Width Photo with Double-Tap Heart */}
          <div
            className="relative w-full aspect-[4/5] bg-[#161B22] select-none overflow-hidden cursor-pointer"
            onDoubleClick={() => handleLikePost(post, true)}
          >
            <img
              src={post.photoUrl}
              alt={post.user.displayName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {burstPostId === post.postId && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/15">
                <Heart className="w-24 h-24 text-[#FF6B6B] fill-current drop-shadow-[0_0_24px_rgba(255,107,107,0.85)] animate-ping" />
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleLikePost(post, true)}
                className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-transform active:scale-95 ${
                  post.hasLiked ? 'text-[#FF6B6B]' : 'text-[#F0EDE6] hover:text-[#FF6B6B]'
                }`}
              >
                <Heart className={`w-5 h-5 ${post.hasLiked ? 'fill-current' : ''}`} />
                <span>{t('discover.like')}</span>
              </button>

              <button
                type="button"
                onClick={() => onCompliment(post.user.id)}
                className="flex items-center gap-1 text-xs font-bold text-[#C9A84C] hover:opacity-85 cursor-pointer"
              >
                <MessageCircle className="w-5 h-5" />
                <span>200 RWF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  apiFetch('/api/deck/drink', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ targetUserId: post.user.id, drinkType: 'coffee' }),
                  }).catch(() => {});
                }}
                className="flex items-center gap-1 text-xs font-bold text-[#F0EDE6] hover:text-[#C9A84C] cursor-pointer"
              >
                <span className="text-base">☕</span>
                <span>100 RWF</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const url = `https://kinn.ink/p/${post.user.id}`;
                if (navigator.share) navigator.share({ url }).catch(() => {});
                else window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
              }}
              className="p-1.5 text-[#A8A49E] hover:text-[#F0EDE6] cursor-pointer"
              aria-label={t('deck.shareProfile')}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* Dating Badges & Caption */}
          <div className="px-4 pb-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <span className="px-2 py-0.5 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#F0EDE6]">
                {formatIntentLabel(post.user.primaryIntent)}
              </span>
              {post.likesCount > 0 && (
                <span className="text-[#A8A49E]">
                  {post.likesCount} ♥
                </span>
              )}
            </div>

            {post.caption && (
              <p className="text-xs text-[#F0EDE6] leading-relaxed">
                <span className="font-bold mr-1.5">{post.user.displayName}</span>
                {post.caption}
              </p>
            )}

            {post.user.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {post.user.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="text-[11px] text-[#38BDF8]">
                    #{t(`tags.${tag}`, { defaultValue: tag })}
                  </span>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}

      {hasMore && (
        <div className="py-4 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => loadFeed(posts.length, true)}
            className="px-5 py-2 rounded-full bg-[#161B22] border border-[#21262D] text-xs font-bold text-[#C9A84C] cursor-pointer"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
