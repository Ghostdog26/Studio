import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const knowledgeQueryHistoryTable = pgTable("knowledge_query_history", {
  workspaceId: text("workspace_id"),
  userId: text("user_id"),
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  cached: boolean("cached").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type KnowledgeQueryHistory =
  typeof knowledgeQueryHistoryTable.$inferSelect;
