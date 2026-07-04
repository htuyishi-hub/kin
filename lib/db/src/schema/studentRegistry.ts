import { pgTable, text, boolean, uuid, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const studentRegistryTable = pgTable("student_registry", {
  registrationNumber: text("registration_number").primaryKey(),
  campus: text("campus").notNull(),


  claimed: boolean("claimed").notNull().default(false),

  claimedByProfile: uuid("claimed_by_profile").references(() => profilesTable.id, {
    onDelete: "restrict",
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

