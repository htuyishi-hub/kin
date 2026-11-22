-- =============================================================================
-- KIN DATING PLATFORM: AUTH HARDENING & PRIVILEGED PROFILE PROTECTION
-- Migration: 20261122100000_harden_auth_and_profile_privileges.sql
-- =============================================================================
-- 1. Tighten handle_new_user: Require confirmed email (email_confirmed_at IS NOT NULL)
--    before auto-verifying UR students. Restrict to @stud.ur.ac.rw only (exclude alumni).
--    Do not generate invite codes for unverified profiles.
-- 2. Add handle_user_email_confirmed: Trigger on auth.users when email is confirmed.
-- 3. Harden protect_privileged_profile_columns(): Protect all privileged columns
--    against direct client mutations via Supabase anon key.

-- 1. UPDATE handle_new_user() TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_email text;
  v_is_ur boolean;
  v_invite_code text;
BEGIN
  v_phone := NEW.phone;
  v_email := NEW.email;
  
  -- University of Rwanda active student check:
  -- Strictly requires verified student domain (@stud.ur.ac.rw) AND confirmed email.
  -- Alumni domains (@alumni.ur.ac.rw) are explicitly rejected from auto-verification.
  v_is_ur := (
    v_email IS NOT NULL 
    AND v_email ILIKE '%@stud.ur.ac.rw' 
    AND NEW.email_confirmed_at IS NOT NULL
  );

  -- Only verified members receive an invite code
  IF v_is_ur THEN
    v_invite_code := 'KIN-' || UPPER(SUBSTRING(MD5(RANDOM()::text || clock_timestamp()::text) FROM 1 FOR 6));
  ELSE
    v_invite_code := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    phone_number,
    email,
    invite_code,
    institution,
    institution_verified,
    is_verified,
    account_status,
    verification_method,
    created_at,
    last_active
  )
  VALUES (
    NEW.id,
    v_phone,
    v_email,
    v_invite_code,
    CASE WHEN v_is_ur THEN 'university_of_rwanda' ELSE NULL END,
    v_is_ur,
    v_is_ur,
    CASE WHEN v_is_ur THEN 'active' ELSE 'waitlisted' END,
    CASE WHEN v_is_ur THEN 'ur_email' ELSE NULL END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. TRIGGER ON EMAIL CONFIRMATION (auth.users UPDATE)
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When user confirms their email after initial insert
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    IF NEW.email IS NOT NULL AND NEW.email ILIKE '%@stud.ur.ac.rw' THEN
      UPDATE public.profiles
      SET
        institution = 'university_of_rwanda',
        institution_verified = true,
        is_verified = true,
        account_status = 'active',
        verification_method = 'ur_email',
        invite_code = COALESCE(invite_code, 'KIN-' || UPPER(SUBSTRING(MD5(RANDOM()::text || clock_timestamp()::text) FROM 1 FOR 6))),
        updated_at = NOW()
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmed();

-- 3. HARDEN PRIVILEGED PROFILE COLUMNS TRIGGER
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

DROP TRIGGER IF EXISTS trg_protect_profile_extras ON public.profiles;
CREATE TRIGGER trg_protect_profile_extras
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_privileged_profile_columns();
