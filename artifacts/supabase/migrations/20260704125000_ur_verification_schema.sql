-- Kin — Supabase migration (Phase 2 UR verification schema)
-- Creates student_registry and adds UR verification columns to profiles.
-- Idempotent: uses IF NOT EXISTS and safe ALTERs.

-- student_registry
create table if not exists public.student_registry (
  registration_number text primary key,
  campus text not null,
  claimed boolean not null default false,
  claimed_by_profile uuid null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce one student registration number can be claimed by only one profile.
-- (claimed_by_profile is already nullable; unique allows 0..1 registrations per profile.)
create unique index if not exists student_registry_claimed_by_profile_unique
  on public.student_registry (claimed_by_profile)
  where claimed_by_profile is not null;

-- profiles UR columns
alter table public.profiles
  add column if not exists institution text null,
  add column if not exists campus text null,
  add column if not exists registration_number text null,
  add column if not exists institution_verified boolean not null default false,
  add column if not exists verification_method text null;

-- Optional: keep defaults consistent for new rows
update public.profiles
set
  institution = coalesce(institution, 'none'),
  institution_verified = coalesce(institution_verified, false)
where institution is null or institution_verified is null;


