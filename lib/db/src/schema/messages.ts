import { pgTable, text, smallint, boolean, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { profilesTable } from "./profiles";
import { matchesTable } from "./matching";
import { promptDefinitionsTable } from "./prompts";

export const messagesTable = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  phase: smallint("phase").default(1).notNull(),
  promptKey: text("prompt_key").references(() => promptDefinitionsTable.key),
  isSystem: boolean("is_system").default(false).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  index("messages_match_id_idx").on(table.matchId),
  index("messages_match_created_idx").on(table.matchId, table.createdAt),
]);

export const exitSurveysTable = pgTable("exit_surveys", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  respondentId: uuid("respondent_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  metInPerson: boolean("met_in_person"),
  wasRespectful: boolean("was_respectful"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
});

export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = typeof messagesTable.$inferInsert;
export type ExitSurvey = typeof exitSurveysTable.$inferSelect;
