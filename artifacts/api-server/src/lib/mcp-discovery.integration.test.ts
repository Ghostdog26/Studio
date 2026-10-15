import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import express from "express";
import { eq } from "drizzle-orm";
import { db, pool, knowledgeDocumentsTable, enterpriseStandardsTable, enterpriseGrantsTable, enterpriseDocumentGrantsTable } from "@workspace/db";
import { ListMcpDiscoveryEvidenceResponse, RefreshMcpDiscoveryEvidenceResponse } from "@workspace/api-zod";
import { openMetadataEnterpriseStandard } from "@workspace/agent-runtime/enterprise-standards";
import { createMcpDiscoveryRouter } from "../routes/mcp-discovery";
import { DiscoveryFailure } from "./mcp-discovery-client";

test("discovery API isolates users, expires evidence, rejects arbitrary RPC and discards revoked results", async (t) => {
  const fixtureId = randomBytes(6).toString("hex");
  const workspaceId = `discovery-fixture-${fixtureId}`;
  const userId = "fictional-user";
  const token = randomBytes(32).toString("hex");
  const version = `997.0.${Date.now()}`;
  const folder = await mkdtemp(join(tmpdir(), "mcp-discovery-"));
  const policyPath = join(folder, "policy.json");
  const oldPolicy = process.env.MCP_DISCOVERY_POLICY_FILE;
  let documentId: number | undefined;
  let server: Server | undefined;
  let discoveries = 0;
  let mode: "success" | "revoke" | "denied" | "failed" = "success";
  const inventory = { serverInfo: { name: "fixture", version: "fixture-1" }, protocolVersion: "2025-03-26", tools: [], resources: [], prompts: [] };
  try {
    const [document] = await db.insert(knowledgeDocumentsTable).values({
      title: "Fictional discovery evidence", content: "Fixture only; not a real enterprise instance.",
      source: `discovery-test-${fixtureId}`, enterpriseRestricted: true, tags: ["fixture"],
    }).returning();
    documentId = document!.id;
    await db.insert(enterpriseStandardsTable).values({
      version, digest: fixtureId, bundle: { ...openMetadataEnterpriseStandard, version },
    });
    await db.insert(enterpriseGrantsTable).values({
      workspaceId, userId, standardsVersion: version, templateId: "openmetadata-agent",
      permittedTools: [], tokenHash: createHash("sha256").update(token).digest("hex"),
    });
    await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId, documentId });
    let approval = {
      id: "fixture", layer: "openmetadata-interface", instanceId: "fictional-instance",
      catalogueRecordId: null, endpoint: "https://mcp.example.com/mcp",
      deployedVersion: "fixture-1", protocolVersion: "2025-03-26", transport: "streamable-http",
      evidenceDocumentIds: [documentId], evidenceRevision: "fixture-evidence",
      credentialSecretRef: "secret://MCP_DISCOVERY_NONEXISTENT_TEST", approvedBy: "fictional-operator",
      approvedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
      workspaceId, userId,
    };
    const savePolicy = () => writeFile(policyPath, JSON.stringify({ version: "1", approvals: [approval] }));
    await savePolicy();
    process.env.MCP_DISCOVERY_POLICY_FILE = policyPath;
    let baseUrl = "";
    const startHarness = async () => {
      if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
      const app = express();
      app.use(express.json());
      app.use(createMcpDiscoveryRouter(async () => {
        discoveries++;
        if (mode === "revoke") await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
        if (mode === "denied") throw new DiscoveryFailure("remote-denied");
        if (mode === "failed") throw new Error("Untrusted upstream failure must not be returned");
        return inventory;
      }));
      // Private test harness only; no application workflow or enterprise network.
      server = createServer(app);
      await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
      baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/enterprise/mcp-discovery`;
    };
    await startHarness();
    const call = (path = "", method = "GET", body?: unknown, auth = token) => fetch(baseUrl + path, {
      method, headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json", Connection: "close" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const results = async () => ListMcpDiscoveryEvidenceResponse.parse(await (await call()).json()).results;
    assert.equal((await call("", "GET", undefined, "bad-token")).status, 401);
    assert.equal((await results())[0]!.status, "unknown");
    assert.equal(discoveries, 0);
    assert.equal((await call("/unapproved", "POST")).status, 403);
    assert.equal((await call("/fixture", "POST", { method: "tools/call" })).status, 400);
    assert.equal((await call("/fixture?endpoint=x", "POST")).status, 400);
    const discovered = await call("/fixture", "POST");
    assert.equal(discovered.status, 200);
    assert.equal(discovered.headers.get("cache-control"), "no-store");
    const verified = RefreshMcpDiscoveryEvidenceResponse.parse(await discovered.json());
    assert.equal(verified.status, "verified");
    assert.equal(verified.approvedForInvocation, false);
    assert.ok(verified.expiresAt.getTime() <= Date.now() + 300000);
    assert.equal(discoveries, 1);
    assert.equal((await results())[0]!.status, "verified");
    assert.equal((await call("/fixture", "POST")).status, 429);
    assert.equal(discoveries, 1);
    const realNow = Date.now();
    t.mock.method(Date, "now", () => realNow + 6 * 60000);
    assert.equal((await results())[0]!.status, "stale");
    assert.equal((await results())[0]!.inventory, null);
    t.mock.restoreAll();
    mode = "failed";
    t.mock.method(Date, "now", () => realNow + 61000);
    const failedRefresh = RefreshMcpDiscoveryEvidenceResponse.parse(await (await call("/fixture", "POST")).json());
    assert.equal(failedRefresh.status, "unknown");
    assert.equal(failedRefresh.inventory, null, "failed refresh must not serve the previous verified inventory");
    t.mock.restoreAll();
    mode = "success";
    await db.update(knowledgeDocumentsTable).set({ content: "Changed deployment evidence." }).where(eq(knowledgeDocumentsTable.id, documentId));
    assert.equal((await results())[0]!.status, "unknown");
    await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
    assert.equal((await results())[0]!.status, "denied");
    assert.equal((await results())[0]!.inventory, null);
    assert.equal((await call("/fixture", "POST")).status, 403);
    await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId, documentId });
    approval = { ...approval, expiresAt: new Date(Date.now() - 1).toISOString() };
    await savePolicy();
    assert.equal((await results())[0]!.status, "stale");
    assert.equal((await results())[0]!.inventory, null);
    approval = { ...approval, userId: "other-user" };
    await savePolicy();
    assert.deepEqual(await results(), []);
    assert.equal((await call("/fixture", "POST")).status, 403);
    approval = { ...approval, userId, expiresAt: new Date(Date.now() + 3600000).toISOString() };
    await savePolicy();
    for (const failureMode of ["denied", "failed"] as const) {
      mode = failureMode;
      await startHarness();
      const result = RefreshMcpDiscoveryEvidenceResponse.parse(await (await call("/fixture", "POST")).json());
      assert.equal(result.status, mode === "denied" ? "denied" : "unknown");
      assert.equal(result.inventory, null);
      assert.equal(JSON.stringify(result).includes("Untrusted upstream"), false);
    }
    mode = "revoke";
    await startHarness();
    assert.equal((await call("/fixture", "POST")).status, 403);
    assert.equal((await results())[0]!.inventory, null);
    await writeFile(policyPath, "{broken");
    assert.equal((await call()).status, 503);
    await savePolicy();
    delete process.env.MCP_DISCOVERY_POLICY_FILE;
    assert.deepEqual(await results(), []);
    assert.equal((await call("/fixture", "POST")).status, 403);
    process.env.MCP_DISCOVERY_POLICY_FILE = policyPath;
    await db.update(enterpriseGrantsTable).set({ enabled: false }).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
    assert.equal((await call()).status, 401);
  } finally {
    t.mock.restoreAll();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    if (oldPolicy === undefined) delete process.env.MCP_DISCOVERY_POLICY_FILE;
    else process.env.MCP_DISCOVERY_POLICY_FILE = oldPolicy;
    await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
    await db.delete(enterpriseGrantsTable).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
    await db.delete(enterpriseStandardsTable).where(eq(enterpriseStandardsTable.version, version));
    if (documentId) await db.delete(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.id, documentId));
    await rm(folder, { recursive: true, force: true });
    await pool.end();
  }
});
