import { eq, sql } from "drizzle-orm";
import {
  db, knowledgeDocumentsTable, knowledgeQueryCacheTable, mcpCatalogueTable,
} from "@workspace/db";
import { parseAwesomeMcpDirectory } from "./catalogue-parser";
import {
  MCP_DIRECTORY_URL, MCP_STANDARDS_CONTENT, MCP_STANDARDS_SOURCE, MCP_STANDARDS_TITLE,
  referenceKnowledgeContent,
} from "./catalogue-standards";

export async function importMcpCatalogue(markdown: string, revision: string, userNotes: string) {
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("A pinned 40-character Git commit is required.");
  const entries = parseAwesomeMcpDirectory(markdown);
  // An unexpected partial response must not silently become the complete imported directory.
  if (entries.length < 100) throw new Error("Suspiciously small directory. Import aborted.");
  return db.transaction(async (tx) => {
    // Serialize repeat imports without changing enterprise knowledge or duplicating rows.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(62834101)`);
    const existingEntries = await tx.select().from(mcpCatalogueTable);
    const existingByUrl = new Map(existingEntries.map((entry) => [entry.url, entry]));
    const knowledgeById = new Map((await tx.select({ id: knowledgeDocumentsTable.id, source: knowledgeDocumentsTable.source })
      .from(knowledgeDocumentsTable)).map((doc) => [doc.id, doc.source]));
    let added = 0;
    let updated = 0;
    const importedAt = new Date();

    async function upsertGuide(title: string, source: string, content: string, tags: string[]) {
      const [existing] = await tx.select().from(knowledgeDocumentsTable)
        .where(eq(knowledgeDocumentsTable.source, source)).limit(1);
      if (existing) {
        await tx.update(knowledgeDocumentsTable).set({ title, content, tags, updatedAt: importedAt })
          .where(eq(knowledgeDocumentsTable.id, existing.id));
        return existing.id;
      }
      const [created] = await tx.insert(knowledgeDocumentsTable).values({ title, content, source, tags }).returning();
      if (!created) throw new Error("Could not save standards knowledge.");
      return created.id;
    }
    const standardsKnowledgeId = await upsertGuide(MCP_STANDARDS_TITLE, MCP_STANDARDS_SOURCE,
      MCP_STANDARDS_CONTENT, ["MCP", "architecture", "standards", "enterprise"]);
    await upsertGuide("User-provided MCP architecture notes", "User-provided MCP architecture notes",
      `${userNotes}\n\nEditorial note: this user-provided text is retained verbatim; its last sentence is incomplete. Consult “${MCP_STANDARDS_TITLE}” for qualified implementation guidance and official source links.`,
      ["MCP", "user-guidance", "architecture"]);

    for (const entry of entries) {
      const existing = existingByUrl.get(entry.url);
      const source = `${MCP_DIRECTORY_URL} | ${entry.url}`;
      const knowledge = {
        title: `MCP reference: ${entry.name}`,
        source,
        content: referenceKnowledgeContent(entry, revision),
        tags: ["MCP", "catalogue", "reference", ...entry.categories, ...entry.languages, ...entry.scopes],
      };
      let knowledgeId = existing?.knowledgeId;
      if (knowledgeId && knowledgeById.get(knowledgeId) === source) {
        await tx.update(knowledgeDocumentsTable).set({ ...knowledge, updatedAt: importedAt })
          .where(eq(knowledgeDocumentsTable.id, knowledgeId));
      } else {
        const [created] = await tx.insert(knowledgeDocumentsTable).values(knowledge).returning({ id: knowledgeDocumentsTable.id });
        if (!created) throw new Error(`Could not save knowledge for ${entry.name}`);
        knowledgeId = created.id;
      }
      const values = { ...entry, sourceRevision: revision, knowledgeId, importedAt };
      if (existing) {
        await tx.update(mcpCatalogueTable).set(values).where(eq(mcpCatalogueTable.id, existing.id));
        updated++;
      } else {
        await tx.insert(mcpCatalogueTable).values(values);
        added++;
      }
    }
    // Keep historical entries if upstream removes them; do not delete human-edited knowledge.
    // Only entries in this imported revision are included by catalogue listing queries.
    await tx.delete(knowledgeQueryCacheTable);
    return { imported: entries.length, added, updated, standardsKnowledgeId, sourceRevision: revision, importedAt };
  });
}
