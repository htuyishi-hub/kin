-- Migration: Add language preference column to public.profiles
-- Supports 'en' (English) and 'rw' (Kinyarwanda)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en' CHECK (language IN ('en', 'rw'));

COMMENT ON COLUMN public.profiles.language IS 'User preferred language: en (English) or rw (Kinyarwanda)';
