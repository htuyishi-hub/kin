import React, { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, Heart, Sparkles, Coffee, Camera, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';

async function compressImageToDataUrl(file: File, maxDim = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function OnboardingOccupation() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [occupation, setOccupation] = useState('');
  const [intent, setIntent] = useState<'marriage' | 'long_term' | 'casual'>('marriage');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  // Restore saved profile, photos, or draft data
  React.useEffect(() => {
    let active = true;

    async function loadSavedData() {
      try {
        const rawDraft = localStorage.getItem('kin_occupation_draft');
        const draft = rawDraft ? JSON.parse(rawDraft) : null;

        let profile: any = null;
        if (token) {
          const [meRes, photosRes] = await Promise.all([
            apiFetch('/api/me', { headers: { Authorization: `Bearer ${token}` } }),
            apiFetch('/api/me/photos', { headers: { Authorization: `Bearer ${token}` } }),
          ]);
          if (meRes.ok) {
            try {
              profile = await meRes.json();
            } catch {}
          }
          if (photosRes.ok) {
            try {
              const photos = await photosRes.json();
              if (active && Array.isArray(photos) && photos.length > 0) {
                setHasPhoto(true);
                setPhotoPreview(photos[0].publicUrl || photos[0].storagePath || null);
              }
            } catch {}
          }
        }

        if (!active) return;

        const initialOcc = draft?.occupation || profile?.faculty || '';
        let initialIntent = draft?.intent || '';
        if (!initialIntent && profile?.primaryIntent) {
          const pi = String(profile.primaryIntent).toLowerCase();
          if (pi.includes('marriage')) initialIntent = 'marriage';
          else if (pi.includes('serious') || pi.includes('long')) initialIntent = 'long_term';
          else if (pi.includes('casual')) initialIntent = 'casual';
        }

        if (initialOcc && !occupation) setOccupation(initialOcc);
        if (initialIntent && !intent) setIntent(initialIntent as any);
      } catch {}
    }

    loadSavedData();
    return () => {
      active = false;
    };
  }, [token]);

  function saveDraft(occ: string, int: string) {
    try {
      localStorage.setItem('kin_occupation_draft', JSON.stringify({ occupation: occ, intent: int }));
    } catch {}
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setIsUploadingPhoto(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      const res = await apiFetch('/api/me/photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          publicUrl: dataUrl,
          base64Data: dataUrl,
          isPrimary: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || t('onboarding.personal.saveFailed'));
        return;
      }
      setPhotoPreview(dataUrl);
      setHasPhoto(true);
    } catch {
      setError(t('onboarding.personal.saveFailed'));
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!occupation.trim()) {
      setError(t('onboarding.occupation.selectOccupation'));
      return;
    }
    if (!hasPhoto) {
      setError(t('onboarding.occupation.photoRequired'));
      return;
    }

    setError('');
    setIsPending(true);
    saveDraft(occupation, intent);

    try {
      const res = await apiFetch('/api/me/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          occupation: occupation.trim(),
          primaryGoal: intent,
          locationType: occupation === 'Student' ? 'Campus' : 'City',
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) {
        setError(data?.message || t('onboarding.personal.saveFailed'));
        return;
      }

      localStorage.removeItem('kin_personal_draft');
      localStorage.removeItem('kin_occupation_draft');

      if (occupation === 'Student') {
        setLocation('/onboarding/ur');
      } else {
        setLocation('/app');
      }
    } catch (err: any) {
      setError(err?.message || t('onboarding.personal.saveFailed'));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 bg-[#0D1117] text-[#F0EDE6] select-none">
      {/* Step Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[#A8A49E]">
          <span className="font-semibold text-[#2563EB]">{t('onboarding.occupation.step')}</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-2/3 h-full bg-[#2563EB] rounded-full" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight mt-3">
          {t('onboarding.occupation.title')}
        </h1>
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 my-auto py-4">
        {/* Occupation input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.occupation.careerLabel')}
          </label>
          <input
            type="text"
            placeholder={t('onboarding.occupation.careerPlaceholder')}
            value={occupation}
            onChange={(e) => {
              setOccupation(e.target.value);
              setError('');
            }}
            className="w-full bg-[#1A1A2E] border-1.5 border-[#21262D] rounded-xl px-4 py-3 text-[#F0EDE6] placeholder-[#4A4742] outline-none focus:border-[#2563EB] font-medium"
          />
        </div>

        {/* Intent Cards */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.occupation.intentLabel')}
          </label>

          {/* Option 1: Marriage */}
          <div
            onClick={() => setIntent('marriage')}
            className={`p-3.5 rounded-xl border-1.5 flex items-center gap-3 cursor-pointer transition-all ${
              intent === 'marriage'
                ? 'border-[#C9A84C] bg-[#C9A84C]/10'
                : 'border-[#21262D] bg-[#1A1A2E]/60 hover:border-[#A8A49E]/40'
            }`}
          >
            <div className={`p-2 rounded-lg ${intent === 'marriage' ? 'bg-[#C9A84C] text-[#0D1117]' : 'bg-[#242438] text-[#C9A84C]'}`}>
              <Heart className="w-4 h-4 fill-current" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <span className="font-semibold text-sm text-[#F0EDE6]">{t('onboarding.occupation.seriousMarriage')}</span>
              <span className="text-[10px] font-bold text-[#C9A84C] bg-[#C9A84C]/20 px-2 py-0.5 rounded">{t('onboarding.occupation.tier1Badge')}</span>
            </div>
          </div>

          {/* Option 2: Long-term */}
          <div
            onClick={() => setIntent('long_term')}
            className={`p-3.5 rounded-xl border-1.5 flex items-center gap-3 cursor-pointer transition-all ${
              intent === 'long_term'
                ? 'border-[#2563EB] bg-[#2563EB]/10'
                : 'border-[#21262D] bg-[#1A1A2E]/60 hover:border-[#A8A49E]/40'
            }`}
          >
            <div className={`p-2 rounded-lg ${intent === 'long_term' ? 'bg-[#2563EB] text-[#F0EDE6]' : 'bg-[#242438] text-[#2563EB]'}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm text-[#F0EDE6]">{t('onboarding.occupation.longTerm')}</span>
            </div>
          </div>

          {/* Option 3: Casual */}
          <div
            onClick={() => setIntent('casual')}
            className={`p-3.5 rounded-xl border-1.5 flex items-center gap-3 cursor-pointer transition-all ${
              intent === 'casual'
                ? 'border-[#A8A49E] bg-white/5'
                : 'border-[#21262D] bg-[#1A1A2E]/60 hover:border-[#A8A49E]/40'
            }`}
          >
            <div className={`p-2 rounded-lg ${intent === 'casual' ? 'bg-[#A8A49E] text-[#0D1117]' : 'bg-[#242438] text-[#A8A49E]'}`}>
              <Coffee className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm text-[#F0EDE6]">{t('onboarding.occupation.casualDating')}</span>
            </div>
          </div>
        </div>

        {/* Mandatory Profile Photo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.occupation.photoLabel')}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPhoto}
            className={`w-full p-3 rounded-xl border-1.5 flex items-center gap-3 transition-all cursor-pointer ${
              hasPhoto
                ? 'border-[#3FB950] bg-[#3FB950]/10'
                : 'border-dashed border-[#21262D] bg-[#1A1A2E]/60 hover:border-[#2563EB]'
            }`}
          >
            {photoPreview ? (
              <img
                src={photoPreview}
                alt={t('onboarding.occupation.photoLabel')}
                className="w-11 h-11 rounded-lg object-cover border border-[#3FB950]"
              />
            ) : (
              <div className="w-11 h-11 rounded-lg bg-[#242438] flex items-center justify-center text-[#2563EB]">
                {isUploadingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </div>
            )}
            <div className="flex-1 text-left">
              <span className="text-sm font-semibold text-[#F0EDE6] block">
                {hasPhoto ? t('onboarding.occupation.photoUploaded') : t('onboarding.occupation.uploadPhoto')}
              </span>
            </div>
            {hasPhoto && <CheckCircle2 className="w-5 h-5 text-[#3FB950]" />}
          </button>
        </div>

        {error && <span className="text-xs text-[#FF6B6B] font-medium mt-1">{error}</span>}
      </form>

      {/* Continue Button */}
      <div className="pb-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || isUploadingPhoto || !hasPhoto}
          className="w-full h-13.5 bg-[#2563EB] text-[#F0EDE6] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#1A4DB8] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <span>{t('onboarding.occupation.finish')}</span>
          )}
        </button>
      </div>
    </div>
  );
}
