import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { createDiscoveryCoordinator } from "./mcp-discovery-coordination";
import {
  createDiscoveryOperations, discoveryOperations, discoverySignals,
  coordinationFailureSignal, DiscoveryCoordinationFailure,
} from "./mcp-discovery-operations";

test("operations use fixed credential-safe labels and bounded, repeatable alerts", () => {
  const records: Array<{ level: string; fields: Record<string, unknown> }> = [];
  const log = (level: string) => (fields: object) => records.push({ level, fields: { ...fields } });
  let now = 0;
  const ops = createDiscoveryOperations({ info: log("info"), warn: log("warn"), error: log("error") }, () => now);
  for (const signal of discoverySignals) ops.record(signal, "acquire");
  const metrics = records.filter(r => r.fields.event === "mcp_discovery_metric");
  assert.equal(metrics.length, discoverySignals.length);
  for (const { fields } of metrics) {
    assert.deepEqual(Object.keys(fields).sort(), ["event", "metric", "signal", "operation", "delta", "processTotal"].sort());
    assert.equal(fields.delta, 1);
  }
  assert.equal(records.find(r => r.fields.signal === "lock_timeout" && r.level === "error")?.fields.severity, "critical");
  assert.ok(records.some(r => r.fields.signal === "shared_capacity_denied" && r.level === "warn"));
  assert.equal(records.some(r => r.fields.signal === "authorization_change_discard" && r.level !== "info"), false);
  ops.record("lock_timeout", "acquire");
  assert.equal(records.filter(r => r.level === "error" && r.fields.signal === "lock_timeout").length, 1);
  now = 60_000;
  ops.record("lock_timeout", "acquire");
  assert.equal(records.filter(r => r.level === "error" && r.fields.signal === "lock_timeout").length, 2);
  assert.equal(records.at(-2)!.fields.processTotal, 3);
  const length = records.length;
  ops.record("secret://PRIVATE" as never, "acquire");
  ops.record("database_failure", "private-user" as never);
  ops.record("database_failure", "revision", -1);
  assert.equal(records.length, length);
  const broken = () => { throw new Error("sink unavailable"); };
  assert.doesNotThrow(() => createDiscoveryOperations({ info: broken, warn: broken, error: broken }).record("database_failure", "revision"));
});

test("failure classification reads only bounded SQLSTATE causes", () => {
  const privateError = { message: "credential and endpoint", query: "private policy", cause: { code: "55P03" } };
  assert.equal(coordinationFailureSignal(privateError), "lock_timeout");
  assert.equal(coordinationFailureSignal({ cause: { code: "57014" } }), "statement_timeout");
  assert.equal(coordinationFailureSignal({ code: "08006" }), "database_failure");
  assert.equal(coordinationFailureSignal(new DiscoveryCoordinationFailure()), "protection_unavailable");
  const cycle: { cause?: unknown } = {};
  cycle.cause = cycle;
  assert.equal(coordinationFailureSignal(cycle), "database_failure");
});

test("coordinator emits committed decisions, distinguishes limits and never logs private inputs", async t => {
  const events: Array<{ signal: string; operation: string; amount: number }> = [];
  t.mock.method(discoveryOperations, "record", (signal: string, operation: string, amount = 1) => events.push({ signal, operation, amount }));
  const now = 100_000;
  let state = { leases: [] as Array<{ id: string; user: string; until: number }>,
    attempts: [] as Array<{ user: string; until: number }>, globalAttempts: [] as number[] };
  let revision = "1";
  let failWrite = false;
  t.mock.method(db, "transaction", async (action: (tx: unknown) => Promise<unknown>) => action({
    execute: async (query: { queryChunks: unknown[] }) => {
      // The fixture follows the coordinator's fixed SQL sequence.
      const text = JSON.stringify(query.queryChunks);
      if (text.includes("SELECT state")) return { rows: [{ state: structuredClone(state), revision }] };
      if (text.includes("clock_timestamp")) return { rows: [{ now }] };
      if (text.includes("UPDATE mcp_discovery_coordination") && failWrite) {
        throw { cause: { code: "55P03" }, message: "private SQL, credentials and identities" };
      }
      return { rows: [] };
    },
  }));
  const coordinator = createDiscoveryCoordinator("private-coordination");
  const reset = () => { events.length = 0; state = { leases: [], attempts: [], globalAttempts: [] }; };
  for (const [signal, setup] of [
    ["shared_capacity_denied", () => { state.leases = Array.from({ length: 4 }, (_, i) => ({ id: `${i}`, user: `${i}`, until: now + 1 })); }],
    ["user_concurrency_denied", () => { state.leases = [{ id: "private-lease", user: "private-user", until: now + 1 }]; }],
    ["user_rate_denied", () => { state.attempts = [{ user: "private-user", until: now + 1 }]; }],
    ["rate_state_capacity_denied", () => { state.attempts = Array.from({ length: 1000 }, () => ({ user: "other", until: now + 1 })); }],
    ["shared_rate_denied", () => { state.globalAttempts = Array(60).fill(now + 1); }],
  ] as const) {
    reset(); setup();
    assert.equal(await coordinator.acquire("private-user"), null);
    assert.deepEqual(events, [{ signal, operation: "acquire", amount: 1 }]);
  }
  reset();
  state.leases = [{ id: "private-lease", user: "private-user", until: now - 1 }];
  assert.equal(await coordinator.finish({ id: "private-lease", revision }), false);
  assert.deepEqual(events, [{ signal: "lease_expired", operation: "finish", amount: 1 }]);
  reset();
  state.leases = [{ id: "private-lease", user: "private-user", until: now + 1 }];
  revision = "2";
  assert.equal(await coordinator.finish({ id: "private-lease", revision: "1" }), false);
  assert.deepEqual(events, [{ signal: "authorization_change_discard", operation: "finish", amount: 1 }]);
  reset();
  state.globalAttempts = Array(60).fill(now + 1);
  failWrite = true;
  await assert.rejects(coordinator.acquire("private-user"), error =>
    error instanceof DiscoveryCoordinationFailure && !error.message.includes("private"));
  assert.deepEqual(events, [{ signal: "lock_timeout", operation: "acquire", amount: 1 }], "rolled-back denials are not counted");
  failWrite = false;
  reset();
  t.mock.method(db, "execute", async () => { throw { cause: { code: "08006" }, message: "private connection string" }; });
  await assert.rejects(coordinator.revision(), DiscoveryCoordinationFailure);
  assert.deepEqual(events, [{ signal: "database_failure", operation: "revision", amount: 1 }]);
  reset();
  t.mock.method(db, "execute", async () => ({ rows: [] }));
  await assert.rejects(coordinator.revision(), DiscoveryCoordinationFailure);
  assert.deepEqual(events, [{ signal: "protection_unavailable", operation: "revision", amount: 1 }]);
  assert.equal(JSON.stringify(events).includes("private"), false);
});
