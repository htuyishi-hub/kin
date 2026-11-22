-- Migration: 20261122130000_private_storage_buckets.sql
-- Description: Make storage buckets private with size limits and MIME type restrictions,
-- revoke all client access to storage.objects, and drop all policies on storage.objects.
-- DO NOT RUN LIVE - Migration file only.

-- 1. Configure profile-photos and voice-intros as private with strict limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  false,
  524288, -- 500 KB
  ARRAY['image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 524288,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-intros',
  'voice-intros',
  false,
  2097152, -- 2 MB
  ARRAY['audio/m4a', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['audio/m4a', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];

-- 2. Revoke ALL on storage.objects from anon and authenticated
REVOKE ALL ON TABLE storage.objects FROM anon;
REVOKE ALL ON TABLE storage.objects FROM authenticated;

-- 3. Drop every policy on storage.objects dynamically
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;
