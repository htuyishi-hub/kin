import { pgTable, text, boolean, uuid, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const urVerificationAttemptsTable = pgTable("verification_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),

  profileId: uuid("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  registrationNumber: text("registration_number").notNull(),
  result: text("result").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type UrVerificationAttempt = typeof urVerificationAttemptsTable.$inferSelect;

