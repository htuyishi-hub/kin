-- =============================================================================
-- KIN DATING PLATFORM: SUPABASE AUTH FINALIZATION & RLS POLICIES
-- Migration: 20261117210000_supabase_auth_hardening_rls.sql
-- =============================================================================

-- 1. REVOKE PUBLIC EXECUTE PRIVILEGES ON SENSITIVE SECURITY DEFINER FUNCTIONS
-- Prevents anonymous and authenticated users from inflating trust scores or 
-- executing single-vouch bypasses via client RPC calls.
REVOKE EXECUTE ON FUNCTION public.increment_trust_score(uuid, integer) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execute_vouch(uuid, uuid) FROM public, anon, authenticated;

-- Ensure only authenticated users can invoke community approval, and anon is blocked
REVOKE EXECUTE ON FUNCTION public.approve_waitlisted_user(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.approve_waitlisted_user(uuid, uuid) TO authenticated;

-- 2. MAKE PHONE_NUMBER NULLABLE ON PROFILES
-- Supports clean email OTP / Google sign-in without fake synthetic strings.
ALTER TABLE public.profiles ALTER COLUMN phone_number DROP NOT NULL;

-- 3. UPDATE AUTO-PROFILE TRIGGER (handle_new_user)
-- Correctly handles email OTP and phone OTP without synthetic placeholder hacks.
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
  
  -- Cryptographic random 6-character Kin invite code (e.g. KIN-A1B2C3)
  v_invite_code := 'KIN-' || UPPER(SUBSTRING(MD5(RANDOM()::text || clock_timestamp()::text) FROM 1 FOR 6));
  
  -- University of Rwanda student check (@stud.ur.ac.rw)
  v_is_ur := (v_email IS NOT NULL AND v_email ILIKE '%@stud.ur.ac.rw');

  INSERT INTO public.profiles (
    id,
    phone_number,
    email,
    invite_code,
    institution,
    institution_verified,
    is_verified,
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
    CASE WHEN v_is_ur THEN 'ur_email' ELSE NULL END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone_number = COALESCE(public.profiles.phone_number, EXCLUDED.phone_number),
    institution_verified = CASE WHEN v_is_ur THEN true ELSE public.profiles.institution_verified END,
    is_verified = CASE WHEN v_is_ur THEN true ELSE public.profiles.is_verified END;

  RETURN NEW;
END;
$$;

-- 4. ROW LEVEL SECURITY (RLS) FOR PROFILES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR (account_status = 'active' AND profile_active = true)
);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 5. ROW LEVEL SECURITY (RLS) FOR PROFILE_PHOTOS
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photos_select_policy" ON public.profile_photos;
CREATE POLICY "photos_select_policy"
ON public.profile_photos
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "photos_insert_own" ON public.profile_photos;
CREATE POLICY "photos_insert_own"
ON public.profile_photos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "photos_delete_own" ON public.profile_photos;
CREATE POLICY "photos_delete_own"
ON public.profile_photos
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 6. PURGE ORPHANED AUTH0 TEST ACCOUNTS & LINK PROFILES TO auth.users
DELETE FROM public.profiles WHERE phone_number LIKE 'auth0:%';

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS fk_profiles_auth_users;

ALTER TABLE public.profiles
ADD CONSTRAINT fk_profiles_auth_users
FOREIGN KEY (id) REFERENCES auth.users(id)
ON DELETE CASCADE;
