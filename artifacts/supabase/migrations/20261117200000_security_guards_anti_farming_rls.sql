-- =============================================================================
-- KIN DATING PLATFORM: SECURITY GUARDS, ANTI-FARMING, QUORUM & RLS POLICIES
-- Migration: 20261117200000_security_guards_anti_farming_rls.sql
-- =============================================================================

-- 1. DAILY CAP & ANTI-FARMING TRIGGER FOR TRUST SCORE
-- Decouple Golden Bids from Trust Scores completely (no pay-to-gain moderation power!).
-- Cap trust gains from likes to maximum +2 points per recipient per 24 hours.
-- Only verified active users can grant trust score increments to others.
CREATE OR REPLACE FUNCTION public.trg_increment_trust_on_interest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sender RECORD;
  v_daily_likes_received INT;
BEGIN
  -- 1. Verify sender is active and verified (prevents unverified burner accounts from farming)
  SELECT is_verified, profile_active, account_status INTO v_sender 
  FROM public.profiles WHERE id = NEW.from_user;

  IF NOT FOUND OR v_sender.is_verified = false OR v_sender.profile_active = false 
     OR (v_sender.account_status IS NOT NULL AND v_sender.account_status != 'active') THEN
    RETURN NEW; -- Do not increment trust score from unverified or inactive accounts
  END IF;

  -- 2. Daily cap: check how many likes recipient already got in the last 24h
  SELECT COUNT(*) INTO v_daily_likes_received
  FROM public.interests
  WHERE to_user = NEW.to_user AND created_at > now() - interval '24 hours';

  -- Cap at +2 trust points per day from incoming likes
  IF v_daily_likes_received <= 2 THEN
    PERFORM public.increment_trust_score(NEW.to_user, 1);
  END IF;

  -- Note: Golden Bids give NO extra moderation power / trust score!
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interest_trust_score ON public.interests;
CREATE TRIGGER trg_interest_trust_score
AFTER INSERT ON public.interests
FOR EACH ROW
EXECUTE FUNCTION public.trg_increment_trust_on_interest();

-- 2. HARDENED WEIGHTED APPROVAL ENGINE WITH QUORUM & RATE LIMITING
-- Rules:
-- 1) Capped & Non-linear voting weight (max 3 points, preventing any farmed user from dominating).
-- 2) Strict Quorum: NO single approver can activate alone. Requires at least 2 distinct independent approvers AND 5 total weight.
-- 3) Velocity Guard: Max 5 approvals per 24h per approver, and 10s cooldown.
-- 4) Minimum trust score of 10 required to have approval privileges.
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
  v_approver_count INT;
  v_is_active BOOLEAN := false;
  v_recent_approvals INT;
  v_last_approval_time TIMESTAMPTZ;
  v_min_distinct_approvers CONSTANT INT := 2;
  v_approval_score_threshold CONSTANT INT := 5;
BEGIN
  -- Guard 1: Prevent self-approval
  IF p_approver_id = p_candidate_id THEN
    RAISE EXCEPTION 'Cannot approve yourself';
  END IF;

  -- Guard 2: Verify approver is active, verified, and has minimum trust score 10
  SELECT * INTO v_approver FROM public.profiles WHERE id = p_approver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approver profile not found';
  END IF;

  IF v_approver.profile_active = false 
     OR (v_approver.account_status IS NOT NULL AND v_approver.account_status != 'active')
     OR v_approver.is_verified = false THEN
    RAISE EXCEPTION 'Approver must be an active, verified member';
  END IF;

  IF COALESCE(v_approver.trust_score, 1) < 10 THEN
    RAISE EXCEPTION 'Minimum Trust Score of 10 required to participate in community approvals (your score: %)', COALESCE(v_approver.trust_score, 1);
  END IF;

  -- Guard 3: Velocity Limit — max 5 approvals per 24h
  SELECT COUNT(*), MAX(confirmed_at) 
  INTO v_recent_approvals, v_last_approval_time
  FROM public.vouches 
  WHERE voucher = p_approver_id AND confirmed_at > now() - interval '24 hours';

  IF v_recent_approvals >= 5 THEN
    RAISE EXCEPTION 'Daily approval limit reached (5 approvals/24h). Please wait before reviewing more candidates.';
  END IF;

  IF v_last_approval_time IS NOT NULL AND v_last_approval_time > now() - interval '10 seconds' THEN
    RAISE EXCEPTION 'Approval velocity too high. Please review candidate profiles carefully.';
  END IF;

  -- Guard 4: Verify candidate exists and is waitlisted
  SELECT * INTO v_candidate FROM public.profiles WHERE id = p_candidate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate profile not found';
  END IF;

  IF v_candidate.account_status = 'active' THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Candidate is already active',
      'activated', true
    );
  END IF;

  -- Calculate bounded non-linear voting weight (capped at max 3 points)
  v_weight := CASE 
    WHEN v_approver.trust_score >= 80 THEN 3
    WHEN v_approver.trust_score >= 40 THEN 2
    ELSE 1
  END;

  -- Insert/update approval row
  INSERT INTO public.vouches (vouched_user, voucher, status, confirmed_at)
  VALUES (p_candidate_id, p_approver_id, 'confirmed', now())
  ON CONFLICT (vouched_user, voucher)
  DO UPDATE SET status = 'confirmed', confirmed_at = now();

  -- Add weight to candidate approval_score
  UPDATE public.profiles
  SET 
    approval_score = COALESCE(approval_score, 0) + v_weight,
    vouch_count = COALESCE(vouch_count, 0) + 1
  WHERE id = p_candidate_id
  RETURNING approval_score INTO v_new_approval_score;

  -- Count distinct confirmed approvers (QUORUM CHECK)
  SELECT COUNT(DISTINCT voucher) INTO v_approver_count
  FROM public.vouches
  WHERE vouched_user = p_candidate_id AND status = 'confirmed';

  -- Strict Quorum Activation Rule:
  -- Must have AT LEAST 2 distinct independent approvers AND approval_score >= 5.
  -- No single person can ever activate an account alone!
  IF v_approver_count >= v_min_distinct_approvers AND v_new_approval_score >= v_approval_score_threshold THEN
    UPDATE public.profiles
    SET 
      account_status = 'active',
      is_verified = true,
      profile_active = true
    WHERE id = p_candidate_id;
    v_is_active := true;
  END IF;

  -- Log audit record
  INSERT INTO public.trust_events (user_id, event_type, delta, source_id, created_at)
  VALUES (p_approver_id, 'approved_candidate', 2, p_candidate_id, now());

  RETURN jsonb_build_object(
    'success', true,
    'approver_id', p_approver_id,
    'candidate_id', p_candidate_id,
    'weight_added', v_weight,
    'new_approval_score', v_new_approval_score,
    'approver_count', v_approver_count,
    'min_approvers_needed', v_min_distinct_approvers,
    'activated', v_is_active
  );
END;
$$;

-- 3. EXPANDED TRUST PENALTY TRIGGER (Handles Both Approvers AND Inviters)
CREATE OR REPLACE FUNCTION public.penalize_voucher_on_bad_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher_id UUID;
  v_penalty_delta CONSTANT INT := -25;
  v_inviter_penalty CONSTANT INT := -15;
BEGIN
  -- Fire when user is banned/suspended or deactivated
  IF (NEW.account_status IN ('banned', 'suspended') AND (OLD.account_status IS NULL OR OLD.account_status NOT IN ('banned', 'suspended')))
     OR (NEW.profile_active = false AND OLD.profile_active = true) THEN

    -- 1. Penalize all confirmed approvers (-25 trust score)
    FOR v_voucher_id IN
      SELECT voucher FROM public.vouches
      WHERE vouched_user = NEW.id AND status = 'confirmed'
    LOOP
      INSERT INTO public.trust_events (user_id, event_type, delta, source_id, created_at)
      VALUES (v_voucher_id, 'vouchee_banned_penalty', v_penalty_delta, NEW.id, now());

      UPDATE public.profiles
      SET trust_score = GREATEST(0, COALESCE(trust_score, 1) + v_penalty_delta)
      WHERE id = v_voucher_id;
    END LOOP;

    -- 2. Penalize direct inviter (-15 trust score) if invited_by_profile exists
    IF NEW.invited_by_profile IS NOT NULL THEN
      INSERT INTO public.trust_events (user_id, event_type, delta, source_id, created_at)
      VALUES (NEW.invited_by_profile, 'invitee_banned_penalty', v_inviter_penalty, NEW.id, now());

      UPDATE public.profiles
      SET trust_score = GREATEST(0, COALESCE(trust_score, 1) + v_inviter_penalty)
      WHERE id = NEW.invited_by_profile;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_penalize_voucher_on_bad_actor ON public.profiles;
CREATE TRIGGER trg_penalize_voucher_on_bad_actor
AFTER UPDATE OF account_status, profile_active ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.penalize_voucher_on_bad_actor();

-- 4. CONFIRMED REPORT TRIGGER: AUTOMATICALLY BAN BAD ACTOR
-- When a report status becomes 'confirmed', automatically update reported user to 'banned'
-- which immediately cascades to the penalty trigger above!
CREATE OR REPLACE FUNCTION public.trg_cascade_report_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE public.profiles
    SET account_status = 'banned', profile_active = false
    WHERE id = NEW.reported_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_cascade ON public.reports;
CREATE TRIGGER trg_report_cascade
AFTER UPDATE OF status ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.trg_cascade_report_confirmation();

-- 5. ROW LEVEL SECURITY (RLS) POLICIES ON ALL TABLES
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can insert their own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can update their own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can delete their own passes" ON public.passes;

DROP POLICY IF EXISTS "Users can view involved interests" ON public.interests;
DROP POLICY IF EXISTS "Users can insert their own interests" ON public.interests;

DROP POLICY IF EXISTS "Users can view involved vouches" ON public.vouches;
DROP POLICY IF EXISTS "Users can insert their own vouches" ON public.vouches;

DROP POLICY IF EXISTS "Users can view their own trust events" ON public.trust_events;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;

-- Passes RLS
CREATE POLICY "Users can view their own passes" ON public.passes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own passes" ON public.passes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own passes" ON public.passes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own passes" ON public.passes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Interests RLS
CREATE POLICY "Users can view involved interests" ON public.interests
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE POLICY "Users can insert their own interests" ON public.interests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user);

-- Vouches / Approvals RLS
CREATE POLICY "Users can view involved vouches" ON public.vouches
  FOR SELECT TO authenticated
  USING (auth.uid() = voucher OR auth.uid() = vouched_user);

CREATE POLICY "Users can insert their own vouches" ON public.vouches
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = voucher);

-- Trust Events RLS
CREATE POLICY "Users can view their own trust events" ON public.trust_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Reports RLS
CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can insert their own reports" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
