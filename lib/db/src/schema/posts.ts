import { pgTable, text, varchar, boolean, integer, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const postsTable = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  text: varchar("text", { length: 200 }).notNull(),
  photoPaths: text("photo_paths").array().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  impressions: integer("impressions").default(0).notNull(),
});

export const postLikesTable = pgTable("post_likes", {
  postId: uuid("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.postId, table.userId] }),
]);

export const postHidesTable = pgTable("post_hides", {
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.authorId] }),
]);

export const postImpressionsTable = pgTable("post_impressions", {
  postId: uuid("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  viewerId: uuid("viewer_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.postId, table.viewerId] }),
]);

export type Post = typeof postsTable.$inferSelect;
export type InsertPost = typeof postsTable.$inferInsert;
export type PostLike = typeof postLikesTable.$inferSelect;
export type PostHide = typeof postHidesTable.$inferSelect;
export type PostImpression = typeof postImpressionsTable.$inferSelect;
