import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';

export interface FeedPostItem {
  postId: string;
  photoUrl: string;
  photoUrls?: string[];
  caption: string;
  locationName: string;
  likesCount: number;
  viewsCount?: number;
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

const RWANDA_SPOTS = [
  'Question Coffee, Gishushu',
  'Rubia Coffee, Kimihurura',
  'Lake Kivu, Rubavu',
  'UR Huye Campus',
  'Kigali',
];

const LIFESTYLE_TAGS = ['Afrobeats', 'Coffee', 'Fashion', 'Travel', 'Fitness', 'Tech'];

export function DatingFeed({ token, onCompliment, onMatched, onReport }: DatingFeedProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<FeedPostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [burstPostId, setBurstPostId] = useState<string | null>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [carouselIdx, setCarouselIdx] = useState<Record<string, number>>({});
  const [locationFilter, setLocationFilter] = useState<string | null>(null);

  // Create Post modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [newLocation, setNewLocation] = useState('Question Coffee, Gishushu');
  const [newTags, setNewTags] = useState<string[]>(['Coffee']);
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const loadFeed = useCallback(
    async (offset = 0, append = false, locFilter: string | null = locationFilter) => {
      if (!token) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '12', offset: String(offset) });
        if (locFilter) params.set('location', locFilter);
        const res = await apiFetch(`/api/feed?${params.toString()}`, {
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
    [token, locationFilter],
  );

  useEffect(() => {
    loadFeed(0, false, locationFilter);
  }, [loadFeed, locationFilter]);

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

  async function handleFileSelect(files: FileList | null) {
    if (!files || !token) return;
    const remaining = 5 - newPhotoUrls.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length === 0) return;

    setUploadingPhoto(true);
    setCreateError(null);
    for (const file of selected) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiFetch('/api/posts/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          const url = data?.url || data?.storagePath;
          if (url) setNewPhotoUrls((prev) => [...prev, url].slice(0, 5));
        }
      } catch {}
    }
    setUploadingPhoto(false);
  }

  async function handleCreatePost() {
    if (!token || creating) return;
    setCreateError(null);
    setCreating(true);
    try {
      const res = await apiFetch('/api/feed/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          photoUrls: newPhotoUrls,
          caption: newCaption.trim(),
          locationName: newLocation,
          tags: newTags,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCreateError(
          err?.error === 'policy_violation'
            ? t('discover.policyBlocked')
            : err?.message || 'Error',
        );
      } else {
        setCreateOpen(false);
        setNewCaption('');
        setNewPhotoUrls([]);
        await loadFeed(0, false, locationFilter);
      }
    } catch {
      setCreateError('Error');
    }
    setCreating(false);
  }

  function formatIntentLabel(intent: string): string {
    const val = (intent || '').toLowerCase();
    if (val.includes('marriage')) return `💍 ${t('intent.marriage')}`;
    if (val.includes('casual')) return `✨ ${t('intent.casual')}`;
    return `❤️ ${t('intent.serious')}`;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Minimal Filter + 1-Tap Create Post Row */}
      <div className="px-4 py-2 border-b border-[#21262D] flex items-center justify-between gap-2 bg-[#0D1117] shrink-0">
        {locationFilter ? (
          <button
            type="button"
            onClick={() => setLocationFilter(null)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#38BDF8] text-[11px] font-bold cursor-pointer"
          >
            <span>📍 {locationFilter}</span>
            <X className="w-3 h-3" />
          </button>
        ) : (
          <span className="text-[11px] font-semibold text-[#8B949E]">
            {t('discover.feed')}
          </span>
        )}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#C9A84C] text-[#0D1117] text-xs font-bold hover:opacity-90 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('posts.createPost')}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-[#C9A84C] animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center gap-2">
          <Heart className="w-10 h-10 text-[#4A4742]" />
          <p className="text-sm font-semibold text-[#A8A49E]">{t('discover.noMoreTitle')}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-[#21262D]">
          {posts.map((post) => {
            const photos = post.photoUrls && post.photoUrls.length > 0 ? post.photoUrls : [post.photoUrl];
            const idx = carouselIdx[post.postId] ?? 0;
            const currentPhoto = photos[idx] || photos[0];

            return (
              <article key={post.postId} className="flex flex-col bg-[#0D1117]">
                {/* Post Header */}
                <div className="px-4 py-3 flex items-center justify-between gap-2 relative">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-[38px] h-[38px] rounded-full p-0.5 bg-gradient-to-tr from-[#3FB950] via-[#C9A84C] to-[#FF6B6B] shrink-0">
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
                        <button
                          type="button"
                          onClick={() => setLocationFilter(post.locationName || post.user.neighborhood)}
                          className="flex items-center gap-0.5 hover:text-[#38BDF8] cursor-pointer"
                        >
                          <MapPin className="w-3 h-3 text-[#38BDF8]" />
                          <span>{post.locationName || post.user.neighborhood}</span>
                        </button>
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

                {/* Multi-Photo Carousel with Double-Tap Heart */}
                <div
                  className="relative w-full aspect-[4/5] bg-[#161B22] select-none overflow-hidden cursor-pointer"
                  onDoubleClick={() => handleLikePost(post, true)}
                  onTouchStart={(e) => {
                    touchStartXRef.current = e.touches[0]?.clientX ?? null;
                  }}
                  onTouchEnd={(e) => {
                    if (touchStartXRef.current === null || photos.length <= 1) return;
                    const diff = (e.changedTouches[0]?.clientX ?? 0) - touchStartXRef.current;
                    touchStartXRef.current = null;
                    if (Math.abs(diff) > 40) {
                      setCarouselIdx((prev) => ({
                        ...prev,
                        [post.postId]:
                          diff < 0
                            ? Math.min(idx + 1, photos.length - 1)
                            : Math.max(idx - 1, 0),
                      }));
                    }
                  }}
                >
                  <img
                    src={currentPhoto}
                    alt={post.user.displayName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />

                  {photos.length > 1 && (
                    <>
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
                        {idx + 1} / {photos.length}
                      </span>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCarouselIdx((prev) => ({ ...prev, [post.postId]: idx - 1 }));
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                      {idx < photos.length - 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCarouselIdx((prev) => ({ ...prev, [post.postId]: idx + 1 }));
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}

                  {burstPostId === post.postId && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/15">
                      <Heart className="w-24 h-24 text-[#FF6B6B] fill-current drop-shadow-[0_0_24px_rgba(255,107,107,0.85)] animate-ping" />
                    </div>
                  )}
                </div>

                {/* Carousel Dots */}
                {photos.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 pt-2">
                    {photos.map((_, dIdx) => (
                      <button
                        key={dIdx}
                        type="button"
                        onClick={() => setCarouselIdx((prev) => ({ ...prev, [post.postId]: dIdx }))}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          dIdx === idx ? 'w-4 bg-[#38BDF8]' : 'w-1.5 bg-[#30363D]'
                        }`}
                      />
                    ))}
                  </div>
                )}

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

                {/* Dating Badges, Likes, Views & Caption */}
                <div className="px-4 pb-4 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2.5 text-[11px] font-semibold">
                    <span className="px-2 py-0.5 rounded-full bg-[#1A1A2E] border border-[#21262D] text-[#F0EDE6]">
                      {formatIntentLabel(post.user.primaryIntent)}
                    </span>
                    <span className="text-[#A8A49E]">{post.likesCount} ♥</span>
                    <span className="text-[#8B949E] flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {t('discover.views', { count: post.viewsCount ?? 1 })}
                    </span>
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
            );
          })}

          {hasMore && (
            <div className="py-4 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => loadFeed(posts.length, true, locationFilter)}
                className="px-5 py-2 rounded-full bg-[#161B22] border border-[#21262D] text-xs font-bold text-[#C9A84C] cursor-pointer"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 1-Tap Create Lifestyle Post Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#161B22] border border-[#21262D] rounded-3xl p-5 flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-[#F0EDE6]">{t('posts.createPost')}</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-[#8B949E] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="px-3 py-2 rounded-xl bg-[#FF6B6B]/15 border border-[#FF6B6B]/40 text-xs font-semibold text-[#FF6B6B]">
                {createError}
              </div>
            )}

            {/* Up to 5 Photos */}
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {newPhotoUrls.map((url, i) => (
                <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-[#21262D]">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setNewPhotoUrls((prev) => prev.filter((_, idx2) => idx2 !== i))}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center text-[10px]"
                  >
                    ×
                  </button>
                </div>
              ))}
              {newPhotoUrls.length < 5 && (
                <label className="w-14 h-14 rounded-xl border-2 border-dashed border-[#30363D] flex flex-col items-center justify-center text-[#C9A84C] cursor-pointer shrink-0">
                  {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                </label>
              )}
            </div>

            <textarea
              rows={3}
              value={newCaption}
              onChange={(e) => setNewCaption(e.target.value)}
              placeholder={t('posts.captionPlaceholder', { defaultValue: '...' })}
              maxLength={200}
              className="w-full bg-[#0D1117] border border-[#21262D] rounded-xl px-3 py-2 text-xs text-[#F0EDE6] outline-none resize-none"
            />

            <select
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="w-full bg-[#0D1117] border border-[#21262D] rounded-xl px-3 py-2 text-xs text-[#F0EDE6] outline-none"
            >
              {RWANDA_SPOTS.map((spot) => (
                <option key={spot} value={spot}>
                  📍 {spot}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-1.5">
              {LIFESTYLE_TAGS.map((tag) => {
                const active = newTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setNewTags((prev) =>
                        active ? prev.filter((x) => x !== tag) : [...prev, tag].slice(0, 4),
                      )
                    }
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
                      active
                        ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#38BDF8]'
                        : 'bg-[#0D1117] border-[#21262D] text-[#8B949E]'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={creating || newPhotoUrls.length === 0 || !newCaption.trim()}
              onClick={handleCreatePost}
              className="w-full py-2.5 rounded-full bg-[#C9A84C] text-[#0D1117] text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('posts.createPost')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
