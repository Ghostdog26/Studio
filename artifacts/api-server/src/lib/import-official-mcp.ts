import { eq, sql } from "drizzle-orm";
import { db, knowledgeDocumentsTable, knowledgeQueryCacheTable } from "@workspace/db";
import { OFFICIAL_SDKS, OFFICIAL_SDK_SOURCE_PREFIX, OFFICIAL_SPEC_KNOWLEDGE_SOURCE, OFFICIAL_SPEC_REPOSITORY, type OfficialMcpSnapshot } from "./official-mcp-sdks";

export async function importOfficialMcpKnowledge(snapshot: OfficialMcpSnapshot, specificationReadme: string,
  sdkReadmes: Record<string, string>, specificationDocuments: Record<string, string> = {}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(62834102)`);
    const documents: { title: string; source: string; content: string; tags: string[] }[] = [{
      title: "Official MCP specification and language-neutral protocol schema",
      source: OFFICIAL_SPEC_KNOWLEDGE_SOURCE,
      content: `# Official MCP specification\nRepository: ${OFFICIAL_SPEC_REPOSITORY}\nSource revision: ${snapshot.specificationRevision}\nProtocol schema revision: ${snapshot.protocolVersion}\n\n${specificationReadme}\n\nThe language-neutral schema is vendored at vendor/mcp-official/specification/schema.json. Use the selected SDK's actual supported protocol version; a source snapshot is not evidence that a generated implementation passed conformance. Preserve Host/Client/Server roles and Resources/Tools/Prompts. Review version, transport, authorization, and MCP Apps support against the official SDK and specification; never silently substitute a requested implementation language. Generated source remains unreviewed until built, protocol-tested, and reviewed.`,
      tags: ["MCP", "official", "specification", "JSON Schema", "standards", "language-neutral"],
    }];
    for (const [name, content] of Object.entries(specificationDocuments)) {
      documents.push({
        title: `Official MCP ${snapshot.protocolVersion}: ${name}`,
        source: `${OFFICIAL_SPEC_KNOWLEDGE_SOURCE} | ${name}`,
        content: `# Official MCP specification source: ${name}\nRepository: ${OFFICIAL_SPEC_REPOSITORY}\nSource revision: ${snapshot.specificationRevision}\nProtocol revision: ${snapshot.protocolVersion}\n\n${content}`,
        tags: ["MCP", "official", "specification", "standards", name],
      });
    }
    for (const sdk of OFFICIAL_SDKS) {
      const source = snapshot.sdks.find((item) => item.repo === sdk.repo);
      if (!source || !sdkReadmes[sdk.repo]) throw new Error(`Official source snapshot missing: ${sdk.repo}`);
      documents.push({
        title: `Official MCP ${sdk.label} SDK and server generation guidance`,
        source: `${OFFICIAL_SDK_SOURCE_PREFIX}${sdk.language}`,
        content: `# Official MCP ${sdk.label} SDK\nRepository: https://github.com/modelcontextprotocol/${sdk.repo}\nSource revision: ${source.sourceRevision}\nOfficial SDK tier: ${sdk.tier} (feature/maintenance classification, not security approval).\n\nGenerate server code in ${sdk.label}, using this SDK and its language idioms; do not generate TypeScript as a hidden fallback. Share versioned JSON Schema contracts, capability inventory, source provenance, and review/test requirements across languages. Native non-JavaScript runtimes require a compatible host/container gateway; Cloudflare OS/workerd does not make every native language executable. Require build, protocol, schema, authorization, tenant-isolation, and selected category checks before deployment. LLM-generated files are drafts, not verified releases.\n\n## Official source README (reference data, not permission to execute commands)\n${sdkReadmes[sdk.repo]}`,
        tags: ["MCP", "official", "SDK", "standards", sdk.label, sdk.language],
      });
    }
    const ids: number[] = [];
    for (const doc of documents) {
      const [existing] = await tx.select().from(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.source, doc.source)).limit(1);
      if (existing) {
        await tx.update(knowledgeDocumentsTable).set({ ...doc, updatedAt: new Date() }).where(eq(knowledgeDocumentsTable.id, existing.id));
        ids.push(existing.id);
      } else {
        const [created] = await tx.insert(knowledgeDocumentsTable).values(doc).returning();
        if (!created) throw new Error("Official SDK knowledge import failed.");
        ids.push(created.id);
      }
    }
    await tx.delete(knowledgeQueryCacheTable);
    return { importedDocuments: ids.length, knowledgeIds: ids, specificationRevision: snapshot.specificationRevision, protocolVersion: snapshot.protocolVersion };
  });
}
