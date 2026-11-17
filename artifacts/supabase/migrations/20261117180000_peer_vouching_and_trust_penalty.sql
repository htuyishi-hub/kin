-- =============================================================================
-- KIN DATING PLATFORM: PEER-TO-PEER PUBLIC VOUCHING & TRUST PENALTY SYSTEM
-- Migration: 20261117180000_peer_vouching_and_trust_penalty.sql
-- =============================================================================

-- 1. ADD ACCOUNT_STATUS COLUMN TO PROFILES IF NOT EXISTS
ALTER TABLE "profiles" 
ADD COLUMN IF NOT EXISTS "account_status" text DEFAULT 'waitlisted';

-- Update active verified users to status 'active'
UPDATE "profiles"
SET "account_status" = 'active'
WHERE "is_verified" = true 
   OR "institution_verified" = true 
   OR "invited_by_profile" IS NOT NULL
   OR COALESCE("vouch_count", 0) >= 1;

-- 2. SUPABASE RPC: ATOMIC VOUCH EXECUTION
CREATE OR REPLACE FUNCTION public.execute_vouch(
  p_voucher_id UUID,
  p_vouchee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher RECORD;
  v_vouchee RECORD;
  v_vouch_id UUID;
BEGIN
  -- Prevent self-vouching
  IF p_voucher_id = p_vouchee_id THEN
    RAISE EXCEPTION 'Cannot vouch for yourself';
  END IF;

  -- Validate voucher exists and is an active, verified member
  SELECT * INTO v_voucher FROM public.profiles WHERE id = p_voucher_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Voucher profile not found';
  END IF;

  IF v_voucher.profile_active = false 
     OR (v_voucher.account_status IS NOT NULL AND v_voucher.account_status IN ('banned', 'suspended')) THEN
    RAISE EXCEPTION 'Voucher account is not in good standing';
  END IF;

  -- Validate vouchee exists
  SELECT * INTO v_vouchee FROM public.profiles WHERE id = p_vouchee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vouchee profile not found';
  END IF;

  -- Insert or update the vouch record to 'confirmed'
  INSERT INTO public.vouches (vouched_user, voucher, status, confirmed_at)
  VALUES (p_vouchee_id, p_voucher_id, 'confirmed', now())
  ON CONFLICT (vouched_user, voucher)
  DO UPDATE SET status = 'confirmed', confirmed_at = now()
  RETURNING id INTO v_vouch_id;

  -- Atomically activate and verify vouchee profile
  UPDATE public.profiles
  SET 
    account_status = 'active',
    is_verified = true,
    profile_active = true,
    vouch_count = COALESCE(vouch_count, 0) + 1
  WHERE id = p_vouchee_id;

  -- Log positive trust event (+5) for the voucher
  INSERT INTO public.trust_events (user_id, event_type, delta, source_id, created_at)
  VALUES (p_voucher_id, 'vouch_granted', 5, p_vouchee_id, now());

  RETURN jsonb_build_object(
    'success', true,
    'vouch_id', v_vouch_id,
    'voucher_id', p_voucher_id,
    'vouchee_id', p_vouchee_id,
    'status', 'confirmed'
  );
END;
$$;

-- 3. SOCIAL ACCOUNTABILITY: TRUST PENALTY TRIGGER
CREATE OR REPLACE FUNCTION public.penalize_voucher_on_bad_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher_id UUID;
  v_penalty_delta CONSTANT SMALLINT := -25;
BEGIN
  -- Check if user is being banned/suspended or deactivated
  IF (NEW.account_status IN ('banned', 'suspended') AND (OLD.account_status IS NULL OR OLD.account_status NOT IN ('banned', 'suspended')))
     OR (NEW.profile_active = false AND OLD.profile_active = true) THEN

    -- Loop through all confirmed vouchers for this bad actor
    FOR v_voucher_id IN
      SELECT voucher FROM public.vouches
      WHERE vouched_user = NEW.id AND status = 'confirmed'
    LOOP
      -- Insert trust penalty audit record into trust_events
      INSERT INTO public.trust_events (user_id, event_type, delta, source_id, created_at)
      VALUES (v_voucher_id, 'vouchee_banned_penalty', v_penalty_delta, NEW.id, now());

      -- Lower voucher's trust score (clamped to a minimum of 0)
      UPDATE public.profiles
      SET trust_score = GREATEST(0, COALESCE(trust_score, 50) + v_penalty_delta)
      WHERE id = v_voucher_id;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to public.profiles
DROP TRIGGER IF EXISTS trg_penalize_voucher_on_bad_actor ON public.profiles;

CREATE TRIGGER trg_penalize_voucher_on_bad_actor
AFTER UPDATE OF account_status, profile_active ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.penalize_voucher_on_bad_actor();
