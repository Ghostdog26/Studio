import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const knowledgeDocumentsTable = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull().default("Workspace wiki"),
  tags: text("tags").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertKnowledgeDocumentSchema = createInsertSchema(
  knowledgeDocumentsTable,
).omit({ id: true, updatedAt: true });

export type InsertKnowledgeDocument = z.infer<
  typeof insertKnowledgeDocumentSchema
>;
export type KnowledgeDocument = typeof knowledgeDocumentsTable.$inferSelect;
