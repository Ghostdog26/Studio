import { and, eq, notExists } from "drizzle-orm";
import { db, enterpriseDocumentGrantsTable, knowledgeDocumentsTable } from "@workspace/db";

// Shared demo routes cannot read or mutate enterprise documents. The grant anti-join also
// protects older/directly provisioned grants that predate the persistent classification flag.
// Disabled/revoked grants do not declassify a document.
export function publicKnowledgeCondition() {
  return and(
    eq(knowledgeDocumentsTable.enterpriseRestricted, false),
    notExists(db.select({ id: enterpriseDocumentGrantsTable.documentId })
      .from(enterpriseDocumentGrantsTable)
      .where(eq(enterpriseDocumentGrantsTable.documentId, knowledgeDocumentsTable.id))),
  );
}
