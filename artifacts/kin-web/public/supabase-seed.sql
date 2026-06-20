-- ════════════════════════════════════════════════════════════════════
-- Kin — Supabase Migration Seed
-- Paste this entire file into the Supabase SQL Editor and run it.
-- Run once against a fresh project. Safe to re-run (uses IF NOT EXISTS
-- and ON CONFLICT DO NOTHING throughout).
-- ════════════════════════════════════════════════════════════════════

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ── 1. PROFILES ──────────────────────────────────────────────────────
create table if not exists profiles (
  id                  uuid primary key default gen_random_uuid(),
  phone_number        text unique not null,
  full_name           text,
  gender              text,
  date_of_birth       date,

  -- Invisible segmentation (never expose to client)
  hidden_tier         smallint default 1,
  primary_intent      text,
  trust_score         smallint default 50,

  -- Campus / location
  campus_name         text,
  faculty             text,
  year_of_study       smallint,
  hostel_name         text,
  city                text,
  district            text,

  -- Auth
  google_id           text unique,
  email               text,

  -- Verification flags
  phone_verified      boolean default false,
  id_verified         boolean default false,
  vouch_count         smallint default 0,
  verified_adult      boolean default false,

  -- Feature flags
  proximity_consent   boolean default false,
  crossing_fee_paid   boolean default false,
  tokens_remaining    smallint default 0,
  profile_active      boolean default true,
  profile_paused      boolean default false,

  onboarding_complete boolean default false,

  created_at          timestamptz default now(),
  last_active         timestamptz default now()
);

-- ── 2. OTP SESSIONS ──────────────────────────────────────────────────
create table if not exists otp_sessions (
  id           uuid primary key default gen_random_uuid(),
  phone_number text not null,
  code         text not null,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz default now()
);

-- ── 3. TRUST EVENTS ──────────────────────────────────────────────────
create table if not exists trust_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  event_type text not null,
  delta      smallint not null,
  source_id  uuid,
  created_at timestamptz default now()
);

-- ── 4. REPORTS ───────────────────────────────────────────────────────
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_id uuid not null references profiles(id),
  reason      text not null,
  details     text,
  status      text not null default 'pending',
  reviewed_by uuid,
  resolved_at timestamptz,
  created_at  timestamptz default now()
);

-- ── 5. VOUCHES ───────────────────────────────────────────────────────
create table if not exists vouches (
  id           uuid primary key default gen_random_uuid(),
  vouched_user uuid not null references profiles(id) on delete cascade,
  voucher      uuid not null references profiles(id) on delete cascade,
  status       text not null default 'pending',  -- pending | confirmed | revoked
  created_at   timestamptz default now(),
  confirmed_at timestamptz,
  unique(vouched_user, voucher)
);

-- ── 6. PROMPT DEFINITIONS ────────────────────────────────────────────
create table if not exists prompt_definitions (
  key         text primary key,
  prompt_text text not null,
  prompt_rw   text not null,  -- Kinyarwanda version
  tier        smallint,       -- 1=student 2=employed 3=professional
  intent      text            -- Marriage | Serious | Casual | null=all
);

-- ── 7. MICRO PROMPTS (user answers) ──────────────────────────────────
create table if not exists micro_prompts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  prompt_key text not null references prompt_definitions(key),
  answer     text not null,
  sort_order smallint default 0,
  created_at timestamptz default now()
);

-- ── 8. PROFILE PHOTOS ────────────────────────────────────────────────
create table if not exists profile_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  public_url   text,
  is_primary   boolean default false,
  is_blurred   boolean default true,
  sort_order   smallint default 0,
  created_at   timestamptz default now()
);

-- ── 9. PAYMENTS ──────────────────────────────────────────────────────
create table if not exists payments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references profiles(id) on delete cascade,
  product_type         text not null,
  -- tokens_3 | crossing_fee | profile_boost | second_chance | professional_monthly
  amount_rwf           integer not null,
  momo_reference       text unique,
  momo_transaction_id  text,
  status               text not null default 'pending',
  -- pending | completed | failed | refunded
  fulfilled            boolean default false,
  created_at           timestamptz default now(),
  completed_at         timestamptz
);

-- ── 10. INTERESTS ────────────────────────────────────────────────────
create table if not exists interests (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references profiles(id) on delete cascade,
  to_user    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(from_user, to_user)
);

-- ── 11. MATCHES ──────────────────────────────────────────────────────
create table if not exists matches (
  id                   uuid primary key default gen_random_uuid(),
  user_a               uuid not null references profiles(id) on delete cascade,
  user_b               uuid not null references profiles(id) on delete cascade,
  status               text not null default 'active',
  -- active | expired | closed | exited

  assigned_first_user  uuid references profiles(id),
  first_message_sent   boolean default false,

  conversation_phase   smallint default 1,
  phase1_complete_a    boolean default false,
  phase1_complete_b    boolean default false,
  phase2_complete_a    boolean default false,
  phase2_complete_b    boolean default false,

  expires_at           timestamptz,
  last_message_at      timestamptz,
  smart_close_at       timestamptz,

  exit_prompted        boolean default false,
  exited_at            timestamptz,

  created_at           timestamptz default now(),
  unique(user_a, user_b)
);

-- ── 12. MESSAGES ─────────────────────────────────────────────────────
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  sender_id  uuid not null references profiles(id) on delete cascade,
  content    text not null,
  phase      smallint not null default 1,
  prompt_key text references prompt_definitions(key),
  is_system  boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz default now()
);

-- ── 13. EXIT SURVEYS ─────────────────────────────────────────────────
create table if not exists exit_surveys (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references matches(id) on delete cascade,
  respondent_id  uuid not null references profiles(id) on delete cascade,
  met_in_person  boolean,
  was_respectful boolean,
  submitted_at   timestamptz default now()
);

-- ════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════

create index if not exists idx_profiles_phone      on profiles(phone_number);
create index if not exists idx_profiles_active     on profiles(profile_active, onboarding_complete);
create index if not exists idx_otp_phone_expires   on otp_sessions(phone_number, expires_at);
create index if not exists idx_vouches_vouched     on vouches(vouched_user, status);
create index if not exists idx_vouches_voucher     on vouches(voucher, status);
create index if not exists idx_interests_from      on interests(from_user);
create index if not exists idx_interests_to        on interests(to_user);
create index if not exists idx_matches_user_a      on matches(user_a, status);
create index if not exists idx_matches_user_b      on matches(user_b, status);
create index if not exists idx_messages_match      on messages(match_id, created_at);
create index if not exists idx_messages_unread     on messages(match_id, read_at) where read_at is null;
create index if not exists idx_photos_user         on profile_photos(user_id, is_primary);
create index if not exists idx_trust_events_user   on trust_events(user_id, created_at);
create index if not exists idx_payments_user       on payments(user_id, status);

-- ════════════════════════════════════════════════════════════════════
-- SEED: PROMPT DEFINITIONS
-- All prompts used in the Kin micro-prompt system.
-- tier: NULL = all tiers; 1 = student; 2 = employed; 3 = professional
-- intent: NULL = all intents; 'Marriage' | 'Serious' | 'Casual'
-- ════════════════════════════════════════════════════════════════════

insert into prompt_definitions (key, prompt_text, prompt_rw, tier, intent) values

-- Universal prompts (all tiers, all intents)
('family_role',
  'What role does family play in your life decisions?',
  'Umuryango ufite uruhare rungana iki mu mwanzuro wawe?',
  null, null),

('values_guide',
  'What values guide how you treat people?',
  'Ni ikihe gitekerezo cyagufasha gukoranya n''abandi?',
  null, null),

('community_means',
  'What does community mean to you?',
  'Umuryango bisobanura iki kuri wewe?',
  null, null),

('free_time',
  'How do you spend a peaceful weekend?',
  'Wikend y''amahoro uyimanagira gute?',
  null, null),

('growth_edge',
  'What are you working on growing in yourself right now?',
  'None uri gukoraho iki kugirango ukure nk''umuntu?',
  null, null),

('admire_others',
  'What quality do you most admire in others?',
  'Ni ikihe gitangaza ukunda cyane mu bantu?',
  null, null),

('faith_practice',
  'How does faith or spirituality show up in your daily life?',
  'Ukwizera cyangwa umwuka biragaragara gute mu buzima bwawe bwa buri munsi?',
  null, null),

('conflict_style',
  'How do you handle disagreement in a relationship?',
  'Ugaragaza gute impaka mu isano?',
  null, null),

('partner_words',
  'In three words, describe your ideal partner.',
  'Sobanura inshuti y''amoro yawe nziza mu magambo atatu.',
  null, null),

('deal_breaker',
  'What is the one thing you cannot compromise on in a partner?',
  'Ni ikihe kintu utashobora guha inshuti yawe uruhushya?',
  null, null),

-- Student-tier prompts
('campus_vibe',
  'What gets you out of bed on a heavy exam week?',
  'Ni ikihe gituma ubyuka mu cyumweru gikomeye cy''ibizamini?',
  1, null),

('future_vision',
  'Where do you picture yourself five years after graduating?',
  'Wimba ute inyuma y''imyaka itanu urangije?',
  1, null),

('study_balance',
  'How do you balance ambition with the rest of your life?',
  'Uhuza gute impano n''ubuzima busigaye?',
  1, null),

-- Employed / Professional prompts
('work_meaning',
  'What part of your work gives you the most meaning?',
  'Ni ikihe gice cy''akazi kawe giha agaciro kenshi?',
  2, null),

('weekend_project',
  'What project or passion do you pursue outside of work?',
  'Ni iki ukora cyangwa ukunda hanze y''akazi?',
  2, null),

('leadership_lesson',
  'What leadership lesson took you the longest to learn?',
  'Ni ikihe somo ry''ubuyobozi wagize igihe kinini wiga?',
  3, null),

('purpose_beyond',
  'What are you building that goes beyond a career?',
  'Uri kubaka iki kirenze akazi?',
  3, null),

-- Marriage-intent prompts
('marriage_model',
  'What did your parents'' relationship teach you about marriage?',
  'Isano y''ababyeyi bawe yigishije iki ku bushingwe?',
  null, 'Marriage'),

('family_size',
  'How do you think about building a family together?',
  'Ubona gute kubaka umuryango hamwe?',
  null, 'Marriage'),

('in_laws',
  'How important is it to you that your partner gets along with your family?',
  'Ni iki bigufasha cyane ko mukundana n''umuryango wawe?',
  null, 'Marriage'),

-- Serious-relationship prompts
('quality_time',
  'What does quality time together look like to you?',
  'Igihe cyiza hamwe kigaragara gute kuri wewe?',
  null, 'Serious'),

('support_style',
  'How do you show up for someone you care about when things are hard?',
  'Ugaragaza gute ko uwitwararika umuntu mugihe bigoye?',
  null, 'Serious')

on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Enable on all user-facing tables. The API server uses a service
-- role key that bypasses RLS — these policies protect direct client
-- access (e.g. Supabase JS SDK) if ever used in future.
-- ════════════════════════════════════════════════════════════════════

alter table profiles        enable row level security;
alter table profile_photos  enable row level security;
alter table micro_prompts   enable row level security;
alter table vouches         enable row level security;
alter table matches         enable row level security;
alter table messages        enable row level security;
alter table interests       enable row level security;
alter table payments        enable row level security;
alter table exit_surveys    enable row level security;
alter table otp_sessions    enable row level security;
alter table trust_events    enable row level security;
alter table reports         enable row level security;

-- prompt_definitions is public read-only (no PII)
alter table prompt_definitions enable row level security;
create policy "public read prompts"
  on prompt_definitions for select using (true);

-- Service role bypasses all RLS automatically — no extra policy needed.
-- Add client-facing policies below only if you use the anon/user Supabase key directly.

-- ════════════════════════════════════════════════════════════════════
-- DONE. Your Kin database is ready.
-- ════════════════════════════════════════════════════════════════════
