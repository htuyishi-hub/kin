import React, { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage } from '@workspace/i18n';
import { useAuth } from '@/contexts/AuthContext';

const MONTHS = [
  { value: '01', en: '01 - Jan', rw: '01 - Mut' },
  { value: '02', en: '02 - Feb', rw: '02 - Gas' },
  { value: '03', en: '03 - Mar', rw: '03 - Wer' },
  { value: '04', en: '04 - Apr', rw: '04 - Mat' },
  { value: '05', en: '05 - May', rw: '05 - Gic' },
  { value: '06', en: '06 - Jun', rw: '06 - Kam' },
  { value: '07', en: '07 - Jul', rw: '07 - Nya' },
  { value: '08', en: '08 - Aug', rw: '08 - Kan' },
  { value: '09', en: '09 - Sep', rw: '09 - Nze' },
  { value: '10', en: '10 - Oct', rw: '10 - Ukw' },
  { value: '11', en: '11 - Nov', rw: '11 - Ugu' },
  { value: '12', en: '12 - Dec', rw: '12 - Uku' },
];

export default function OnboardingPersonal() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { token } = useAuth();
  const isRw = getCurrentLanguage() === 'rw';

  const [fullName, setFullName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'female' | 'male' | ''>('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  // Restore saved profile or draft data
  React.useEffect(() => {
    let active = true;

    async function loadSavedData() {
      try {
        const rawDraft = localStorage.getItem('kin_personal_draft');
        const draft = rawDraft ? JSON.parse(rawDraft) : null;

        let profile: any = null;
        if (token) {
          const res = await fetch('/api/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            profile = await res.json();
          }
        }

        if (!active) return;

        const initialName = draft?.fullName || profile?.fullName || '';
        const rawGender = (draft?.gender || profile?.gender || '').toLowerCase();
        const initialGender = rawGender === 'male' || rawGender === 'female' ? rawGender : '';
        const rawDob = draft?.dob || profile?.dateOfBirth || '';

        if (initialName && !fullName) setFullName(initialName);
        if (initialGender && !gender) setGender(initialGender as any);

        if (rawDob && !dob) {
          const match = String(rawDob).match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            setDob(`${match[1]}-${match[2]}-${match[3]}`);
            setYear(match[1]);
            setMonth(match[2]);
            setDay(match[3]);
          }
        }
      } catch {}
    }

    loadSavedData();
    return () => {
      active = false;
    };
  }, [token]);

  function saveDraft(name: string, d: string, m: string, y: string, g: string) {
    const dobStr = d && m && y ? `${y}-${m}-${d}` : '';
    try {
      localStorage.setItem(
        'kin_personal_draft',
        JSON.stringify({ fullName: name, dob: dobStr, gender: g })
      );
    } catch {}
  }

  const maxYear = new Date().getFullYear() - 18;
  const minYear = 1940;

  const years = useMemo(() => {
    const list: string[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(String(y));
    }
    return list;
  }, [maxYear]);

  const maxDays = useMemo(() => {
    if (!month) return 31;
    const y = year ? parseInt(year, 10) : 2000;
    const m = parseInt(month, 10);
    return new Date(y, m, 0).getDate();
  }, [year, month]);

  const days = useMemo(() => {
    const list: string[] = [];
    for (let d = 1; d <= maxDays; d++) {
      list.push(d < 10 ? `0${d}` : String(d));
    }
    return list;
  }, [maxDays]);

  function updateDob(d: string, m: string, y: string) {
    if (d && m && y) {
      setDob(`${y}-${m}-${d}`);
      saveDraft(fullName, d, m, y, gender);
      setError('');
    } else {
      setDob('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError(t('onboarding.personal.enterFullName'));
      return;
    }
    if (!dob) {
      setError(t('onboarding.personal.selectDob'));
      return;
    }

    // Check age 18+
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    if (age < 18) {
      setError(t('onboarding.personal.mustBe18'));
      return;
    }

    if (!gender) {
      setError(t('onboarding.personal.selectGender'));
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          dateOfBirth: dob,
          gender,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'UNDERAGE') {
          setError(t('onboarding.personal.mustBe18'));
          return;
        }
        setError(data?.message || t('onboarding.personal.saveFailed'));
        return;
      }

      setLocation('/onboarding/occupation');
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
          <span className="font-semibold text-[#2563EB]">{t('onboarding.personal.step')}</span>
        </div>
        <div className="w-full h-1 bg-[#21262D] rounded-full overflow-hidden">
          <div className="w-1/3 h-full bg-[#2563EB] rounded-full" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-[#F0EDE6] leading-tight mt-3">
          {t('onboarding.personal.title')}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-auto py-4">
        {/* Full Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.personal.fullNameLabel')}
          </label>
          <input
            type="text"
            placeholder={t('onboarding.personal.fullNamePlaceholder')}
            value={fullName}
            onChange={(e) => {
              const val = e.target.value;
              setFullName(val);
              saveDraft(val, day, month, year, gender);
              setError('');
            }}
            className="w-full bg-[#1A1A2E] border-1.5 border-[#21262D] rounded-xl px-4 py-3 text-[#F0EDE6] placeholder-[#4A4742] outline-none focus:border-[#2563EB] font-medium"
          />
        </div>

        {/* Date of Birth */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.personal.dobLabel')}
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {/* Day */}
            <select
              value={day}
              onChange={(e) => {
                const newDay = e.target.value;
                setDay(newDay);
                updateDob(newDay, month, year);
              }}
              className="w-full bg-[#1A1A2E] border-1.5 border-[#21262D] rounded-xl px-3 py-3 text-[#F0EDE6] outline-none focus:border-[#2563EB] font-medium cursor-pointer"
            >
              <option value="" disabled>
                {t('onboarding.personal.dayLabel')}
              </option>
              {days.map((d) => (
                <option key={d} value={d} className="bg-[#1A1A2E] text-[#F0EDE6]">
                  {parseInt(d, 10)}
                </option>
              ))}
            </select>

            {/* Month */}
            <select
              value={month}
              onChange={(e) => {
                const newMonth = e.target.value;
                setMonth(newMonth);
                updateDob(day, newMonth, year);
              }}
              className="w-full bg-[#1A1A2E] border-1.5 border-[#21262D] rounded-xl px-3 py-3 text-[#F0EDE6] outline-none focus:border-[#2563EB] font-medium cursor-pointer"
            >
              <option value="" disabled>
                {t('onboarding.personal.monthLabel')}
              </option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value} className="bg-[#1A1A2E] text-[#F0EDE6]">
                  {isRw ? m.rw : m.en}
                </option>
              ))}
            </select>

            {/* Year */}
            <select
              value={year}
              onChange={(e) => {
                const newYear = e.target.value;
                setYear(newYear);
                updateDob(day, month, newYear);
              }}
              className="w-full bg-[#1A1A2E] border-1.5 border-[#21262D] rounded-xl px-3 py-3 text-[#F0EDE6] outline-none focus:border-[#2563EB] font-medium cursor-pointer"
            >
              <option value="" disabled>
                {t('onboarding.personal.yearLabel')}
              </option>
              {years.map((y) => (
                <option key={y} value={y} className="bg-[#1A1A2E] text-[#F0EDE6]">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>


        {/* Gender Selection */}
        <div className="flex flex-col gap-1.5 mt-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#A8A49E]">
            {t('onboarding.personal.genderLabel')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setGender('female');
                saveDraft(fullName, day, month, year, 'female');
                setError('');
              }}
              className={`py-3 rounded-xl border-1.5 font-semibold text-sm transition-all cursor-pointer ${
                gender === 'female'
                  ? 'border-[#2563EB] bg-[#2563EB]/15 text-[#F0EDE6]'
                  : 'border-[#21262D] bg-[#1A1A2E] text-[#A8A49E] hover:border-[#A8A49E]/40'
              }`}
            >
              {t('onboarding.personal.genderFemale')}
            </button>
            <button
              type="button"
              onClick={() => {
                setGender('male');
                saveDraft(fullName, day, month, year, 'male');
                setError('');
              }}
              className={`py-3 rounded-xl border-1.5 font-semibold text-sm transition-all cursor-pointer ${
                gender === 'male'
                  ? 'border-[#2563EB] bg-[#2563EB]/15 text-[#F0EDE6]'
                  : 'border-[#21262D] bg-[#1A1A2E] text-[#A8A49E] hover:border-[#A8A49E]/40'
              }`}
            >
              {t('onboarding.personal.genderMale')}
            </button>
          </div>
        </div>

        {error && <span className="text-xs text-[#FF6B6B] font-medium mt-1">{error}</span>}
      </form>

      {/* Next Button */}
      <div className="pb-2">
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full h-13.5 bg-[#2563EB] text-[#F0EDE6] rounded-full font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-[#1A4DB8] active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-lg"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          ) : (
            <span>{t('onboarding.personal.continue')}</span>
          )}
        </button>
      </div>
    </div>
  );
}
