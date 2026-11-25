import { pgTable, text, boolean, smallint, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const interestsTable = pgTable("interests", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromUser: uuid("from_user").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  toUser: uuid("to_user").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  reactionType: text("reaction_type").$type<"campus" | "coffee" | "serious" | null>(),
  isGoldenBid: boolean("is_golden_bid").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("unique_interest_pair").on(table.fromUser, table.toUser),
]);

export const passesTable = pgTable("passes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  targetUserId: uuid("target_user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("soft_pass"), // soft_pass | hard_reject
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null for hard reject, 14 days for soft pass
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("unique_pass_pair").on(table.userId, table.targetUserId),
]);

export const matchesTable = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userA: uuid("user_a").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  userB: uuid("user_b").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  status: text("status").default("active").notNull(), // active | expired | closed | exited

  assignedFirstUser: uuid("assigned_first_user").references(() => profilesTable.id),
  firstMessageSent: boolean("first_message_sent").default(false),

  conversationPhase: smallint("conversation_phase").default(1),
  phase1CompleteA: boolean("phase1_complete_a").default(false),
  phase1CompleteB: boolean("phase1_complete_b").default(false),
  phase2CompleteA: boolean("phase2_complete_a").default(false),
  phase2CompleteB: boolean("phase2_complete_b").default(false),

  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  smartCloseAt: timestamp("smart_close_at", { withTimezone: true }),

  streakCount: smallint("streak_count").default(0).notNull(),
  lastStreakDate: text("last_streak_date"),
  isRevived: boolean("is_revived").default(false).notNull(),

  exitPrompted: boolean("exit_prompted").default(false),
  exitedAt: timestamp("exited_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  unique("unique_match_pair").on(table.userA, table.userB),
]);

export type Interest = typeof interestsTable.$inferSelect;
export type InsertInterest = typeof interestsTable.$inferInsert;
export type Pass = typeof passesTable.$inferSelect;
export type InsertPass = typeof passesTable.$inferInsert;
export type Match = typeof matchesTable.$inferSelect;
export type InsertMatch = typeof matchesTable.$inferInsert;
