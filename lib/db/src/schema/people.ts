import { pgTable, date, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profilesTable } from "./profiles";

export const peopleImpressionsTable = pgTable("people_impressions", {
  profileId: uuid("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  viewerId: uuid("viewer_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  viewDate: date("view_date").notNull().default(sql`CURRENT_DATE`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.profileId, table.viewerId, table.viewDate] }),
]);

export type PeopleImpression = typeof peopleImpressionsTable.$inferSelect;
export type InsertPeopleImpression = typeof peopleImpressionsTable.$inferInsert;
