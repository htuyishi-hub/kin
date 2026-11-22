-- Migration: 20261122110000_minimal_lockdown.sql
-- Description: Minimal Database Lockdown for Friend-Test Release
-- Safe to execute multiple times (idempotent)

-- =============================================================================
-- 1. Enable Row Level Security (RLS) on EVERY table in schema public without FORCE
-- =============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END;
$$;

-- =============================================================================
-- 2. Revoke ALL on all tables, sequences, and routines in public from anon
--    Anon role keeps nothing in public schema.
-- =============================================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE USAGE ON SCHEMA public FROM anon;

-- =============================================================================
-- 3. Revoke EXECUTE on ALL functions in public from PUBLIC, anon, and authenticated
--    In PostgreSQL, functions are executable by PUBLIC by default.
--    Server code connects directly via DATABASE_URL as postgres, so it is unaffected.
-- =============================================================================
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Explicitly revoke execute on known stored procedures if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' AND p.proname = 'approve_waitlisted_user'
  ) THEN
    REVOKE ALL ON FUNCTION public.approve_waitlisted_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' AND p.proname = 'process_community_vote'
  ) THEN
    EXECUTE (
      SELECT string_agg(format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated;', p.proname, pg_get_function_identity_arguments(p.oid)), ' ')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'process_community_vote'
    );
  END IF;
END;
$$;

-- =============================================================================
-- 4. Revoke table & sequence privileges from authenticated across all tables in public
--    Grant minimal permissions ONLY to public.profiles (own-row SELECT and UPDATE)
--    because client apps (kin, kin-web) manage other features exclusively via API server.
-- =============================================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- =============================================================================
-- 5. Fix policies on public.profiles:
--    Keep ONLY own-row SELECT (auth.uid() = id) and own-row UPDATE (auth.uid() = id).
--    Drop the branch that allows any authenticated user to read other active profiles.
--    Drop profiles_insert_own (auth trigger creates profile rows).
-- =============================================================================
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
-- 6. Clean up legacy/unused policies on other tables
--    (No client apps query these tables directly; all access is mediated by API server)
-- =============================================================================
DROP POLICY IF EXISTS "Users can insert their own interests" ON public.interests;
DROP POLICY IF EXISTS "Users can view involved interests" ON public.interests;
DROP POLICY IF EXISTS "Users can delete their own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can insert their own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can update their own passes" ON public.passes;
DROP POLICY IF EXISTS "Users can view their own passes" ON public.passes;
DROP POLICY IF EXISTS "photos_delete_own" ON public.profile_photos;
DROP POLICY IF EXISTS "photos_insert_own" ON public.profile_photos;
DROP POLICY IF EXISTS "photos_select_policy" ON public.profile_photos;
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view their own trust events" ON public.trust_events;
DROP POLICY IF EXISTS "Users can insert their own vouches" ON public.vouches;
DROP POLICY IF EXISTS "Users can view involved vouches" ON public.vouches;

-- =============================================================================
-- 7. Alter default privileges so future tables, sequences, and routines
--    are NOT automatically granted to anon or authenticated
-- =============================================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;
