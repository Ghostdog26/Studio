import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mcpComponentsTable = pgTable("mcp_components", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull(),
  transport: text("transport").notNull().default("stdio"),
  jsonSchema: jsonb("json_schema")
    .$type<Record<string, unknown>>()
    .notNull(),
  status: text("status").notNull().default("draft"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertMcpComponentSchema = createInsertSchema(
  mcpComponentsTable,
).omit({ id: true, updatedAt: true });

export type InsertMcpComponent = z.infer<typeof insertMcpComponentSchema>;
export type McpComponent = typeof mcpComponentsTable.$inferSelect;
