import { pgTable, text, boolean, smallint, uuid, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const profilePhotosTable = pgTable("profile_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  publicUrl:   text("public_url"),
  isPrimary: boolean("is_primary").default(false),
  isBlurred: boolean("is_blurred").default(true),
  sortOrder: smallint("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type ProfilePhoto = typeof profilePhotosTable.$inferSelect;
export type InsertProfilePhoto = typeof profilePhotosTable.$inferInsert;
