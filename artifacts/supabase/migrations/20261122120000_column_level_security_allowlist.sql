-- Migration: 20261122120000_column_level_security_allowlist.sql
-- Description: Enforce column-level security allowlist on profiles, canonicalize SQL invite code generation, and seal direct client writes.
-- Safe to execute multiple times (idempotent).

-- =============================================================================
-- 1. COLUMN-LEVEL SECURITY ALLOWLIST ON public.profiles
--    - Revoke table-level INSERT, UPDATE, DELETE from authenticated
--    - Revoke table-level SELECT from authenticated
--    - Grant SELECT only on essential routing/profile columns
--    - Grant UPDATE ONLY on column (language) for in-app switching
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM authenticated;

-- Allow authenticated users to read only their own basic routing/profile columns
-- Excludes sensitive columns: hidden_tier, trust_score, approval_score, tokens_remaining, crossing_fee_paid, etc.
GRANT SELECT (
  id,
  full_name,
  date_of_birth,
  gender,
  faculty,
  primary_intent,
  onboarding_complete,
  is_verified,
  institution_verified,
  account_status,
  language
) ON public.profiles TO authenticated;

-- Allow authenticated users to update ONLY language (for immediate in-app language switching)
GRANT UPDATE (language) ON public.profiles TO authenticated;

-- Ensure RLS is active and own-row policies are firmly in place
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- 2. CANONICAL INVITE CODE GENERATOR IN SQL
--    Produces identical format to TypeScript generateInviteCode():
--    'KIN-' followed by 6 characters from '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  result text := 'KIN-';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * 32)::integer + 1, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Revoke execute on generator from public/anon/authenticated
REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;

-- Update handle_new_user() and handle_user_email_confirmed() to use public.generate_invite_code()
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_phone text;
  v_is_ur_student boolean := false;
  v_account_status text := 'waitlisted';
  v_invite_code text := NULL;
  v_verification_method text := NULL;
  v_trust_score integer := 50;
  v_existing_profile_id uuid;
BEGIN
  v_phone := NEW.phone;
  IF v_phone IS NULL OR v_phone = '' THEN
    v_phone := 'auth0:' || NEW.id::text;
  END IF;

  SELECT id INTO v_existing_profile_id
  FROM public.profiles
  WHERE id = NEW.id;

  IF v_existing_profile_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Only grant UR verified status if email was confirmed upon insert
  IF NEW.email IS NOT NULL AND NEW.email ILIKE '%@stud.ur.ac.rw' AND NEW.email_confirmed_at IS NOT NULL THEN
    v_is_ur_student := true;
    v_account_status := 'active';
    v_verification_method := 'ur_email';
    v_trust_score := 65;
    v_invite_code := public.generate_invite_code();
  ELSE
    v_invite_code := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    phone_number,
    account_status,
    is_verified,
    institution_verified,
    institution,
    invite_code,
    verification_method,
    trust_score,
    created_at,
    last_active
  ) VALUES (
    NEW.id,
    v_phone,
    v_account_status,
    v_is_ur_student,
    v_is_ur_student,
    CASE WHEN v_is_ur_student THEN 'university_of_rwanda' ELSE NULL END,
    v_invite_code,
    v_verification_method,
    v_trust_score,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    IF NEW.email ILIKE '%@stud.ur.ac.rw' THEN
      UPDATE public.profiles
      SET
        is_verified = true,
        institution_verified = true,
        account_status = 'active',
        verification_method = 'ur_email',
        institution = 'university_of_rwanda',
        invite_code = COALESCE(invite_code, public.generate_invite_code()),
        trust_score = GREATEST(trust_score, 65)
      WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. FINAL HARDENED PRIVILEGED PROFILE COLUMNS TRIGGER
--    Explicitly protects verified_adult alongside all other sensitive columns
-- =============================================================================
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified OR
       NEW.account_status IS DISTINCT FROM OLD.account_status OR
       NEW.trust_score IS DISTINCT FROM OLD.trust_score OR
       NEW.approval_score IS DISTINCT FROM OLD.approval_score OR
       NEW.institution_verified IS DISTINCT FROM OLD.institution_verified OR
       NEW.verification_method IS DISTINCT FROM OLD.verification_method OR
       NEW.invited_by_profile IS DISTINCT FROM OLD.invited_by_profile OR
       NEW.invite_count IS DISTINCT FROM OLD.invite_count OR
       NEW.invite_code IS DISTINCT FROM OLD.invite_code OR
       NEW.onboarding_complete IS DISTINCT FROM OLD.onboarding_complete OR
       NEW.profile_active IS DISTINCT FROM OLD.profile_active OR
       NEW.profile_paused IS DISTINCT FROM OLD.profile_paused OR
       NEW.golden_bids_remaining IS DISTINCT FROM OLD.golden_bids_remaining OR
       NEW.hidden_tier IS DISTINCT FROM OLD.hidden_tier OR
       NEW.verified_adult IS DISTINCT FROM OLD.verified_adult OR
       NEW.bio IS DISTINCT FROM OLD.bio OR
       NEW.tags IS DISTINCT FROM OLD.tags OR
       NEW.voice_intro_path IS DISTINCT FROM OLD.voice_intro_path OR
       NEW.voice_intro_duration_ms IS DISTINCT FROM OLD.voice_intro_duration_ms THEN
      RAISE EXCEPTION 'Updates to protected profile fields must go through the API server.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
