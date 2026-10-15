import { pool } from "@workspace/db";

// Run after schema push, before starting API replicas. Transactional and repeatable.
try {
  await pool.query(`
    BEGIN;
    INSERT INTO mcp_discovery_coordination (id) VALUES ('discovery') ON CONFLICT DO NOTHING;
    CREATE OR REPLACE FUNCTION invalidate_mcp_discovery() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      UPDATE mcp_discovery_coordination SET revision = revision + 1 WHERE id = 'discovery';
      IF NOT FOUND THEN RAISE EXCEPTION 'Discovery coordination is not initialized'; END IF;
      RETURN NULL;
    END;
    $$;
    ${["enterprise_grants", "enterprise_document_grants", "knowledge_documents"].map(table => `
      DROP TRIGGER IF EXISTS invalidate_mcp_discovery ON ${table};
      CREATE TRIGGER invalidate_mcp_discovery
      AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${table}
      FOR EACH STATEMENT EXECUTE FUNCTION invalidate_mcp_discovery();
    `).join("\n")}
    COMMIT;
  `);
} finally {
  await pool.end();
}
