import { pgTable, text, smallint, uuid, timestamp } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";

export const promptDefinitionsTable = pgTable("prompt_definitions", {
  key: text("key").primaryKey(),
  promptText: text("prompt_text").notNull(),
  promptRw: text("prompt_rw").notNull(),
  tier: smallint("tier"),
  intent: text("intent"),
});

export const microPromptsTable = pgTable("micro_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  promptKey: text("prompt_key").notNull().references(() => promptDefinitionsTable.key),
  answer: text("answer").notNull(),
  sortOrder: smallint("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type PromptDefinition = typeof promptDefinitionsTable.$inferSelect;
export type MicroPrompt = typeof microPromptsTable.$inferSelect;
export type InsertMicroPrompt = typeof microPromptsTable.$inferInsert;
