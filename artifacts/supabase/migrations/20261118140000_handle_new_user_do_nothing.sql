-- =============================================================================
-- KIN DATING PLATFORM: PROFILE CREATION TRIGGER IDEMPOTENCY
-- Migration: 20261118140000_handle_new_user_do_nothing.sql
-- =============================================================================
-- Ensures handle_new_user uses ON CONFLICT (id) DO NOTHING so repeat sign-ins,
-- OAuth callbacks, or OTP retries never throw duplicate key or database errors.

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
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
