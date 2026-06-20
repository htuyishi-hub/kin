import { pgTable, text, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const vouchesTable = pgTable("vouches", {
  id: uuid("id").primaryKey().defaultRandom(),
  vouchedUser: uuid("vouched_user").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  voucher: uuid("voucher").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  status: text("status").default("pending").notNull(), // pending | confirmed | revoked
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
}, (table) => [
  unique("unique_vouch_pair").on(table.vouchedUser, table.voucher),
]);

export type Vouch = typeof vouchesTable.$inferSelect;
export type InsertVouch = typeof vouchesTable.$inferInsert;
