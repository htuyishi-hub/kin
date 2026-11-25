-- KINN PLATFORM: SWIPE BONUS & CHAT PLAYGROUND MIGRATION
-- Idempotent migration for profiles, matches, messages, and chat_gifts

-- 1. Daily WhatsApp bonus swipes on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_swipes_today INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_swipes_date TEXT;

-- 2. Chat streaks & 72h revive on matches
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS streak_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_date TEXT,
  ADD COLUMN IF NOT EXISTS is_revived BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Rich media, emoji reactions, and Question Game state on messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS game_data JSONB;

-- 4. In-chat gifts table
CREATE TABLE IF NOT EXISTS public.chat_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL,
  amount_rwf INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_gifts_match_id_idx ON public.chat_gifts(match_id);

-- 5. Enable RLS on chat_gifts (policies for match participants)
ALTER TABLE public.chat_gifts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_gifts' AND policyname = 'chat_gifts_participants_read'
  ) THEN
    CREATE POLICY chat_gifts_participants_read ON public.chat_gifts
      FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
  END IF;
END $$;
