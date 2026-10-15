import { eq, sql } from "drizzle-orm";
import { db, knowledgeDocumentsTable, knowledgeQueryCacheTable } from "@workspace/db";
import { openMetadataDocuments, OPENMETADATA_REVISION } from "@workspace/agent-runtime/openmetadata";
import { managedOpenMetadataDocument, openMetadataImportAction } from "./openmetadata-import-plan";
export async function importOpenMetadataReferences() {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(62834103)`);
    const result = { added: 0, updated: 0, unchanged: 0, sourceRevision: OPENMETADATA_REVISION, documentIds: [] as number[] };
    for (const reference of openMetadataDocuments) {
      const next = managedOpenMetadataDocument(reference);
      const existing = await tx.select().from(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.source, reference.source));
      if (existing.length > 1) throw new Error(`Duplicate OpenMetadata managed source: ${reference.source}`);
      const previous = existing[0];
      const action = openMetadataImportAction(previous, next);
      if (action === "insert") {
        const [created] = await tx.insert(knowledgeDocumentsTable).values(next).returning();
        result.documentIds.push(created!.id);
        result.added++;
      } else {
        result.documentIds.push(previous!.id);
        if (action === "update") {
          // Never alter persistent classification or existing grants.
          await tx.update(knowledgeDocumentsTable).set({ ...next, updatedAt: new Date() })
            .where(eq(knowledgeDocumentsTable.id, previous!.id));
          result.updated++;
        } else result.unchanged++;
      }
    }
    if (result.added || result.updated) await tx.delete(knowledgeQueryCacheTable);
    return result;
  });
}
