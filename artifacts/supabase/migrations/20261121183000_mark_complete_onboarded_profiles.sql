-- =============================================================================
-- ONE-TIME MIGRATION: Mark onboarding_complete = true for profiles with all 5 mandatory fields
-- Migration: 20261121183000_mark_complete_onboarded_profiles.sql
--
-- Rules:
-- A profile counts as onboarded only if ALL 5 fields are present (strict AND logic, never OR):
-- 1. full_name (non-null and non-empty after trimming)
-- 2. date_of_birth (non-null)
-- 3. gender (non-null and non-empty after trimming)
-- 4. faculty (stores occupation / faculty in Kin; non-null and non-empty after trimming)
-- 5. primary_intent (non-null and non-empty after trimming)
-- =============================================================================

UPDATE public.profiles
SET onboarding_complete = true
WHERE (onboarding_complete IS NULL OR onboarding_complete = false)
  AND full_name IS NOT NULL AND trim(full_name) <> ''
  AND date_of_birth IS NOT NULL
  AND gender IS NOT NULL AND trim(gender) <> ''
  AND faculty IS NOT NULL AND trim(faculty) <> ''
  AND primary_intent IS NOT NULL AND trim(primary_intent) <> '';
