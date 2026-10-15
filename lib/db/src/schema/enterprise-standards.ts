import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";
import { knowledgeDocumentsTable } from "./knowledge";

// Published versions are insert-only through the operator CLI, never user writable.
export const enterpriseStandardsTable = pgTable("enterprise_standards", {
  version: text("version").primaryKey(),
  digest: text("digest").notNull(),
  bundle: jsonb("bundle").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const insertEnterpriseStandardSchema = createInsertSchema(enterpriseStandardsTable);
export type InsertEnterpriseStandard = z.infer<typeof insertEnterpriseStandardSchema>;

// IDs are Cloudflare OS's workspace DO id and authenticated user identifier, not client headers.
export const enterpriseGrantsTable = pgTable("enterprise_grants", {
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  standardsVersion: text("standards_version").notNull().references(() => enterpriseStandardsTable.version),
  templateId: text("template_id").notNull(),
  permittedTools: text("permitted_tools").array().notNull(),
  tokenHash: text("token_hash").unique(),
  enabled: boolean("enabled").notNull().default(true),
}, table => [primaryKey({ columns: [table.workspaceId, table.userId] })]);
export const insertEnterpriseGrantSchema = createInsertSchema(enterpriseGrantsTable);
export type InsertEnterpriseGrant = z.infer<typeof insertEnterpriseGrantSchema>;

export const enterpriseDocumentGrantsTable = pgTable("enterprise_document_grants", {
  workspaceId: text("workspace_id").notNull(),
  userId: text("user_id").notNull(),
  documentId: integer("document_id").notNull().references(() => knowledgeDocumentsTable.id, { onDelete: "cascade" }),
}, table => [primaryKey({ columns: [table.workspaceId, table.userId, table.documentId] })]);
export const insertEnterpriseDocumentGrantSchema = createInsertSchema(enterpriseDocumentGrantsTable);
export type InsertEnterpriseDocumentGrant = z.infer<typeof insertEnterpriseDocumentGrantSchema>;
