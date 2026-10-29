import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import express from "express";
import { eq, sql } from "drizzle-orm";
import { db, pool, knowledgeDocumentsTable, enterpriseStandardsTable, enterpriseGrantsTable, enterpriseDocumentGrantsTable } from "@workspace/db";
import { ListMcpDiscoveryEvidenceResponse, RefreshMcpDiscoveryEvidenceResponse } from "@workspace/api-zod";
import { openMetadataEnterpriseStandard } from "@workspace/agent-runtime/enterprise-standards";
import { createMcpDiscoveryRouter } from "../routes/mcp-discovery";
import { DiscoveryFailure } from "./mcp-discovery-client";
import { createDiscoveryCoordinator, type DiscoveryCoordinator, type DiscoveryLease } from "./mcp-discovery-coordination";
import {
  BeginMcpDiscoveryOAuthResponse, CompleteMcpDiscoveryOAuthResponse,
  RefreshMcpDiscoveryOAuthResponse, RevokeMcpDiscoveryOAuthResponse,
} from "@workspace/api-zod";
import { DiscoveryOAuth } from "./mcp-discovery-oauth";
import { rehearseDiscoveryInfrastructure } from "./fixtures/discovery-rehearsal";

after(() => pool.end());
test("opt-in: discovery survives process crashes and a disposable database restart", {
  skip: !process.env.MCP_DISCOVERY_INFRA_REHEARSAL,
  timeout: 150_000,
}, rehearseDiscoveryInfrastructure);

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

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
  let secondServer: Server | undefined;
  let discoveries = 0;
  let mode: "success" | "revoke" | "denied" | "failed" = "success";
  let oauth: DiscoveryOAuth | undefined;
  let expectedOAuthAccess = "fictional-access";
  let beforeReturn: (() => Promise<void>) | undefined;
  const inventory = { serverInfo: { name: "fixture", version: "fixture-1" }, protocolVersion: "2025-03-26", tools: [], resources: [], prompts: [] };
  const rateKey = createHash("sha256").update(JSON.stringify({ workspaceId, userId })).digest("hex");
  const rateKeys = [rateKey, ...["authorize", "callback", "refresh", "revoke"].map(oauthAction =>
    createHash("sha256").update(JSON.stringify({ workspaceId, userId, oauthAction })).digest("hex"))];
  const apiCoordinationId = `api-test-${fixtureId}`;
  // Isolate test admission budgets from real API traffic and previous test runs.
  // Authorization still uses the real trigger-backed, installation-wide epoch.
  function harnessCoordinator(): DiscoveryCoordinator {
    const admission = createDiscoveryCoordinator(apiCoordinationId);
    const authority = createDiscoveryCoordinator();
    const held = new Map<string, DiscoveryLease>();
    return {
      revision: () => authority.revision(),
      async acquire(user, rateScope) {
        const revision = await authority.revision();
        const lease = await admission.acquire(user, rateScope);
        if (!lease) return null;
        held.set(lease.id, lease);
        return { id: lease.id, revision };
      },
      async finish(lease) {
        const original = held.get(lease.id);
        if (!original) return false;
        held.delete(lease.id);
        const live = await admission.finish(original);
        return live && lease.revision === await authority.revision();
      },
    };
  }
  // DB time, not Date.now mocks, governs admission. Expire only this fixture's cooldown.
  const clearRate = () => db.execute(sql`
    UPDATE mcp_discovery_coordination SET state = jsonb_set(state, '{attempts}',
      COALESCE((SELECT jsonb_agg(a) FROM jsonb_array_elements(state->'attempts') a
        WHERE NOT (${JSON.stringify(rateKeys)}::jsonb ? (a->>'user'))), '[]'::jsonb))
    WHERE id = ${apiCoordinationId}
  `);
  try {
    await db.execute(sql`INSERT INTO mcp_discovery_coordination (id) VALUES (${apiCoordinationId})`);
    await t.test("two independent coordinators atomically share slots, rate caps and expiring crash leases", async () => {
      const coordinationId = `test-${fixtureId}`;
      await db.execute(sql`INSERT INTO mcp_discovery_coordination (id) VALUES (${coordinationId})`);
      const one = createDiscoveryCoordinator(coordinationId);
      const two = createDiscoveryCoordinator(coordinationId);
      const expire = async (field: "leases" | "attempts" | "globalAttempts") => {
        // Simulate elapsed DB time without waiting 30/60 seconds or using worker clocks.
        const expired = field === "globalAttempts"
          ? sql`COALESCE((SELECT jsonb_agg(0) FROM jsonb_array_elements(state->${field})), '[]'::jsonb)`
          : sql`COALESCE((SELECT jsonb_agg(jsonb_set(a, '{until}', '0'::jsonb))
              FROM jsonb_array_elements(state->${field}) a), '[]'::jsonb)`;
        await db.execute(sql`UPDATE mcp_discovery_coordination SET state = jsonb_set(state, ${`{${field}}`}::text[],
          ${expired}) WHERE id = ${coordinationId}`);
      };
      try {
        const sameUser = await Promise.all([one.acquire("same-user"), two.acquire("same-user")]);
        assert.equal(sameUser.filter(Boolean).length, 1);
        await one.finish(sameUser.find(Boolean)!);
        assert.equal(await two.acquire("same-user"), null, "release must not erase the cooldown");
        const phaseLease = await one.acquire("same-user", "oauth-callback");
        assert.ok(phaseLease, "a distinct lifecycle phase has its own cooldown");
        assert.equal(await two.acquire("same-user", "oauth-refresh"), null,
          "lifecycle phases still share the same-user concurrency fence across replicas");
        await one.finish(phaseLease);
        assert.equal(await two.acquire("same-user", "oauth-callback"), null,
          "phase cooldowns remain shared after release");
        await expire("attempts");
        await expire("globalAttempts");
        const admissions = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? one : two).acquire(`user-${i}`)));
        const admitted = admissions.filter(l => l !== null);
        assert.equal(admitted.length, 4, "global concurrency must not multiply with replicas");
        assert.equal(await two.acquire("blocked-user"), null);
        // Crashed workers never release. Make their lease deadlines past, retaining their IDs.
        await db.execute(sql`UPDATE mcp_discovery_coordination SET state = jsonb_set(state, '{leases}',
          (SELECT jsonb_agg(jsonb_set(l, '{until}', '0'::jsonb)) FROM jsonb_array_elements(state->'leases') l))
          WHERE id = ${coordinationId}`);
        const recovered = await two.acquire("recovered-user");
        assert.ok(recovered);
        assert.equal(await one.finish(admitted[0]!), false, "late completion is fenced");
        assert.equal(await one.acquire("recovered-user"), null, "late release cannot remove a successor");
        await two.finish(recovered);
        await expire("leases");
        await expire("attempts");
        await expire("globalAttempts");
        for (let i = 0; i < 59; i++) {
          const lease = await (i % 2 ? one : two).acquire(`rate-${i}`);
          assert.ok(lease);
          assert.equal(await one.finish(lease), true);
        }
        const rateRace = await Promise.all([one.acquire("boundary-one"), two.acquire("boundary-two")]);
        assert.equal(rateRace.filter(Boolean).length, 1, "only one replica can admit the last global-rate slot");
        await two.finish(rateRace.find(Boolean)!);
        assert.equal(await two.acquire("global-rate-blocked"), null, "global rate is shared even with free slots");
        await expire("globalAttempts");
        const afterWindow = await two.acquire("global-rate-blocked");
        assert.ok(afterWindow);
        await two.finish(afterWindow);
        await db.execute(sql`DELETE FROM mcp_discovery_coordination WHERE id = ${coordinationId}`);
        await assert.rejects(one.revision(), /unavailable/);
        await assert.rejects(two.acquire("no-fallback"), /unavailable/);
        await assert.rejects(one.finish(afterWindow), /unavailable/);
      } finally {
        await db.execute(sql`DELETE FROM mcp_discovery_coordination WHERE id = ${coordinationId}`);
      }
    });
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
      app.use(createMcpDiscoveryRouter(async (approved, _signal, credential) => {
        discoveries++;
        if (approved.oauth) assert.equal(credential, expectedOAuthAccess);
        if (mode === "revoke") await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
        if (mode === "denied") throw new DiscoveryFailure("remote-denied");
        if (mode === "failed") throw new Error("Untrusted upstream failure must not be returned");
        await beforeReturn?.();
        return inventory;
      }, harnessCoordinator(), oauth));
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
    const secondApp = express();
    secondApp.use(express.json());
    secondApp.use(createMcpDiscoveryRouter(async () => { discoveries++; return inventory; }, harnessCoordinator()));
    secondServer = createServer(secondApp);
    await new Promise<void>(resolve => secondServer!.listen(0, "127.0.0.1", resolve));
    const secondUrl = `http://127.0.0.1:${(secondServer.address() as { port: number }).port}/enterprise/mcp-discovery`;
    const secondCall = (method = "GET") => fetch(secondUrl + (method === "POST" ? "/fixture" : ""), {
      method, headers: { Authorization: `Bearer ${token}`, Connection: "close" },
    });
    assert.equal((await secondCall("POST")).status, 429, "another replica shares the cooldown");
    assert.equal(discoveries, 1);
    assert.equal((await results())[0]!.status, "verified");
    assert.equal((await call("/fixture", "POST")).status, 429);
    assert.equal(discoveries, 1);
    await t.test("another API instance cannot start while the user's first request holds a lease", async () => {
      const started = deferred();
      const held = deferred();
      beforeReturn = async () => { started.resolve(); await held.promise; };
      await clearRate();
      const pending = call("/fixture", "POST");
      try {
        await started.promise;
        await clearRate(); // Prove concurrency fencing independently of the cooldown.
        assert.equal((await secondCall("POST")).status, 429);
      } finally {
        held.resolve();
        beforeReturn = undefined;
        assert.equal((await pending).status, 200);
      }
    });
    const realNow = Date.now();
    t.mock.method(Date, "now", () => realNow + 6 * 60000);
    assert.equal((await results())[0]!.status, "stale");
    assert.equal((await results())[0]!.inventory, null);
    t.mock.restoreAll();
    mode = "failed";
    await clearRate();
    t.mock.method(Date, "now", () => realNow + 61000);
    const failedRefresh = RefreshMcpDiscoveryEvidenceResponse.parse(await (await call("/fixture", "POST")).json());
    assert.equal(failedRefresh.status, "unknown");
    assert.equal(failedRefresh.inventory, null, "failed refresh must not serve the previous verified inventory");
    t.mock.restoreAll();
    mode = "success";
    await t.test("an oversized inventory fails explicitly without retaining its payload", async () => {
      await clearRate();
      const name = inventory.serverInfo.name;
      beforeReturn = async () => { inventory.serverInfo.name = "x".repeat(1024 * 1024); };
      try {
        const result = RefreshMcpDiscoveryEvidenceResponse.parse(await (await call("/fixture", "POST")).json());
        assert.equal(result.status, "unknown");
        assert.equal(result.reason, "incomplete-discovery");
        assert.equal(result.inventory, null);
        assert.equal((await results())[0]!.inventory, null);
      } finally {
        inventory.serverInfo.name = name;
        beforeReturn = undefined;
      }
    });
    await t.test("revocation and restoration cannot resurrect evidence on either replica", async () => {
      const secondResults = async () => ListMcpDiscoveryEvidenceResponse.parse(await (await secondCall()).json()).results;
      await clearRate();
      assert.equal((await secondCall("POST")).status, 200);
      assert.equal((await secondResults())[0]!.status, "verified");
      // No reads occur during revocation, so invalidating only on a denied read is insufficient.
      await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
      await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId, documentId: documentId! });
      assert.equal((await secondResults())[0]!.status, "unknown");
      assert.equal((await secondResults())[0]!.inventory, null);
      assert.equal((await results())[0]!.inventory, null);
      await clearRate();
      await secondCall("POST");
      await db.update(enterpriseGrantsTable).set({ enabled: false }).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
      await db.update(enterpriseGrantsTable).set({ enabled: true }).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
      assert.equal((await secondResults())[0]!.status, "unknown");
      await clearRate();
      await secondCall("POST");
      await writeFile(policyPath, JSON.stringify({ version: "1", approvals: [] }));
      await savePolicy();
      assert.equal((await secondResults())[0]!.status, "unknown", "restoring identical policy JSON cannot revive evidence");
    });
    await t.test("late worker results and mid-request revoke/restore are discarded", async () => {
      await clearRate();
      beforeReturn = async () => {
        await db.execute(sql`UPDATE mcp_discovery_coordination SET state = jsonb_set(state, '{leases}',
          (SELECT jsonb_agg(CASE WHEN l->>'user' = ${rateKey} THEN jsonb_set(l, '{until}', '0'::jsonb) ELSE l END)
            FROM jsonb_array_elements(state->'leases') l)) WHERE id = ${apiCoordinationId}`);
      };
      assert.equal((await call("/fixture", "POST")).status, 403);
      assert.equal((await results())[0]!.inventory, null);
      await clearRate();
      beforeReturn = async () => {
        await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
        await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId, documentId: documentId! });
      };
      try {
        assert.equal((await call("/fixture", "POST")).status, 403);
        assert.equal((await results())[0]!.inventory, null);
      } finally {
        beforeReturn = undefined;
      }
    });
    await db.update(knowledgeDocumentsTable).set({ content: "Changed deployment evidence." }).where(eq(knowledgeDocumentsTable.id, documentId));
    assert.equal((await results())[0]!.status, "unknown");
    await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
    assert.equal((await results())[0]!.status, "denied");
    assert.equal((await results())[0]!.inventory, null);
    assert.equal((await call("/fixture", "POST")).status, 403);
    await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId, documentId });
    assert.equal((await results())[0]!.status, "unknown", "restored permissions cannot revive old evidence");
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
      assert.equal((await call("/fixture", "POST")).status, 429, "restarting a worker cannot reset limits");
      await clearRate();
      const result = RefreshMcpDiscoveryEvidenceResponse.parse(await (await call("/fixture", "POST")).json());
      assert.equal(result.status, mode === "denied" ? "denied" : "unknown");
      assert.equal(result.inventory, null);
      assert.equal(JSON.stringify(result).includes("Untrusted upstream"), false);
    }
    // Keep OAuth lifecycle integration checks alongside the shared coordination checks:
    // authorization mutations deliberately invalidate every scope, even on idle replicas.
    mode = "success";
    let providerCalls = 0;
    let refreshDenied = false;
    let revokeDuringExchange = false;
    oauth = new DiscoveryOAuth(async (_endpoint, form) => {
      providerCalls++;
      if (revokeDuringExchange) {
        await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
      }
      if (form.get("grant_type") === "refresh_token" && refreshDenied) throw new Error("invalid_grant");
      return { status: 200, body: {
        access_token: expectedOAuthAccess, token_type: "Bearer", refresh_token: "fictional-refresh", expires_in: 300,
      } };
    });
    const oauthApproval = {
      ...approval, credentialSecretRef: undefined,
      oauth: {
        authorizationEndpoint: "https://auth.example.com/authorize", tokenEndpoint: "https://auth.example.com/token",
        revocationEndpoint: "https://auth.example.com/revoke", redirectUri: "https://app.example.com/oauth-return",
        clientId: "fictional-client", scopes: ["metadata:read"],
      },
    };
    const saveOAuthPolicy = (patch = {}) => writeFile(policyPath, JSON.stringify({
      version: "1", approvals: [{ ...oauthApproval, ...patch }],
    }));
    const resetOAuthHarness = async () => { await startHarness(); await clearRate(); };
    // Provision the alternate identity before state is issued: grant writes advance the epoch.
    const otherToken = randomBytes(32).toString("hex");
    await db.insert(enterpriseGrantsTable).values({
      workspaceId, userId: "other-user", standardsVersion: version, templateId: "openmetadata-agent",
      permittedTools: [], tokenHash: createHash("sha256").update(otherToken).digest("hex"),
    });
    await saveOAuthPolicy();
    await resetOAuthHarness();
    const begin = async () => {
      const response = await call("/fixture/oauth/authorize", "POST", {});
      assert.equal(response.status, 200);
      const payload = BeginMcpDiscoveryOAuthResponse.parse(await response.json());
      const url = new URL(payload.authorizationUrl);
      return { state: url.searchParams.get("state"), code: "fictional-code", redirectUri: oauthApproval.oauth.redirectUri };
    };
    assert.equal((await results())[0]!.status, "denied");
    assert.equal((await call("/fixture", "POST")).status, 403);
    assert.equal((await call("/fixture/oauth/authorize", "POST", { userId: "someone-else" })).status, 400);
    const callback = await begin();
    assert.equal(providerCalls, 0, "begin and GET must not exchange tokens or discover");
    assert.equal((await call("/fixture/oauth/callback", "POST", { ...callback, redirectUri: "https://other.example.com/callback" })).status, 403);
    assert.equal(providerCalls, 0, "redirect substitution must fail before exchange");
    await resetOAuthHarness();
    const originalCallback = await begin();
    assert.equal((await call("/fixture/oauth/callback", "POST", originalCallback, otherToken)).status, 403);
    assert.equal(providerCalls, 0, "another valid enterprise identity must not consume the state");
    const credentialResponse = await call("/fixture/oauth/callback", "POST", originalCallback);
    assert.equal(credentialResponse.status, 200);
    assert.equal(credentialResponse.headers.get("cache-control"), "no-store");
    const credential = CompleteMcpDiscoveryOAuthResponse.parse(await credentialResponse.json());
    assert.equal(JSON.stringify(credential).includes(expectedOAuthAccess), false);
    assert.equal((await call("/fixture", "POST")).status, 200);
    assert.equal((await results())[0]!.status, "verified");
    assert.equal((await call("/fixture/oauth/refresh", "POST", credential, otherToken)).status, 403);
    expectedOAuthAccess = "fictional-refreshed-access";
    const refreshedResponse = await call("/fixture/oauth/refresh", "POST", { credentialReference: credential.credentialReference });
    assert.equal(refreshedResponse.status, 200);
    const refreshed = RefreshMcpDiscoveryOAuthResponse.parse(await refreshedResponse.json());
    assert.notEqual(refreshed.credentialReference, credential.credentialReference);
    assert.equal((await results())[0]!.status, "unknown", "refresh invalidates previous inventory");
    const revoked = await call("/fixture/oauth/revoke", "POST", { credentialReference: refreshed.credentialReference });
    assert.equal(revoked.status, 200);
    assert.equal(RevokeMcpDiscoveryOAuthResponse.parse(await revoked.json()).revoked, true);
    assert.equal((await results())[0]!.inventory, null);
    assert.equal((await call("/fixture", "POST")).status, 403);
    await resetOAuthHarness();
    assert.equal((await call("/fixture/oauth/refresh", "POST", { credentialReference: refreshed.credentialReference })).status, 403);
    await resetOAuthHarness();
    const changedRedirect = await begin();
    await saveOAuthPolicy({ oauth: { ...oauthApproval.oauth, redirectUri: "https://other.example.com/return" } });
    const beforeChange = providerCalls;
    assert.equal((await call("/fixture/oauth/callback", "POST", changedRedirect)).status, 403);
    assert.equal(providerCalls, beforeChange, "operator redirect changes invalidate outstanding authorization");
    await saveOAuthPolicy();
    await resetOAuthHarness();
    const nextCallback = await begin();
    const nextResponse = await call("/fixture/oauth/callback", "POST", nextCallback);
    assert.equal(nextResponse.status, 200);
    const nextCredential = CompleteMcpDiscoveryOAuthResponse.parse(await nextResponse.json());
    refreshDenied = true;
    assert.equal((await call("/fixture/oauth/refresh", "POST", { credentialReference: nextCredential.credentialReference })).status, 403);
    assert.equal((await results())[0]!.inventory, null);
    assert.equal((await call("/fixture", "POST")).status, 403);
    await resetOAuthHarness();
    const deniedCallback = await begin();
    assert.equal((await call("/fixture/oauth/callback", "POST", deniedCallback)).status, 200);
    mode = "denied";
    assert.equal((await call("/fixture", "POST")).status, 403);
    assert.equal((await results())[0]!.status, "denied");
    mode = "success";
    await resetOAuthHarness();
    const revokedPermissionCallback = await begin();
    revokeDuringExchange = true;
    assert.equal((await call("/fixture/oauth/callback", "POST", revokedPermissionCallback)).status, 403,
      "permissions revoked during token exchange must discard the resulting credential");
    revokeDuringExchange = false;
    await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId, documentId });
    assert.equal((await call("/fixture", "POST")).status, 403, "restored permissions must not recover a discarded credential");
    await resetOAuthHarness();
    const idleCallback = await begin();
    assert.equal((await call("/fixture/oauth/callback", "POST", idleCallback)).status, 200);
    await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
    await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId, documentId });
    assert.equal((await results())[0]!.status, "denied",
      "revoke/restore while idle must invalidate OAuth credentials, not only discovery evidence");
    assert.equal((await call("/fixture", "POST")).status, 403);
    oauth = undefined;
    await savePolicy();
    mode = "revoke";
    await startHarness();
    await clearRate();
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
    await db.update(enterpriseGrantsTable).set({ enabled: true }).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
    await t.test("unavailable coordinator fails closed on reads and refresh without network fallback", async () => {
      const unavailable = () => Promise.reject(new Error("private database failure"));
      const app = express();
      app.use(createMcpDiscoveryRouter(async () => { discoveries++; return inventory; }, {
        revision: unavailable, acquire: unavailable, finish: unavailable,
      }));
      const failedServer = createServer(app);
      await new Promise<void>(resolve => failedServer.listen(0, "127.0.0.1", resolve));
      const count = discoveries;
      try {
        for (const method of ["GET", "POST"]) {
          const response = await fetch(`http://127.0.0.1:${(failedServer.address() as { port: number }).port}/enterprise/mcp-discovery${method === "POST" ? "/fixture" : ""}`, {
            method, headers: { Authorization: `Bearer ${token}`, Connection: "close" },
          });
          assert.equal(response.status, 503);
          assert.equal(response.headers.get("cache-control"), "no-store");
          assert.equal((await response.text()).includes("private database"), false);
        }
        assert.equal(discoveries, count);
      } finally {
        await new Promise<void>(resolve => failedServer.close(() => resolve()));
      }
    });
  } finally {
    t.mock.restoreAll();
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
    if (secondServer) await new Promise<void>(resolve => secondServer!.close(() => resolve()));
    if (oldPolicy === undefined) delete process.env.MCP_DISCOVERY_POLICY_FILE;
    else process.env.MCP_DISCOVERY_POLICY_FILE = oldPolicy;
    await db.delete(enterpriseDocumentGrantsTable).where(eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId));
    await db.delete(enterpriseGrantsTable).where(eq(enterpriseGrantsTable.workspaceId, workspaceId));
    await db.delete(enterpriseStandardsTable).where(eq(enterpriseStandardsTable.version, version));
    if (documentId) await db.delete(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.id, documentId));
    await rm(folder, { recursive: true, force: true });
    await db.execute(sql`DELETE FROM mcp_discovery_coordination WHERE id = ${apiCoordinationId}`);
  }
});
