-- =============================================================================
-- KIN DATING PLATFORM — FULL SUPABASE SCHEMA & SEED SCRIPT
-- Project: aqxjlxxigwlfgpeityhz
-- Generated for Supabase SQL Editor
-- Includes:
--   1. pgcrypto & uuid extensions
--   2. All 16 Tables (Profiles, Invites, UR Verification, Matches, Messages, etc.)
--   3. Foreign keys & composite indexes (real-time chat optimizations)
--   4. Seed data: 22 Micro-Prompt Definitions (EN + Kinyarwanda)
--   5. Seed data: University of Rwanda sample student registry
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS "profiles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "phone_number" text NOT NULL,
    "full_name" text,
    "gender" text,
    "date_of_birth" date,
    "hidden_tier" smallint DEFAULT 1,
    "primary_intent" text,
    "trust_score" smallint DEFAULT 50,
    "campus_name" text,
    "faculty" text,
    "year_of_study" smallint,
    "hostel_name" text,
    "city" text,
    "district" text,
    "google_id" text,
    "email" text,
    "phone_verified" boolean DEFAULT false,
    "id_verified" boolean DEFAULT false,
    "vouch_count" smallint DEFAULT 0,
    "verified_adult" boolean DEFAULT false,
    "invite_code" text,
    "invited_by_profile" uuid,
    "invite_count" smallint DEFAULT 0,
    "is_verified" boolean DEFAULT false,
    "institution" text,
    "campus" text,
    "registration_number" text,
    "institution_verified" boolean DEFAULT false,
    "verification_method" text,
    "proximity_consent" boolean DEFAULT false,
    "crossing_fee_paid" boolean DEFAULT false,
    "tokens_remaining" smallint DEFAULT 0,
    "profile_active" boolean DEFAULT true,
    "profile_paused" boolean DEFAULT false,
    "onboarding_complete" boolean DEFAULT false,
    "push_notification_token" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "last_active" timestamp with time zone DEFAULT now(),
    CONSTRAINT "profiles_phone_number_unique" UNIQUE("phone_number"),
    CONSTRAINT "profiles_google_id_unique" UNIQUE("google_id"),
    CONSTRAINT "profiles_invite_code_unique" UNIQUE("invite_code")
);

-- 2. PROMPT DEFINITIONS
CREATE TABLE IF NOT EXISTS "prompt_definitions" (
    "key" text PRIMARY KEY NOT NULL,
    "prompt_text" text NOT NULL,
    "prompt_rw" text NOT NULL,
    "tier" smallint,
    "intent" text
);

-- 3. PROFILE PHOTOS
CREATE TABLE IF NOT EXISTS "profile_photos" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "storage_path" text NOT NULL,
    "public_url" text,
    "is_primary" boolean DEFAULT false,
    "is_blurred" boolean DEFAULT true,
    "sort_order" smallint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 4. MICRO PROMPTS
CREATE TABLE IF NOT EXISTS "micro_prompts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "prompt_key" text NOT NULL REFERENCES "prompt_definitions"("key"),
    "answer" text NOT NULL,
    "sort_order" smallint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 5. VOUCHES
CREATE TABLE IF NOT EXISTS "vouches" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "vouched_user" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "voucher" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "status" text DEFAULT 'pending' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "confirmed_at" timestamp with time zone,
    CONSTRAINT "unique_vouch_pair" UNIQUE("vouched_user","voucher")
);

-- 6. INTERESTS
CREATE TABLE IF NOT EXISTS "interests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "from_user" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "to_user" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "unique_interest_pair" UNIQUE("from_user","to_user")
);

-- 7. MATCHES
CREATE TABLE IF NOT EXISTS "matches" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_a" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "user_b" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "status" text DEFAULT 'active' NOT NULL,
    "assigned_first_user" uuid REFERENCES "profiles"("id"),
    "first_message_sent" boolean DEFAULT false,
    "conversation_phase" smallint DEFAULT 1,
    "phase1_complete_a" boolean DEFAULT false,
    "phase1_complete_b" boolean DEFAULT false,
    "phase2_complete_a" boolean DEFAULT false,
    "phase2_complete_b" boolean DEFAULT false,
    "expires_at" timestamp with time zone,
    "last_message_at" timestamp with time zone,
    "smart_close_at" timestamp with time zone,
    "exit_prompted" boolean DEFAULT false,
    "exited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "unique_match_pair" UNIQUE("user_a","user_b")
);

-- 8. EXIT SURVEYS
CREATE TABLE IF NOT EXISTS "exit_surveys" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
    "respondent_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "met_in_person" boolean,
    "was_respectful" boolean,
    "submitted_at" timestamp with time zone DEFAULT now()
);

-- 9. MESSAGES
CREATE TABLE IF NOT EXISTS "messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE,
    "sender_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "content" text NOT NULL,
    "phase" smallint DEFAULT 1 NOT NULL,
    "prompt_key" text REFERENCES "prompt_definitions"("key"),
    "is_system" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "messages_match_id_idx" ON "messages" USING btree ("match_id");
CREATE INDEX IF NOT EXISTS "messages_match_created_idx" ON "messages" USING btree ("match_id","created_at");

-- 10. PAYMENTS
CREATE TABLE IF NOT EXISTS "payments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "product_type" text NOT NULL,
    "amount_rwf" integer NOT NULL,
    "momo_reference" text UNIQUE,
    "momo_transaction_id" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "fulfilled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now(),
    "completed_at" timestamp with time zone
);

-- 11. OTP SESSIONS
CREATE TABLE IF NOT EXISTS "otp_sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "phone_number" text NOT NULL,
    "code" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 12. REPORTS
CREATE TABLE IF NOT EXISTS "reports" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "reporter_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "reported_id" uuid NOT NULL REFERENCES "profiles"("id"),
    "reason" text NOT NULL,
    "details" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "reviewed_by" uuid,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 13. TRUST EVENTS
CREATE TABLE IF NOT EXISTS "trust_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "event_type" text NOT NULL,
    "delta" smallint NOT NULL,
    "source_id" uuid,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 14. STUDENT REGISTRY (University of Rwanda Verification)
CREATE TABLE IF NOT EXISTS "student_registry" (
    "registration_number" text PRIMARY KEY NOT NULL,
    "campus" text NOT NULL,
    "claimed" boolean DEFAULT false NOT NULL,
    "claimed_by_profile" uuid REFERENCES "profiles"("id") ON DELETE RESTRICT,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 15. VERIFICATION ATTEMPTS
CREATE TABLE IF NOT EXISTS "verification_attempts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "registration_number" text NOT NULL,
    "result" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now()
);

-- 16. INVITES (Community Referral & Instant Verification Engine)
CREATE TABLE IF NOT EXISTS "invites" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "inviter_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "invited_user_id" uuid REFERENCES "profiles"("id") ON DELETE CASCADE,
    "invite_code" text NOT NULL,
    "status" text DEFAULT 'accepted' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "accepted_at" timestamp with time zone
);

-- =============================================================================
-- SEED DATA: PROMPT DEFINITIONS (Universal, Tier 2, Tier 3)
-- =============================================================================
INSERT INTO "prompt_definitions" ("key", "prompt_text", "prompt_rw", "tier", "intent") VALUES
('family_role', 'What role does family play in your life decisions?', 'Umuryango ufite uruhare rungana iki mu mwanzuro wawe?', null, null),
('values_guide', 'What values guide how you treat people?', 'Ni ikihe gitekerezo cyagufasha gukoranya n''abandi?', null, null),
('community_means', 'What does community mean to you?', 'Umuryango bisobanura iki kuri wewe?', null, null),
('free_time', 'How do you spend a peaceful weekend?', 'Wikend y''amahoro uyimanagira gute?', null, null),
('growth_edge', 'What are you working on growing in yourself right now?', 'None uri gukoraho iki kugirango ukure nk''umuntu?', null, null),
('admire_others', 'What quality do you most admire in others?', 'Ni ikihe gitangaza ukunda cyane mu bantu?', null, null),
('faith_practice', 'How does faith or spirituality show up in your daily life?', 'Ukwizera cyangwa umwuka biragaragara gute mu buzima bwawe bwa buri munsi?', null, null),
('conflict_style', 'How do you handle disagreement in a relationship?', 'Ugaragaza gute impaka mu isano?', null, null),
('partner_words', 'In three words, describe your ideal partner.', 'Sobanura inshuti y''amoro yawe nziza mu magambo atatu.', null, null),
('deal_breaker', 'What is the one thing you cannot compromise on in a partner?', 'Ni ikihe kintu utashobora guha inshuti yawe uruhushya?', null, null),
('generosity_story', 'Tell a story of when someone''s kindness changed your day.', 'Vuga inkuru y''igihe ineza y''umuntu yahinduye umunsi wawe.', null, null),
('cultural_roots', 'What tradition from your culture do you treasure most?', 'Ni uwuhe muco wo mu muco wawe ukunda cyane?', null, null),
('long_term_vision', 'Where do you see yourself contributing most in ten years?', 'Ubona uzatanga he umusanzu ukomeye mu myaka icumi iri imbere?', 2, 'marriage'),
('parenting_view', 'What is one value you would most want to pass to children?', 'Ni akahe gaciro wifuza cyane kugeza ku bana?', 2, 'marriage'),
('work_life_balance', 'How do you maintain balance between your work and your relationships?', 'Ufata ute umwanya w''akazi n''umwanya w''abantu ukunda?', 2, null),
('financial_philosophy', 'How do you approach saving, giving, and spending money?', 'Ufata ute ibyo kubika amafaranga, gutanga, no gukoresha?', 2, 'marriage'),
('life_purpose', 'What is the calling or purpose you feel guided by?', 'Ni uwuhe muhamagaro cyangwa intego wumva ikuyobora?', 3, null),
('vulnerability_moment', 'When was the last time you asked for help, and what happened?', 'Ni ryari riheruka wasabye ubufasha, kandi byagenze bite?', 3, null),
('legacy_thought', 'What kind of memory do you want to leave with the people you meet?', 'Ni urwibutso rumeze rute wifuza gusiga mu bo uhura na bo?', 3, null),
('communication_deep', 'How do you know when you truly understand another person?', 'Umenya ute ko wumvise umuntu by''ukuri?', 3, null)
ON CONFLICT ("key") DO NOTHING;

-- =============================================================================
-- SEED DATA: SAMPLE UNIVERSITY OF RWANDA STUDENT REGISTRY
-- =============================================================================
INSERT INTO "student_registry" ("registration_number", "campus", "claimed", "claimed_by_profile", "created_at", "updated_at") VALUES
  ('222012345', 'Huye', false, null, now(), now()),
  ('223045678', 'Nyarugenge', false, null, now(), now()),
  ('224078901', 'Remera', false, null, now(), now()),
  ('225028190', 'Huye', false, null, now(), now()),
  ('226099999', 'Gikondo', false, null, now(), now())
ON CONFLICT ("registration_number") DO NOTHING;
