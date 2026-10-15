import { bigint, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// One short row lock serializes admission across every API replica.
export const mcpDiscoveryCoordinationTable = pgTable("mcp_discovery_coordination", {
  id: text("id").primaryKey(),
  revision: bigint("revision", { mode: "bigint" }).notNull().default(sql`0`),
  state: jsonb("state").notNull().default({}),
});
