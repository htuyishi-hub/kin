-- =============================================================================
-- KIN DATING PLATFORM: CHAT MODERNIZATION (PART 2)
-- Migration: 20261123180000_chat_modernization_part2.sql
-- =============================================================================
-- 1. Alter messages table: reply_to_id, edited_at, deleted_at, delivered_at
-- 2. Alter profiles table: read_receipts_enabled
-- 3. Create message_edits table: audit trail of edits for trust & safety

-- 1. ALTER MESSAGES TABLE
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON public.messages(reply_to_id);

-- 2. ALTER PROFILES TABLE (READ RECEIPTS PREFERENCE)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN DEFAULT FALSE;

-- 3. CREATE MESSAGE_EDITS TABLE (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.message_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  previous_content TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_edits_message_id ON public.message_edits(message_id);

-- Enable RLS for message_edits
ALTER TABLE public.message_edits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'message_edits' AND policyname = 'Users can view message edits in their matches'
  ) THEN
    CREATE POLICY "Users can view message edits in their matches" ON public.message_edits
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.messages m
          JOIN public.matches match ON m.match_id = match.id
          WHERE m.id = message_edits.message_id
            AND (match.user_a = auth.uid() OR match.user_b = auth.uid())
        )
      );
  END IF;
END $$;
