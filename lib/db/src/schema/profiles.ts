import { pgTable, text, boolean, smallint, date, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const profilesTable = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneNumber: text("phone_number").unique(),
  fullName: text("full_name"),
  gender: text("gender"),
  dateOfBirth: date("date_of_birth"),

  // Invisible segmentation — never expose to client
  hiddenTier: smallint("hidden_tier").default(1),
  primaryIntent: text("primary_intent"),
  intentClass: text("intent_class"),
  trustScore: integer("trust_score").default(1),
  approvalScore: integer("approval_score").default(0),
  goldenBidsRemaining: integer("golden_bids_remaining").default(3),

  // Campus / location
  campusName: text("campus_name"),
  faculty: text("faculty"),
  yearOfStudy: smallint("year_of_study"),
  hostelName: text("hostel_name"),
  city: text("city"),
  district: text("district"),

  // Verification flags
  googleId: text("google_id").unique(),
  email: text("email"),

  phoneVerified: boolean("phone_verified").default(false),
  idVerified: boolean("id_verified").default(false),
  vouchCount: smallint("vouch_count").default(0),
  verifiedAdult: boolean("verified_adult").default(false),

  // Invite system
  inviteCode: text("invite_code").unique(),
  invitedByProfile: uuid("invited_by_profile"),
  inviteCount: smallint("invite_count").default(0),
  isVerified: boolean("is_verified").default(false),

  // UR verification
  institution: text("institution").$type<"university_of_rwanda" | null>(),
  campus: text("campus"),
  registrationNumber: text("registration_number"),
  institutionVerified: boolean("institution_verified").default(false),
  verificationMethod: text("verification_method").$type<"ur_registry" | "community" | "invite" | null>(),
  accountStatus: text("account_status").$type<"waitlisted" | "active" | "banned" | "suspended">().default("waitlisted"),

  // Feature flags
  proximityConsent: boolean("proximity_consent").default(false),
  crossingFeePaid: boolean("crossing_fee_paid").default(false),
  tokensRemaining: smallint("tokens_remaining").default(0),
  profileActive: boolean("profile_active").default(true),
  profilePaused: boolean("profile_paused").default(false),

  onboardingComplete: boolean("onboarding_complete").default(false),
  language: text("language").$type<"en" | "rw">().default("en"),
  readReceiptsEnabled: boolean("read_receipts_enabled").default(false),

  // Profile extras (optional)
  bio: text("bio"),
  tags: text("tags").array(),
  voiceIntroPath: text("voice_intro_path"),
  voiceIntroDurationMs: integer("voice_intro_duration_ms"),

  pushNotificationToken: text("push_notification_token"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastActive: timestamp("last_active", { withTimezone: true }).defaultNow(),
});

export const insertProfileSchema = createInsertSchema(profilesTable);
export const selectProfileSchema = createSelectSchema(profilesTable);
export type Profile = typeof profilesTable.$inferSelect;
export type InsertProfile = typeof profilesTable.$inferInsert;
