import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, createHmac } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db, pool, enterpriseStandardsTable, enterpriseGrantsTable, enterpriseDocumentGrantsTable,
  knowledgeDocumentsTable, knowledgeQueryCacheTable, knowledgeQueryHistoryTable,
} from "@workspace/db";
import { initialEnterpriseStandard } from "@workspace/agent-runtime/enterprise-standards";

async function rpcJson(response: Response) {
  return await response.json() as { result: { tools: unknown[]; structuredContent: {
    standardsDigest: string; template: { kind: string }; inputSchema: { type: string };
    knowledge: { cached: boolean; sources: Array<{ id: number }> };
    cached: boolean; valid: boolean; answer: string;
  } } };
}

test("live enterprise boundary isolates workspace, user, standards, documents and cached answers", { timeout: 120_000 }, async () => {
  const tag = randomBytes(8).toString("hex");
  const workspaceId = `integration-${tag}`;
  const userId = "test-user";
  const version = `999.0.${Date.now()}`;
  const standard = { ...initialEnterpriseStandard, version };
  const digest = createHash("sha256").update(JSON.stringify(standard)).digest("hex");
  const token = randomBytes(32).toString("hex");
  const query = `Enterprise integration runbook ${tag}`;
  const publicQuery = `Public cache visibility ${tag}`;
  const endpoint = "http://localhost:80/api/enterprise/mcp";
  let documentIds: number[] = [];
  const cacheHashes: string[] = [];
  const rpc = (name: string, args: Record<string, unknown> = {}) => ({
    jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args },
  });
  const call = (body: unknown, credential = token) => fetch(endpoint, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${credential}` },
    body: JSON.stringify(body),
  });
  const cacheKey = (ids: number[]) => createHash("sha256").update(JSON.stringify([
    "enterprise-v1", workspaceId, userId, digest, ids, query.toLowerCase().replace(/\s+/g, " "),
  ])).digest("hex");
  try {
    const docs = await db.insert(knowledgeDocumentsTable).values([
      { title: `Integration runbook ${tag}`, content: `For ${query}, the approved owner is AUTHORIZED_ALPHA.`, tags: [tag] },
      { title: `Integration second runbook ${tag}`, content: "Private beta wiki content MUST_NOT_LEAK.", tags: [tag], enterpriseRestricted: true },
      { title: `Public marker ${tag}`, content: "Shared demo context, not company policy.", tags: [tag] },
    ]).returning();
    documentIds = docs.map(d => d.id);
    await db.insert(enterpriseStandardsTable).values({ version, digest, bundle: standard });
    await db.insert(enterpriseGrantsTable).values({
      workspaceId, userId, standardsVersion: version, templateId: "grounded-agent",
      permittedTools: ["foundry.generation.context", "foundry.generation.validate", "foundry.knowledge.query"],
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
    await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId, documentId: docs[0].id });

    // The shared API cannot bypass either a direct/legacy grant or persistent classification.
    const publicList = await (await fetch("http://localhost:80/api/knowledge")).json() as Array<{ id: number }>;
    assert.ok(!publicList.some(document => document.id === docs[0].id || document.id === docs[1].id));
    assert.ok(publicList.some(document => document.id === docs[2].id));
    for (const id of [docs[0].id, docs[1].id]) {
      assert.equal((await fetch(`http://localhost:80/api/knowledge/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Unauthorized edit" }),
      })).status, 404);
      assert.equal((await fetch(`http://localhost:80/api/knowledge/${id}`, { method: "DELETE" })).status, 404);
    }
    assert.equal((await call(rpc("foundry.knowledge.query", { query }), "0".repeat(64))).status, 401);
    assert.equal((await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rpc("tools/list")) })).status, 401);
    const list = await call({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    assert.equal(list.status, 200);
    assert.equal((await rpcJson(list)).result.tools.length, 3);
    assert.equal((await call(rpc("enterprise.admin"))).status, 403);
    assert.equal((await call(rpc("foundry.generation.context", { standardsVersion: "0.0.0", templateId: "grounded-agent", query }))).status, 403);
    assert.equal((await call(rpc("foundry.knowledge.query", { query, workspaceId: "other" }))).status, 400);

    // A broader legacy cache must not satisfy this scoped query.
    const legacyHash = createHash("sha256").update(query.toLowerCase()).digest("hex");
    cacheHashes.push(legacyHash, cacheKey([docs[0].id]), cacheKey([docs[1].id]));
    await db.insert(knowledgeQueryCacheTable).values({
      queryHash: legacyHash, normalizedQuery: query.toLowerCase(), answer: "LEGACY_MUST_NOT_LEAK",
      sources: [{ id: docs[1].id, title: docs[1].title, excerpt: "PRIVATE", score: 1 }],
      expiresAt: new Date(Date.now() + 600_000),
    });
    const creationResponse = await call(rpc("foundry.generation.context", { standardsVersion: version, templateId: "grounded-agent", query }));
    assert.equal(creationResponse.status, 200);
    const context = (await rpcJson(creationResponse)).result.structuredContent;
    assert.equal(context.standardsDigest, digest);
    assert.equal(context.template.kind, "agent");
    assert.equal(context.inputSchema.type, "object");
    assert.equal(context.knowledge.cached, false);
    assert.ok(context.knowledge.sources.length > 0);
    assert.ok(context.knowledge.sources.every((source: { id: number }) => source.id === docs[0].id));
    assert.ok(!JSON.stringify(context).includes("MUST_NOT_LEAK"));
    const cached = await call(rpc("foundry.knowledge.query", { query }));
    assert.equal((await rpcJson(cached)).result.structuredContent.cached, true);
    const overview = await (await fetch("http://localhost:80/api/overview")).json();
    assert.ok(!JSON.stringify(overview).includes(query), "Scoped query text must not enter public activity.");
    assert.ok(!JSON.stringify(overview).includes(docs[0].title), "Restricted titles must not enter public activity.");

    // Even a legacy cached answer computed before promotion must be rejected by public queries.
    const publicHash = createHash("sha256").update(publicQuery.toLowerCase()).digest("hex");
    cacheHashes.push(publicHash);
    await db.insert(knowledgeQueryCacheTable).values({
      queryHash: publicHash, normalizedQuery: publicQuery.toLowerCase(), answer: "RESTRICTED_CACHED_ANSWER",
      sources: [{ id: docs[0].id, title: docs[0].title, excerpt: "AUTHORIZED_ALPHA", score: 1 }],
      expiresAt: new Date(Date.now() + 600_000),
    });
    const publicAnswerResponse = await fetch("http://localhost:80/api/knowledge/query", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: publicQuery }),
    });
    assert.equal(publicAnswerResponse.status, 200);
    const publicAnswer = await publicAnswerResponse.json() as { answer: string; sources: Array<{ id: number }> };
    assert.ok(!publicAnswer.sources.some(source => source.id === docs[0].id || source.id === docs[1].id));
    assert.ok(!JSON.stringify(publicAnswer).includes("AUTHORIZED_ALPHA"));
    assert.ok(!JSON.stringify(publicAnswer).includes("RESTRICTED_CACHED_ANSWER"));

    const candidate = {
      input: { query }, output: { answer: "Approved", citations: [docs[0].id] },
      tools: ["foundry.knowledge.query"], citations: [docs[0].id], files: { "AGENT.md": "Approved agent" },
    };
    const validated = await call(rpc("foundry.generation.validate", { standardsDigest: digest, templateId: "grounded-agent", candidate }));
    assert.equal((await rpcJson(validated)).result.structuredContent.valid, true);
    assert.equal((await call(rpc("foundry.generation.validate", { standardsDigest: "stale", templateId: "grounded-agent", candidate }))).status, 409);
    const invalid = await call(rpc("foundry.generation.validate", {
      standardsDigest: digest, templateId: "grounded-agent", candidate: { ...candidate, tools: ["enterprise.admin"], citations: [docs[1].id] },
    }));
    assert.equal((await rpcJson(invalid)).result.structuredContent.valid, false);

    // Revoking a document must change the cache key before lookup, not just after retrieval.
    // The operator CLI makes this classification permanent when granting public documents.
    await db.update(knowledgeDocumentsTable).set({ enterpriseRestricted: true }).where(eq(knowledgeDocumentsTable.id, docs[0].id));
    await db.update(enterpriseDocumentGrantsTable).set({ documentId: docs[1].id }).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
    await db.insert(knowledgeQueryCacheTable).values({
      queryHash: cacheKey([docs[1].id]), normalizedQuery: query.toLowerCase(), answer: "AUTHORIZED_BETA",
      sources: [{ id: docs[1].id, title: docs[1].title, excerpt: "Authorized after regrant", score: 1 }],
      expiresAt: new Date(Date.now() + 600_000),
    });
    const regranted = await call(rpc("foundry.knowledge.query", { query }));
    assert.equal((await rpcJson(regranted)).result.structuredContent.answer, "AUTHORIZED_BETA");
    const capabilityUrl = new URL("../../vendor/cloudflare-os/packages/gatekeeper-context/src/foundry.ts", import.meta.url).href;
    const { createFoundryCapability } = await import(capabilityUrl);
    const scopedCapability = createFoundryCapability({
      FOUNDRY_API_URL: endpoint, FOUNDRY_API_TOKEN: token,
    }, workspaceId, userId);
    assert.equal((await scopedCapability.call("foundry.generation.context", {
      standardsVersion: version, templateId: "grounded-agent", query,
    })).standardsDigest, digest);
    await assert.rejects(() => createFoundryCapability({
      FOUNDRY_API_URL: endpoint, FOUNDRY_API_TOKEN: token,
    }, "other-workspace", userId).call("foundry.knowledge.query", { query }));
    await assert.rejects(() => createFoundryCapability({
      FOUNDRY_API_URL: endpoint, FOUNDRY_API_TOKEN: token,
    }, workspaceId, "other-user").call("foundry.knowledge.query", { query }));

    // Signed requests cannot impersonate another workspace or user, even with a valid server assertion.
    if (process.env.SESSION_SECRET) {
      const key = createHmac("sha256", process.env.SESSION_SECRET).update("foundry-cloudflare-knowledge-v1").digest("hex");
      // Exercise the exact server-side capability imported by Workshop, not a parallel client.
      const capability = createFoundryCapability({
        FOUNDRY_API_URL: endpoint, FOUNDRY_BRIDGE_KEY: key,
      }, workspaceId, userId);
      assert.equal((await capability.call("foundry.knowledge.query", { query })).answer, "AUTHORIZED_BETA");
      const creation = await capability.call("foundry.generation.context", {
        standardsVersion: version, templateId: "grounded-agent", query,
      });
      assert.equal(creation.standardsVersion, version);
      assert.equal(creation.standardsDigest, digest);
      for (const identity of [{ workspaceId: "other", userId }, { workspaceId, userId: "other" }]) {
        const body = { ...identity, timestamp: Date.now(), rpc: rpc("foundry.knowledge.query", { query }) };
        const signature = createHmac("sha256", key).update(JSON.stringify(body)).digest("hex");
        assert.equal((await fetch(endpoint, { method: "POST", headers: {
          "content-type": "application/json", "x-foundry-signature": signature,
        }, body: JSON.stringify(body) })).status, 403);
      }
    }
    await db.update(enterpriseGrantsTable).set({ enabled: false }).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
    assert.equal((await call(rpc("foundry.knowledge.query", { query }))).status, 401);
    const afterRevocation = await (await fetch("http://localhost:80/api/knowledge")).json() as Array<{ id: number }>;
    assert.ok(!afterRevocation.some(document => document.id === docs[0].id || document.id === docs[1].id));
  } finally {
    await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
    await db.delete(enterpriseGrantsTable).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
    if (cacheHashes.length) await db.delete(knowledgeQueryCacheTable).where(inArray(knowledgeQueryCacheTable.queryHash, cacheHashes));
    await db.delete(knowledgeQueryHistoryTable).where(inArray(knowledgeQueryHistoryTable.query, [query, publicQuery]));
    if (documentIds.length) await db.delete(knowledgeDocumentsTable).where(inArray(knowledgeDocumentsTable.id, documentIds));
    await db.delete(enterpriseStandardsTable).where(eq(enterpriseStandardsTable.version, version));
    await pool.end();
  }
});
