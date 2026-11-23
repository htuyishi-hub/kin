import { pgTable, text, smallint, uuid, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

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

export type OtpSession = typeof otpSessionsTable.$inferSelect;
export type TrustEvent = typeof trustEventsTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
