import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool, knowledgeDocumentsTable, knowledgeQueryCacheTable, knowledgeQueryHistoryTable, enterpriseStandardsTable, enterpriseGrantsTable, enterpriseDocumentGrantsTable } from "@workspace/db";
import { openMetadataEnterpriseStandard } from "@workspace/agent-runtime/enterprise-standards";

test("scoped provider-neutral generation returns the selected OpenMetadata profile but never grants a live connection", async () => {
  const workspaceId = `openmetadata-fixture-${randomBytes(6).toString("hex")}`;
  const userId = "fictional-user";
  const version = `998.0.${Date.now()}`;
  const bundle = { ...openMetadataEnterpriseStandard, version };
  const digest = createHash("sha256").update(JSON.stringify(bundle)).digest("hex");
  const token = randomBytes(32).toString("hex");
  const query = `Fictional OpenMetadata context ${workspaceId}`;
  const cacheHashes: string[] = [];
  let documentId: number | undefined;
  const call = (name: string, args: unknown) => fetch("http://localhost:80/api/enterprise/mcp", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const readResult = async (response: Response) => (await response.json()) as {
    result: { structuredContent: {
      template: { kind: string; integrationProfile: { connectionState: string; referenceDocuments: unknown[]; state: string } };
      knowledge: { answer: string }; permittedTools: string[]; valid: boolean;
    } };
  };
  try {
    const [document] = await db.insert(knowledgeDocumentsTable).values({
      title: query, content: "Illustrative only. No enterprise instance or live metadata is connected.", enterpriseRestricted: true,
      source: "OpenMetadata integration test fixture", tags: ["fixture"],
    }).returning();
    documentId = document!.id;
    await db.insert(enterpriseStandardsTable).values({ version, digest, bundle });
    await db.insert(enterpriseGrantsTable).values({
      workspaceId, userId, standardsVersion: version, templateId: "openmetadata-agent",
      permittedTools: ["foundry.generation.context", "foundry.generation.validate", "foundry.knowledge.query"],
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
    await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId, documentId });
    // Seed a scoped fictional answer so this boundary test does not call an LLM or enterprise network.
    const hash = createHash("sha256").update(JSON.stringify([
      "enterprise-v1", workspaceId, userId, digest, [documentId], query.toLowerCase(),
    ])).digest("hex");
    cacheHashes.push(hash);
    await db.insert(knowledgeQueryCacheTable).values({
      queryHash: hash, normalizedQuery: query.toLowerCase(), answer: "No enterprise instance is connected. [1]",
      sources: [{ id: documentId, title: query, excerpt: "Illustrative only", score: 1 }],
      expiresAt: new Date(Date.now() + 600000),
    });
    for (const kind of ["agent", "server", "app"]) {
      const templateId = `openmetadata-${kind}`;
      await db.update(enterpriseGrantsTable).set({ templateId }).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
      const response = await call("foundry.generation.context", { standardsVersion: version, templateId, query });
      assert.equal(response.status, 200);
      const { result } = await readResult(response);
      const context = result.structuredContent;
      assert.equal(context.template.kind, kind);
      assert.equal(context.template.integrationProfile.connectionState, "not-connected");
      assert.equal(context.template.integrationProfile.referenceDocuments.length, 4);
      assert.equal(context.template.integrationProfile.state, "reference-only");
      assert.equal(context.knowledge.answer, "No enterprise instance is connected. [1]");
      assert.deepEqual(context.permittedTools, ["foundry.knowledge.query"]);
      const mismatch = await call("foundry.generation.context", { standardsVersion: version, templateId: "grounded-agent", query });
      assert.equal(mismatch.status, 403);
      const validation = await call("foundry.generation.validate", {
        standardsDigest: digest, templateId,
        candidate: {
          input: { query, openmetadataContext: { contractVersion: "1.0.0", connectionState: "not-connected", instance: null, assets: [] } },
          output: { answer: "No instance connected.", citations: [documentId] }, citations: [documentId],
          tools: ["foundry.knowledge.query"], files: { "REFERENCE.md": "Illustrative only" },
        },
      });
      assert.equal(validation.status, 200);
      assert.equal((await readResult(validation)).result.structuredContent.valid, true);
    }
    const runtimes = await (await fetch("http://localhost:80/api/runtimes")).json() as Array<{ status: string }>;
    assert.ok(runtimes.every((runtime: { status: string }) => runtime.status === "not-connected"));
    await db.update(enterpriseGrantsTable).set({ enabled: false }).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
    assert.equal((await call("foundry.generation.context", { standardsVersion: version, templateId: "openmetadata-app", query })).status, 401);
  } finally {
    await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
    await db.delete(enterpriseGrantsTable).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
    if (cacheHashes.length) await db.delete(knowledgeQueryCacheTable).where(inArray(knowledgeQueryCacheTable.queryHash, cacheHashes));
    await db.delete(knowledgeQueryHistoryTable).where(eq(knowledgeQueryHistoryTable.query, query));
    if (documentId) await db.delete(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.id, documentId));
    await db.delete(enterpriseStandardsTable).where(eq(enterpriseStandardsTable.version, version));
    await pool.end();
  }
});
