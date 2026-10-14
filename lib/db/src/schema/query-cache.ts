import { jsonb, pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const knowledgeQueryCacheTable = pgTable("knowledge_query_cache", {
  id: serial("id").primaryKey(),
  queryHash: text("query_hash").notNull().unique(),
  normalizedQuery: text("normalized_query").notNull(),
  answer: text("answer").notNull(),
  sources: jsonb("sources")
    .$type<Array<{ id: number; title: string; excerpt: string; score: number }>>()
    .notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type KnowledgeQueryCacheEntry =
  typeof knowledgeQueryCacheTable.$inferSelect;
