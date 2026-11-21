-- Migration: 20261121190000_profile_extras_tags_bio_voice.sql
-- Description: Add optional profile extras (bio, tags, voice intro) with length/cardinality constraints
-- and RLS protection trigger preventing direct client-side updates to protected columns.

-- 1. ADD COLUMNS WITH CHECK CONSTRAINTS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS voice_intro_path text,
  ADD COLUMN IF NOT EXISTS voice_intro_duration_ms integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bio_max_length'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_bio_max_length
      CHECK (bio IS NULL OR char_length(bio) <= 140);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tags_max_count'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_tags_max_count
      CHECK (tags IS NULL OR cardinality(tags) <= 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_voice_intro_duration_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_voice_intro_duration_check
      CHECK (voice_intro_duration_ms IS NULL OR (voice_intro_duration_ms > 0 AND voice_intro_duration_ms <= 30000));
  END IF;
END $$;

-- 2. TRIGGER FUNCTION: PROTECT PRIVILEGED PROFILE COLUMNS
-- Ensures direct Supabase client updates from role 'authenticated' cannot mutate
-- server-enforced profile fields (bio, tags, voice intro, trust scores, tiers, verifications).
-- All writes to these columns must be made through the backend API server.
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.bio IS DISTINCT FROM OLD.bio OR
       NEW.tags IS DISTINCT FROM OLD.tags OR
       NEW.voice_intro_path IS DISTINCT FROM OLD.voice_intro_path OR
       NEW.voice_intro_duration_ms IS DISTINCT FROM OLD.voice_intro_duration_ms OR
       NEW.trust_score IS DISTINCT FROM OLD.trust_score OR
       NEW.approval_score IS DISTINCT FROM OLD.approval_score OR
       NEW.hidden_tier IS DISTINCT FROM OLD.hidden_tier OR
       NEW.is_verified IS DISTINCT FROM OLD.is_verified OR
       NEW.institution_verified IS DISTINCT FROM OLD.institution_verified OR
       NEW.account_status IS DISTINCT FROM OLD.account_status OR
       NEW.golden_bids_remaining IS DISTINCT FROM OLD.golden_bids_remaining THEN
      RAISE EXCEPTION 'Updates to protected profile fields must go through the API server.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_extras ON public.profiles;
CREATE TRIGGER trg_protect_profile_extras
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_privileged_profile_columns();
