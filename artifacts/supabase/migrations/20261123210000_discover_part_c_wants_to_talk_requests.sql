-- =============================================================================
-- KIN DATING PLATFORM: DISCOVER FEATURES (PART C: WANTS TO TALK REQUESTS)
-- Migration: 20261123210000_discover_part_c_wants_to_talk_requests.sql
-- Description: Schema for talk_requests table, indexes, and RLS lockdown.
-- DO NOT RUN LIVE - Migration file only.
-- =============================================================================

-- 1. CREATE TALK_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.talk_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT chk_talk_requests_sender_receiver CHECK (sender_id != receiver_id),
  CONSTRAINT chk_talk_requests_status CHECK (status IN ('pending', 'accepted', 'declined', 'expired'))
);

-- 2. HIGH-PERFORMANCE INDEXES
-- Index for quick lookup of incoming pending requests for a user
CREATE INDEX IF NOT EXISTS idx_talk_requests_receiver_status
  ON public.talk_requests(receiver_id, status)
  WHERE status = 'pending';

-- Index for sender daily rate limits
CREATE INDEX IF NOT EXISTS idx_talk_requests_sender_created
  ON public.talk_requests(sender_id, created_at);

-- Unique partial index: prevent multiple pending requests between the same pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_talk_request
  ON public.talk_requests(sender_id, receiver_id)
  WHERE status = 'pending';

-- 3. SECURITY: ENABLE RLS AND REVOKE CLIENT ACCESS (NO CLIENT GRANTS)
-- All reads and writes must pass through the API server via service role.
ALTER TABLE public.talk_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.talk_requests FROM anon, authenticated;
