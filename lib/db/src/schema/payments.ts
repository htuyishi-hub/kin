import { pgTable, text, integer, boolean, uuid, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  productType: text("product_type").notNull(),
  // tokens_3 | crossing_fee | profile_boost | second_chance | professional_monthly
  amountRwf: integer("amount_rwf").notNull(),
  momoReference: text("momo_reference").unique(),
  momoTransactionId: text("momo_transaction_id"),
  status: text("status").default("pending").notNull(),
  // pending | completed | failed | refunded
  fulfilled: boolean("fulfilled").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Payment = typeof paymentsTable.$inferSelect;
export type InsertPayment = typeof paymentsTable.$inferInsert;
