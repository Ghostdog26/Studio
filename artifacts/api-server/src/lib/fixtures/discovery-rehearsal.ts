import assert from "node:assert/strict";
import { fork, spawnSync, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import { db, pool, knowledgeDocumentsTable, enterpriseStandardsTable, enterpriseGrantsTable,
  enterpriseDocumentGrantsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { openMetadataEnterpriseStandard } from "@workspace/agent-runtime/enterprise-standards";
import { ListMcpDiscoveryEvidenceResponse, RefreshMcpDiscoveryEvidenceResponse } from "@workspace/api-zod";
import type { DiscoveryLease } from "../mcp-discovery-coordination";

type Message = { event?: string; id?: number; port?: number; result?: any; error?: string };
function replica(folder: string, policy: string) {
  const child = fork(join(folder, "worker.mjs"), [], {
    env: { ...process.env, MCP_DISCOVERY_POLICY_FILE: policy },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  let sequence = 0;
  const messages: Message[] = [];
  const waiters = new Set<() => void>();
  child.on("message", (message: Message) => { messages.push(message); for (const wake of waiters) wake(); });
  child.on("exit", () => { for (const wake of waiters) wake(); });
  async function receive(predicate: (message: Message) => boolean): Promise<Message> {
    const deadline = Date.now() + 10_000;
    while (true) {
      const index = messages.findIndex(predicate);
      if (index >= 0) return messages.splice(index, 1)[0]!;
      assert.equal(child.exitCode, null, "replica exited unexpectedly");
      assert.equal(child.signalCode, null, "replica terminated unexpectedly");
      assert.ok(Date.now() < deadline, "timed out waiting for replica IPC");
      await new Promise<void>(resolve => {
        const wake = () => { clearTimeout(timer); waiters.delete(wake); resolve(); };
        const timer = setTimeout(wake, 100);
        waiters.add(wake);
      });
    }
  }
  return {
    child, receive,
    async command(action: string, values: object = {}) {
      const id = ++sequence;
      child.send({ id, action, ...values });
      const reply = await receive(message => message.id === id);
      if (reply.error) throw new Error(reply.error);
      return reply.result;
    },
  };
}

export async function rehearseDiscoveryInfrastructure() {
  const folder = await realpath(process.env.MCP_DISCOVERY_INFRA_REHEARSAL!);
  // Refuse arbitrary paths, database URLs, remote hosts and existing installations.
  assert.equal(dirname(folder), await realpath(tmpdir()));
  assert.ok(basename(folder).startsWith("mcp-infra-rehearsal-"));
  const data = await realpath(join(folder, "pgdata"));
  assert.equal(data, join(folder, "pgdata"));
  const pidFile = (await readFile(join(data, "postmaster.pid"), "utf8")).split("\n");
  assert.equal(pidFile[1], data);
  assert.equal(process.env.DATABASE_URL, `postgresql://rehearsal@127.0.0.1:${pidFile[3]}/postgres`);
  const identity = (await pool.query("SELECT current_setting('data_directory') AS dir, current_user AS usr")).rows[0];
  assert.equal(identity.dir, data);
  assert.equal(identity.usr, "rehearsal");
  pool.on("error", () => {}); // Expected when this private cluster is stopped.
  pool.options.connectionTimeoutMillis = 1500;
  const control = (action: "start" | "stop") => {
    const result = spawnSync("pg_ctl", ["-D", data, "-l", join(folder, "postgres.log"),
      ...(action === "stop" ? ["-m", "immediate"] : ["-o", `-h 127.0.0.1 -p ${pidFile[3]} -k ${folder}`]), "-w", action],
    { stdio: "pipe", timeout: 15_000 });
    assert.equal(result.status, 0, `private PostgreSQL ${action} failed: ${result.stderr?.toString()}`);
  };
  const fixture = randomBytes(6).toString("hex");
  const workspaceId = `infra-fixture-${fixture}`;
  const version = `998.0.${Date.now()}`;
  const policy = join(folder, "policy.json");
  const tokens = Array.from({ length: 4 }, () => randomBytes(32).toString("hex"));
  const users = tokens.map((_, i) => `fixture-user-${i}`);
  const userKey = (i: number) => createHash("sha256").update(JSON.stringify({ workspaceId, userId: users[i] })).digest("hex");
  const children: ChildProcess[] = [];
  let stopped = false;
  try {
    const [document] = await db.insert(knowledgeDocumentsTable).values({
      title: "Disposable rehearsal", content: "Fictional evidence only.", enterpriseRestricted: true,
    }).returning();
    await db.insert(enterpriseStandardsTable).values({
      version, digest: fixture, bundle: { ...openMetadataEnterpriseStandard, version },
    });
    for (let i = 0; i < users.length; i++) {
      await db.insert(enterpriseGrantsTable).values({
        workspaceId, userId: users[i]!, standardsVersion: version, templateId: "openmetadata-agent",
        permittedTools: [], tokenHash: createHash("sha256").update(tokens[i]!).digest("hex"),
      });
      await db.insert(enterpriseDocumentGrantsTable).values({ workspaceId, userId: users[i]!, documentId: document!.id });
    }
    await writeFile(policy, JSON.stringify({ version: "1", approvals: users.map((userId, i) => ({
      id: `fixture-${i}`, layer: "openmetadata-interface", instanceId: "fictional-instance",
      catalogueRecordId: null, endpoint: "https://mcp.example.com/mcp",
      deployedVersion: "fixture-1", protocolVersion: "2025-03-26", transport: "streamable-http",
      evidenceDocumentIds: [document!.id], evidenceRevision: "fixture",
      credentialSecretRef: "secret://MCP_DISCOVERY_NONEXISTENT_REHEARSAL_ONLY", approvedBy: "fixture",
      approvedAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 600_000).toISOString(), workspaceId, userId,
    })) }));
    const replicas = users.slice(0, 3).map(() => {
      const worker = replica(folder, policy); children.push(worker.child); return worker;
    });
    const urls = await Promise.all(replicas.map(async worker => {
      const ready = await worker.receive(message => message.event === "ready");
      return `http://127.0.0.1:${ready.port}/enterprise/mcp-discovery`;
    }));
    const request = (i: number, method = "POST", identity = i) => fetch(urls[i]! + (method === "POST" ? `/fixture-${identity}` : ""), {
      method, headers: { Authorization: `Bearer ${tokens[identity]}`, Connection: "close" },
      signal: AbortSignal.timeout(65_000),
    });
    const [crashed, late, survivor] = replicas;
    // Both requests have entered injected fixture discovery and hold committed DB leases.
    const crashRequest = request(0).then(() => "responded", () => "disconnected");
    await crashed!.receive(message => message.event === "discovery-started");
    const lateRequest = request(1);
    await late!.receive(message => message.event === "discovery-started");
    late!.child.kill("SIGSTOP");
    const fillers = await Promise.all(["held-one", "held-two"].map(user => survivor!.command("acquire", { user })));
    assert.ok(fillers.every(Boolean));
    assert.equal(await survivor!.command("acquire", { user: "overflow" }), null, "four slots across processes, not per replica");
    const exited = once(crashed!.child, "exit");
    crashed!.child.kill("SIGKILL");
    const [, signal] = await exited;
    assert.equal(signal, "SIGKILL");
    assert.equal(await crashRequest, "disconnected");
    assert.equal(await survivor!.command("acquire", { user: "after-crash" }), null, "crash does not free an unexpired lease");

    // Do not mutate lease timestamps or mock clocks. Wait for actual DB time.
    const remaining = (await db.execute(sql`
      SELECT greatest(0, max((l->>'until')::numeric) - extract(epoch FROM clock_timestamp()) * 1000) AS ms
      FROM mcp_discovery_coordination, jsonb_array_elements(state->'leases') l WHERE id = 'discovery'
    `)).rows[0]!.ms;
    await delay(Number(remaining) + 150);
    const successors: DiscoveryLease[] = [];
    for (const user of [userKey(1), "successor-two", "successor-three", "successor-four"]) {
      const lease = await survivor!.command("acquire", { user, scope: `recovery-${user}` });
      assert.ok(lease, "surviving replica reclaims naturally expired slots"); successors.push(lease);
    }
    late!.child.kill("SIGCONT");
    await late!.command("release");
    assert.equal((await lateRequest).status, 403, "expired worker must not publish stale evidence");
    const lateEvidence = ListMcpDiscoveryEvidenceResponse.parse(await (await request(1, "GET")).json());
    assert.equal(lateEvidence.results[0]!.inventory, null);
    assert.equal(await survivor!.command("acquire", { user: "after-late-finish" }), null,
      "late completion cannot release any successor's slot");
    for (const lease of successors) assert.equal(await survivor!.command("finish", { lease }), true);
    for (const lease of fillers) assert.equal(await survivor!.command("finish", { lease }), false);

    const outageRequest = request(2);
    await survivor!.receive(message => message.event === "discovery-started");
    const counts = await Promise.all([late!, survivor!].map(worker => worker.command("calls")));
    control("stop"); stopped = true;
    await survivor!.command("release");
    assert.equal((await outageRequest).status, 503, "completion without DB fencing cannot publish evidence");
    for (const [offset, worker] of [late!, survivor!].entries()) {
      await assert.rejects(worker.command("acquire", { user: "no-local-fallback" }), /unavailable/);
      await assert.rejects(worker.command("revision"), /unavailable/);
      for (const method of ["GET", "POST"]) {
        const response = await request(offset + 1, method);
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal((await response.text()).includes("127.0.0.1"), false);
      }
      assert.equal(await worker.command("calls"), counts[offset], "DB outage must not start fixture network work");
    }
    control("start"); stopped = false;
    // The same live processes/pools must reconnect; restarting API workers would hide failures.
    assert.equal(await late!.command("revision"), await survivor!.command("revision"));
    for (const i of [1, 2]) {
      const response = await request(i, "GET");
      assert.equal(response.status, 200);
      assert.equal(ListMcpDiscoveryEvidenceResponse.parse(await response.json()).results[0]!.inventory, null);
      assert.equal((await request(i)).status, 429, "restart preserves committed per-user cooldowns");
    }
    const recoveredRequest = request(2, "POST", 3);
    await survivor!.receive(message => message.event === "discovery-started");
    await survivor!.command("release");
    const recoveredResponse = await recoveredRequest;
    assert.equal(recoveredResponse.status, 200);
    assert.equal(RefreshMcpDiscoveryEvidenceResponse.parse(await recoveredResponse.json()).status, "verified",
      "a live replica can perform fresh discovery after reconnect");
    // Fill precisely the remaining shared minute budget, without clearing stored attempts.
    const used = Number((await db.execute(sql`
      SELECT jsonb_array_length(state->'globalAttempts') AS used FROM mcp_discovery_coordination WHERE id = 'discovery'
    `)).rows[0]!.used);
    for (let i = used; i < 60; i++) {
      const worker = i % 2 ? late! : survivor!;
      const lease = await worker.command("acquire", { user: `rate-${i}` });
      assert.ok(lease); assert.equal(await worker.command("finish", { lease }), true);
    }
    assert.equal(await late!.command("acquire", { user: "rate-overflow-a" }), null);
    assert.equal(await survivor!.command("acquire", { user: "rate-overflow-b" }), null,
      "database reconnect must not reset or multiply shared rate limits");
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit"); child.kill("SIGKILL"); await exited;
      }
    }
    if (stopped) control("start");
    // The runner destroys the entire private cluster, including these fixture rows.
  }
}
