import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const invitesTable = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  inviterId: uuid("inviter_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  invitedUserId: uuid("invited_user_id").references(() => profilesTable.id, { onDelete: "cascade" }),
  inviteCode: text("invite_code").notNull(),
  status: text("status").default("accepted").notNull(), // pending | accepted | revoked
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

export type Invite = typeof invitesTable.$inferSelect;
export type InsertInvite = typeof invitesTable.$inferInsert;
