-- =============================================================================
-- KIN DATING PLATFORM: DISCOVER FEATURES (PART B: PEOPLE LIST)
-- Migration: 20261123200000_discover_part_b_people_list.sql
-- Description: Schema for hide_from_people profile setting, people_impressions,
--              indexes, and RLS lockdown.
-- DO NOT RUN LIVE - Migration file only.
-- =============================================================================

-- 1. ALTER PROFILES TABLE (HIDE FROM PEOPLE PREFERENCE)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_from_people BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_hide_from_people ON public.profiles(hide_from_people);

-- 2. CREATE PEOPLE_IMPRESSIONS TABLE (Track distinct daily viewers and profile exposure caps)
CREATE TABLE IF NOT EXISTS public.people_impressions (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  view_date DATE DEFAULT CURRENT_DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (profile_id, viewer_id, view_date)
);

-- 3. INDEXES FOR HIGH-THROUGHPUT PEOPLE DISCOVERY QUERIES
CREATE INDEX IF NOT EXISTS idx_people_impressions_viewer_date ON public.people_impressions(viewer_id, view_date);
CREATE INDEX IF NOT EXISTS idx_people_impressions_profile_date ON public.people_impressions(profile_id, view_date);

-- 4. SECURITY: ENABLE RLS AND REVOKE CLIENT ACCESS (NO CLIENT GRANTS)
-- All reads and writes must pass through the API server via service role.
ALTER TABLE public.people_impressions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.people_impressions FROM anon, authenticated;
