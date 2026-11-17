CREATE TABLE "profiles" (
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
--> statement-breakpoint
CREATE TABLE "profile_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text,
	"is_primary" boolean DEFAULT false,
	"is_blurred" boolean DEFAULT true,
	"sort_order" smallint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "micro_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt_key" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" smallint DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prompt_definitions" (
	"key" text PRIMARY KEY NOT NULL,
	"prompt_text" text NOT NULL,
	"prompt_rw" text NOT NULL,
	"tier" smallint,
	"intent" text
);
--> statement-breakpoint
CREATE TABLE "vouches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vouched_user" uuid NOT NULL,
	"voucher" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "unique_vouch_pair" UNIQUE("vouched_user","voucher")
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user" uuid NOT NULL,
	"to_user" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "unique_interest_pair" UNIQUE("from_user","to_user")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a" uuid NOT NULL,
	"user_b" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_first_user" uuid,
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
--> statement-breakpoint
CREATE TABLE "exit_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"respondent_id" uuid NOT NULL,
	"met_in_person" boolean,
	"was_respectful" boolean,
	"submitted_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"phase" smallint DEFAULT 1 NOT NULL,
	"prompt_key" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_type" text NOT NULL,
	"amount_rwf" integer NOT NULL,
	"momo_reference" text,
	"momo_transaction_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"fulfilled" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	CONSTRAINT "payments_momo_reference_unique" UNIQUE("momo_reference")
);
--> statement-breakpoint
CREATE TABLE "otp_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trust_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"delta" smallint NOT NULL,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_registry" (
	"registration_number" text PRIMARY KEY NOT NULL,
	"campus" text NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"claimed_by_profile" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"registration_number" text NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invited_user_id" uuid,
	"invite_code" text NOT NULL,
	"status" text DEFAULT 'accepted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_prompts" ADD CONSTRAINT "micro_prompts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_prompts" ADD CONSTRAINT "micro_prompts_prompt_key_prompt_definitions_key_fk" FOREIGN KEY ("prompt_key") REFERENCES "public"."prompt_definitions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouches" ADD CONSTRAINT "vouches_vouched_user_profiles_id_fk" FOREIGN KEY ("vouched_user") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouches" ADD CONSTRAINT "vouches_voucher_profiles_id_fk" FOREIGN KEY ("voucher") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_from_user_profiles_id_fk" FOREIGN KEY ("from_user") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interests" ADD CONSTRAINT "interests_to_user_profiles_id_fk" FOREIGN KEY ("to_user") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_profiles_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_profiles_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_assigned_first_user_profiles_id_fk" FOREIGN KEY ("assigned_first_user") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_surveys" ADD CONSTRAINT "exit_surveys_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_surveys" ADD CONSTRAINT "exit_surveys_respondent_id_profiles_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_prompt_key_prompt_definitions_key_fk" FOREIGN KEY ("prompt_key") REFERENCES "public"."prompt_definitions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_id_profiles_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_events" ADD CONSTRAINT "trust_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_registry" ADD CONSTRAINT "student_registry_claimed_by_profile_profiles_id_fk" FOREIGN KEY ("claimed_by_profile") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_attempts" ADD CONSTRAINT "verification_attempts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_id_profiles_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_user_id_profiles_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_match_id_idx" ON "messages" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "messages_match_created_idx" ON "messages" USING btree ("match_id","created_at");