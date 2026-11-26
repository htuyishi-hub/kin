import React, { useEffect, useState, useCallback } from 'react';
import { Plus, X, Send, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api';

interface StoryItem {
  id: string;
  mediaUrl: string;
  caption: string | null;
  locationName: string | null;
  createdAt: string;
}

interface StoryGroup {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  facultyFlair: string | null;
  stories: StoryItem[];
}

export function StoriesBar({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<StoryGroup | null>(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [locationName, setLocationName] = useState('Kigali');
  const [posting, setPosting] = useState(false);

  const fetchStories = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch('/api/stories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d)) setGroups(d);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  async function handlePostStory() {
    if (!token) return;
    setPosting(true);
    try {
      const res = await apiFetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caption: caption.trim(), locationName: locationName.trim() }),
      });
      if (res.ok) {
        setAddOpen(false);
        setCaption('');
        await fetchStories();
      }
    } finally {
      setPosting(false);
    }
  }

  async function handleReply(giftType: 'rose' | 'none') {
    if (!token || !activeGroup) return;
    const currentStory = activeGroup.stories[storyIdx];
    if (!currentStory) return;
    await apiFetch(`/api/stories/${currentStory.id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageText: replyText.trim(), giftType }),
    }).catch(() => {});
    setReplyText('');
    setActiveGroup(null);
  }

  const currentStory = activeGroup?.stories[storyIdx];

  return (
    <>
      <div className="px-4 pt-2 pb-1 flex items-center gap-3 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="shrink-0 flex flex-col items-center gap-1 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-[#1A1A2E] border-2 border-dashed border-[#C9A84C]/60 flex items-center justify-center text-[#C9A84C]">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold text-[#A8A49E]">{t('stories.addStory')}</span>
        </button>

        {groups.map((g) => (
          <button
            key={g.userId}
            type="button"
            onClick={() => {
              setActiveGroup(g);
              setStoryIdx(0);
            }}
            className="shrink-0 flex flex-col items-center gap-1 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#FF6B6B] via-[#C9A84C] to-[#38BDF8]">
              {g.avatarUrl ? (
                <img src={g.avatarUrl} alt={g.displayName} className="w-full h-full rounded-full object-cover border border-[#0D1117]" />
              ) : (
                <div className="w-full h-full rounded-full bg-[#161B22]" />
              )}
            </div>
            <span className="text-[10px] font-semibold text-[#F0EDE6] max-w-[54px] truncate">{g.displayName}</span>
          </button>
        ))}
      </div>

      {/* Add Story Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#161B22] border border-[#21262D] rounded-3xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-[#F0EDE6]">{t('stories.addStory')}</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-[#8B949E] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="..."
              maxLength={140}
              className="w-full bg-[#0D1117] border border-[#21262D] rounded-xl px-3 py-2 text-xs text-[#F0EDE6] outline-none"
            />
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Kimihurura"
              maxLength={60}
              className="w-full bg-[#0D1117] border border-[#21262D] rounded-xl px-3 py-2 text-xs text-[#F0EDE6] outline-none"
            />
            <button
              type="button"
              onClick={handlePostStory}
              disabled={posting}
              className="w-full py-2.5 rounded-full bg-[#C9A84C] text-[#0D1117] text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {t('stories.postCta')}
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Story Viewer */}
      {activeGroup && currentStory && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4">
          <div className="flex flex-col gap-2">
            <div className="flex gap-1">
              {activeGroup.stories.map((s, idx) => (
                <div key={s.id} className={`h-1 flex-1 rounded-full ${idx <= storyIdx ? 'bg-white' : 'bg-white/30'}`} />
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{activeGroup.displayName}</span>
                {activeGroup.isVerified && <CheckCircle2 className="w-4 h-4 text-[#38BDF8]" />}
                {currentStory.locationName && (
                  <span className="text-[11px] text-[#CBD5E1]">📍 {currentStory.locationName}</span>
                )}
              </div>
              <button type="button" onClick={() => setActiveGroup(null)} className="text-white cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 my-3 rounded-2xl overflow-hidden relative flex items-center justify-center bg-[#161B22]"
            onClick={() => {
              if (storyIdx + 1 < activeGroup.stories.length) setStoryIdx(storyIdx + 1);
              else setActiveGroup(null);
            }}
          >
            <img src={currentStory.mediaUrl} alt="" className="w-full h-full object-cover" />
            {currentStory.caption && (
              <div className="absolute bottom-4 inset-x-4 p-3 rounded-xl bg-black/65 text-white text-sm text-center">
                {currentStory.caption}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t('stories.replyPlaceholder')}
              className="flex-1 bg-[#161B22] border border-[#21262D] rounded-full px-4 py-2.5 text-xs text-white outline-none"
            />
            <button
              type="button"
              onClick={() => handleReply('rose')}
              className="px-3.5 py-2.5 rounded-full bg-[#FF6B6B] text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              {t('stories.sendRose')}
            </button>
            <button
              type="button"
              onClick={() => handleReply('none')}
              className="p-2.5 rounded-full bg-[#2563EB] text-white shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
