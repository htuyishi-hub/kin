-- =============================================================================
-- KIN DATING PLATFORM: ADVANCED SWIPE, COMMUNITY VALIDATION & GOLDEN BID
-- Migration: 20261117190000_swipe_approval_golden_bid.sql
-- =============================================================================

-- 1. INTERESTS ENHANCEMENTS: reaction_type & is_golden_bid
ALTER TABLE "interests" 
ADD COLUMN IF NOT EXISTS "reaction_type" text;

ALTER TABLE "interests" 
ADD COLUMN IF NOT EXISTS "is_golden_bid" boolean DEFAULT false;

-- 2. PROFILES ENHANCEMENTS: intent_class, approval_score, golden_bids_remaining, trust_score default
ALTER TABLE "profiles" 
ADD COLUMN IF NOT EXISTS "intent_class" text;

UPDATE "profiles" 
SET "intent_class" = "primary_intent" 
WHERE "intent_class" IS NULL;

ALTER TABLE "profiles" 
ADD COLUMN IF NOT EXISTS "approval_score" integer DEFAULT 0;

ALTER TABLE "profiles" 
ADD COLUMN IF NOT EXISTS "golden_bids_remaining" integer DEFAULT 3;

ALTER TABLE "profiles" 
ALTER COLUMN "trust_score" TYPE integer;

ALTER TABLE "profiles" 
ALTER COLUMN "trust_score" SET DEFAULT 1;

-- 3. PASSES TABLE (Soft Pass 14-day expiry & Hard Reject)
CREATE TABLE IF NOT EXISTS "passes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "target_user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "type" text NOT NULL DEFAULT 'soft_pass', -- soft_pass | hard_reject
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "unique_pass_pair" UNIQUE("user_id", "target_user_id")
);

CREATE INDEX IF NOT EXISTS "idx_passes_user_target" ON "passes"("user_id", "target_user_id");
CREATE INDEX IF NOT EXISTS "idx_passes_expires_at" ON "passes"("expires_at");

-- 4. FUNCTION: INCREMENT TRUST SCORE (for Likes and Profile Views)
CREATE OR REPLACE FUNCTION public.increment_trust_score(
  p_user_id UUID,
  p_amount INT DEFAULT 1
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_score INT;
BEGIN
  UPDATE public.profiles
  SET trust_score = COALESCE(trust_score, 1) + p_amount
  WHERE id = p_user_id
  RETURNING trust_score INTO v_new_score;
  
  RETURN v_new_score;
END;
$$;

-- Trigger: When user receives a like, increment their trust_score (+1 for normal like, +5 for Golden Bid)
CREATE OR REPLACE FUNCTION public.trg_increment_trust_on_interest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bonus INT := 1;
BEGIN
  IF NEW.is_golden_bid = true THEN
    v_bonus := 5;
  END IF;

  PERFORM public.increment_trust_score(NEW.to_user, v_bonus);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interest_trust_score ON public.interests;
CREATE TRIGGER trg_interest_trust_score
AFTER INSERT ON public.interests
FOR EACH ROW
EXECUTE FUNCTION public.trg_increment_trust_on_interest();

-- 5. FUNCTION: WEIGHTED COMMUNITY APPROVAL ENGINE
CREATE OR REPLACE FUNCTION public.approve_waitlisted_user(
  p_approver_id UUID,
  p_candidate_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approver RECORD;
  v_candidate RECORD;
  v_weight INT;
  v_new_approval_score INT;
  v_is_active BOOLEAN := false;
  v_threshold CONSTANT INT := 10;
BEGIN
  IF p_approver_id = p_candidate_id THEN
    RAISE EXCEPTION 'Cannot approve yourself';
  END IF;

  SELECT * INTO v_approver FROM public.profiles WHERE id = p_approver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approver profile not found';
  END IF;

  IF v_approver.profile_active = false 
     OR (v_approver.account_status IS NOT NULL AND v_approver.account_status != 'active') THEN
    RAISE EXCEPTION 'Approver is not an active member';
  END IF;

  v_weight := GREATEST(1, COALESCE(v_approver.trust_score, 1));

  SELECT * INTO v_candidate FROM public.profiles WHERE id = p_candidate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate profile not found';
  END IF;

  INSERT INTO public.vouches (vouched_user, voucher, status, confirmed_at)
  VALUES (p_candidate_id, p_approver_id, 'confirmed', now())
  ON CONFLICT (vouched_user, voucher)
  DO UPDATE SET status = 'confirmed', confirmed_at = now();

  UPDATE public.profiles
  SET 
    approval_score = COALESCE(approval_score, 0) + v_weight,
    vouch_count = COALESCE(vouch_count, 0) + 1
  WHERE id = p_candidate_id
  RETURNING approval_score INTO v_new_approval_score;

  IF v_new_approval_score >= v_threshold OR v_weight >= 10 THEN
    UPDATE public.profiles
    SET 
      account_status = 'active',
      is_verified = true,
      profile_active = true
    WHERE id = p_candidate_id;
    v_is_active := true;
  END IF;

  INSERT INTO public.trust_events (user_id, event_type, delta, source_id, created_at)
  VALUES (p_approver_id, 'approved_candidate', 5, p_candidate_id, now());

  RETURN jsonb_build_object(
    'success', true,
    'approver_id', p_approver_id,
    'candidate_id', p_candidate_id,
    'weight_added', v_weight,
    'new_approval_score', v_new_approval_score,
    'threshold', v_threshold,
    'activated', v_is_active
  );
END;
$$;
