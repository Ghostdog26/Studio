import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import { request, type RequestOptions } from "node:https";
import { discoveryApprovalSchema, discoveryPolicySchema, approvedUrl, isPublicAddress, approvalIsCurrent } from "./mcp-discovery-policy";
import { discoverMcp, networkExchange, type Exchange } from "./mcp-discovery-client";

const approval = discoveryApprovalSchema.parse({
  id: "fixture", layer: "catalogued-server", instanceId: "fictional-instance",
  catalogueRecordId: "fictional-record", endpoint: "https://mcp.example.com/mcp",
  deployedVersion: "fixture-1", protocolVersion: "2025-03-26", transport: "streamable-http",
  evidenceDocumentIds: [1], evidenceRevision: "fixture-evidence",
  credentialSecretRef: "secret://MCP_DISCOVERY_FIXTURE", approvedBy: "test-operator",
  approvedAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z",
  workspaceId: "fixture-workspace", userId: "fixture-user",
});
const initializeResult = {
  protocolVersion: approval.protocolVersion,
  serverInfo: { name: "fixture-server", version: approval.deployedVersion },
  capabilities: { tools: {}, resources: {}, prompts: {} },
};
function fakeExchange(transform?: (method: string, result: Record<string, unknown>) => unknown) {
  const calls: Record<string, unknown>[] = [];
  const exchange: Exchange = async body => {
    calls.push(body);
    const method = String(body.method);
    if (method === "notifications/initialized") return { status: 202, body: null };
    const result: Record<string, unknown> = method === "initialize" ? initializeResult :
      method === "tools/list" ? { tools: [{ name: "fixture-tool", inputSchema: { type: "object" }, description: "Untrusted text", ignored: "removed" }] } :
      method === "resources/list" ? { resources: [{ uri: "file:///untrusted-not-read" }] } :
      { prompts: [{ name: "fixture-prompt" }] };
    return { status: 200, body: { jsonrpc: "2.0", id: body.id, result: transform ? transform(method, result) : result }, session: "fixture-session" };
  };
  return { calls, exchange };
}

test("discovery approval requires separate MCP layer, release/transport evidence and secret reference", () => {
  assert.ok(approvalIsCurrent(approval, Date.parse("2026-10-15T00:00:00Z")));
  assert.equal(approvalIsCurrent(approval, Date.parse(approval.expiresAt)), false);
  for (const patch of [
    { layer: "openmetadata-interface" }, { deployedVersion: "" }, { transport: "stdio" },
    { credentialSecretRef: "plain-token" }, { credentialSecretRef: "secret://SESSION_SECRET" },
    { evidenceDocumentIds: [] }, { unexpected: true },
  ]) assert.equal(discoveryApprovalSchema.safeParse({ ...approval, ...patch }).success, false);
  assert.equal(discoveryPolicySchema.safeParse({ version: "1", approvals: [approval, approval] }).success, false);
});

test("egress rejects literal IPs, credentials, alternate ports, query secrets and unsafe address families", () => {
  for (const endpoint of [
    "http://example.com/mcp", "https://127.0.0.1/mcp", "https://[::1]/mcp",
    "https://example.com:444/mcp", "https://user:pass@example.com/mcp",
    "https://localhost/mcp", "https://service.internal/mcp", "https://example.com/mcp?token=x",
    "https://example.com/mcp#fragment",
  ]) assert.throws(() => approvedUrl(endpoint), endpoint);
  assert.equal(approvedUrl(approval.endpoint).pathname, "/mcp");
  for (const address of [
    "0.0.0.0", "127.1.2.3", "10.0.0.1", "100.100.100.200", "169.254.169.254",
    "172.16.1.1", "192.168.1.1", "192.0.2.1", "168.63.129.16", "198.19.1.1", "224.0.0.1", "255.255.255.255",
    "::", "::1", "::ffff:8.8.8.8", "fe80::1", "fc00::1", "ff02::1", "2001:db8::1", "2002::1",
  ]) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});

test("client only initializes and lists, strips unknown fields and never reads resources or calls tools", async () => {
  const { exchange, calls } = fakeExchange();
  const inventory = await discoverMcp(approval, exchange);
  assert.equal(inventory.tools[0]?.name, "fixture-tool");
  assert.equal("ignored" in inventory.tools[0]!, false);
  assert.deepEqual(calls.map(c => c.method), [
    "initialize", "notifications/initialized", "tools/list", "resources/list", "prompts/list",
  ]);
  assert.equal(inventory.resources[0]?.uri, "file:///untrusted-not-read");
});

test("version mismatch, malformed inventory and incomplete pagination never produce verified evidence", async () => {
  for (const transform of [
    (method: string, result: Record<string, unknown>) => method === "initialize" ? { ...result, protocolVersion: "wrong" } : result,
    (method: string, result: Record<string, unknown>) => method === "initialize" ? { ...result, serverInfo: { name: "x", version: "wrong" } } : result,
    (method: string, result: Record<string, unknown>) => method === "tools/list" ? { tools: [{ name: "missing-schema" }] } : result,
    (method: string, result: Record<string, unknown>) => method === "tools/list" ? { ...result, nextCursor: "repeated" } : result,
  ]) await assert.rejects(discoverMcp(approval, fakeExchange(transform).exchange));
});

test("cursor pagination is complete and absent capabilities remain empty", async () => {
  let pages = 0;
  const fixture = fakeExchange((method, result) => {
    if (method === "tools/list") return ++pages === 1 ? { ...result, nextCursor: "page2" } : { tools: [] };
    return result;
  });
  assert.equal((await discoverMcp(approval, fixture.exchange)).tools.length, 1);
  assert.deepEqual(fixture.calls.find(c => (c.params as { cursor?: string })?.cursor === "page2")?.params, { cursor: "page2" });
  const empty = fakeExchange((method, result) => method === "initialize" ? { ...result, capabilities: {} } : result);
  assert.deepEqual((await discoverMcp(approval, empty.exchange)).tools, []);
  assert.equal(empty.calls.length, 2);
});

test("network client pins public DNS, never follows redirects and rejects mixed private/public DNS", async () => {
  let sent = 0;
  let options: RequestOptions | undefined;
  let status = 200;
  let body = '{"jsonrpc":"2.0","id":1,"result":{}}';
  let headers: Record<string, string> = { "content-type": "application/json" };
  const send = ((_url: URL, opts: RequestOptions, callback: (response: IncomingMessage) => void) => {
    sent++; options = opts;
    const req = Object.assign(new EventEmitter(), { end() {
      const response = Object.assign(new PassThrough(), { statusCode: status, headers });
      callback(response as unknown as IncomingMessage);
      response.end(body);
    } });
    return req;
  }) as typeof request;
  const resolve = async () => [{ address: "8.8.8.8", family: 4 }];
  const exchange = networkExchange(approval, "fixture-only-bearer", new AbortController().signal, { resolve, send });
  await exchange({ id: 1 });
  assert.equal(sent, 1);
  assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer fixture-only-bearer");
  const lookupOptions = options!.lookup!;
  await new Promise<void>((resolveLookup, reject) => {
    lookupOptions("mcp.example.com", {}, (error, address, family) => {
      if (error) { reject(error); return; }
      assert.equal(address, "8.8.8.8");
      assert.equal(family, 4);
      resolveLookup();
    });
  });
  status = 302;
  headers = { location: "https://evil.example.com/mcp" };
  await assert.rejects(exchange({ id: 2 }), /discovery-failed/);
  assert.equal(sent, 2, "redirect must not trigger another request");
  const mixed = networkExchange(approval, "fixture-only", new AbortController().signal, {
    resolve: async () => [...await resolve(), { address: "169.254.169.254", family: 4 }], send,
  });
  await assert.rejects(mixed({ id: 3 }), /network-policy/);
  assert.equal(sent, 2, "private DNS must not send credentials");
  status = 200; headers = { "content-type": "application/json" };
  body = "x".repeat(256 * 1024 + 1);
  await assert.rejects(exchange({ id: 4 }), /incomplete-discovery/);
  body = "data: {}\n\n"; headers = { "content-type": "text/event-stream" };
  await assert.rejects(exchange({ id: 5 }), /incomplete-discovery/);
  status = 401;
  await assert.rejects(exchange({ id: 6 }), /remote-denied/);
});

test("total deadline cancels hung DNS before any request sends credentials", async () => {
  const controller = new AbortController();
  const exchange = networkExchange(approval, "fixture-only", controller.signal, {
    resolve: () => new Promise(() => {}),
    send: (() => { throw new Error("must not connect"); }) as typeof request,
  });
  const pending = exchange({ id: 1 });
  controller.abort();
  await assert.rejects(pending, /discovery-failed/);
});
