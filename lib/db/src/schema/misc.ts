import { pgTable, text, smallint, uuid, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";
import { matchesTable } from "./matching";

// OTP sessions for phone verification
export const otpSessionsTable = pgTable("otp_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneNumber: text("phone_number").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Trust events audit log
export const trustEventsTable = pgTable("trust_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  delta: smallint("delta").notNull(),
  sourceId: uuid("source_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// User reports
export const reportsTable = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  reportedId: uuid("reported_id").references(() => profilesTable.id),
  postId: uuid("post_id"),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").default("pending").notNull(),
  reviewedBy: uuid("reviewed_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Name searches tracker (Who Searched My Name - 300 RWF)
export const nameSearchesTable = pgTable("name_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  searcherId: uuid("searcher_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  searchedQuery: text("searched_query").notNull(),
  targetProfileId: uuid("target_profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  isUnmasked: boolean("is_unmasked").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_name_searches_target").on(table.targetProfileId),
]);

// Photo compliments (200 RWF)
export const photoCommentsTable = pgTable("photo_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  targetProfileId: uuid("target_profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(),
  commentText: text("comment_text").notNull(),
  amountRwf: integer("amount_rwf").default(200).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Curated Kigali date spot invitations
export const dateInvitesTable = pgTable("date_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  spotName: text("spot_name").notNull(),
  spotArea: text("spot_area").notNull(),
  proposedTime: text("proposed_time").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Hide Friends & Block Contacts
export const blockedContactsTable = pgTable("blocked_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  blockedPhone: text("blocked_phone").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_blocked_contacts_user").on(table.userId),
  index("idx_blocked_contacts_phone").on(table.blockedPhone),
]);

export type OtpSession = typeof otpSessionsTable.$inferSelect;
export type TrustEvent = typeof trustEventsTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
export type NameSearch = typeof nameSearchesTable.$inferSelect;
export type PhotoComment = typeof photoCommentsTable.$inferSelect;
export type DateInvite = typeof dateInvitesTable.$inferSelect;
export type BlockedContact = typeof blockedContactsTable.$inferSelect;
