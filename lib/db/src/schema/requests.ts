import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles";

export const talkRequestsTable = pgTable("talk_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  receiverId: uuid("receiver_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  status: text("status").$type<"pending" | "accepted" | "declined" | "expired">().default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).default(sql`(NOW() + INTERVAL '7 days')`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TalkRequest = typeof talkRequestsTable.$inferSelect;
export type InsertTalkRequest = typeof talkRequestsTable.$inferInsert;
