import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { knowledgeDocumentsTable } from "./knowledge";

export const mcpCatalogueTable = pgTable("mcp_catalogue", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  description: text("description").notNull(),
  categories: text("categories").array().notNull().default([]),
  languages: text("languages").array().notNull().default([]),
  scopes: text("scopes").array().notNull().default([]),
  platforms: text("platforms").array().notNull().default([]),
  officialListed: boolean("official_listed").notNull().default(false),
  reviewStatus: text("review_status").notNull().default("unreviewed"),
  knowledgeId: integer("knowledge_id").references(() => knowledgeDocumentsTable.id, { onDelete: "set null" }),
  sourceRevision: text("source_revision").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMcpCatalogueSchema = createInsertSchema(mcpCatalogueTable).omit({ id: true, importedAt: true });
export type InsertMcpCatalogue = z.infer<typeof insertMcpCatalogueSchema>;
export type McpCatalogue = typeof mcpCatalogueTable.$inferSelect;
