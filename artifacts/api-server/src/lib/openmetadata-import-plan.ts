import { createHash } from "node:crypto";

const digestPrefix = "openmetadata-managed-sha256:";
type ReferenceDocument = { title: string; source: string; content: string; tags: string[] };
function contentDigest(doc: ReferenceDocument) {
  return createHash("sha256").update(JSON.stringify([
    doc.title, doc.source, doc.content, doc.tags.filter(tag => !tag.startsWith(digestPrefix)),
  ])).digest("hex");
}
export function managedOpenMetadataDocument(doc: ReferenceDocument): ReferenceDocument {
  return { ...doc, tags: [...doc.tags, `${digestPrefix}${contentDigest(doc)}`] };
}
export function openMetadataImportAction(existing: ReferenceDocument | undefined, next: ReferenceDocument) {
  if (!existing) return "insert";
  if (!existing.tags.includes(`${digestPrefix}${contentDigest(existing)}`)) {
    throw new Error(`Reference source collision or human edits: ${existing.source}. Preserve the edited document under a different source before importing.`);
  }
  return contentDigest(existing) === contentDigest(next) ? "unchanged" : "update";
}
