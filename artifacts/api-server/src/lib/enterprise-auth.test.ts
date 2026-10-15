import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { stripTypeScriptTypes } from "node:module";
import { generateMcpPackage } from "./mcp-packages";
import { bridgeKey, verifyBridge } from "./enterprise-auth";
import {
  initialEnterpriseStandard, parseStandard, validateCandidate,
} from "@workspace/agent-runtime/enterprise-standards";

test("workspace assertions bind identity, tool arguments and timestamp", () => {
  const secret = "test-only-signing-key";
  const body = {
    workspaceId: "workspace-a", userId: "user-a", timestamp: Date.now(),
    rpc: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "foundry.knowledge.query", arguments: { query: "test" } } },
  };
  const sign = (value: unknown) => createHmac("sha256", bridgeKey(secret)).update(JSON.stringify(value)).digest("hex");
  assert.ok(verifyBridge(body, sign(body), secret));
  assert.equal(verifyBridge({ ...body, userId: "user-b" }, sign(body), secret), null);
  assert.equal(verifyBridge({ ...body, workspaceId: "workspace-b" }, sign(body), secret), null);
  assert.equal(verifyBridge(body, sign(body), secret, body.timestamp + 61_000), null);
  assert.equal(verifyBridge(body, sign(body), "wrong-key"), null);
  assert.equal(verifyBridge(body, undefined, secret), null);
  assert.equal(verifyBridge(body, "not-hex", secret), null);
});

test("all three reusable templates and versioned schemas are valid", () => {
  const standard = parseStandard(initialEnterpriseStandard);
  assert.deepEqual(standard.templates.map(t => t.kind), ["server", "app", "agent"]);
  assert.throws(() => parseStandard({ ...standard, version: "latest" }));
  assert.throws(() => parseStandard({ ...standard, inputSchema: { type: "invented" } }));
  assert.throws(() => parseStandard({ ...standard, templates: [standard.templates[0]] }));
  const identified = { ...standard, inputSchema: { ...standard.inputSchema, $id: "https://example.test/input/1.0.0" } };
  parseStandard(identified);
  parseStandard(identified); // Repeated reads of published schema IDs must remain valid.
});

test("candidate validation enforces contracts, evidence, tools and safe files", () => {
  const candidate = {
    input: { query: "incident response" },
    output: { answer: "Use the approved runbook.", citations: [1] },
    tools: ["foundry.knowledge.query"], citations: [1],
    files: { "src/agent.ts": "export const version = '1.0.0';" },
  };
  assert.equal(validateCandidate(initialEnterpriseStandard, candidate, [1]).valid, true);
  assert.equal(validateCandidate(initialEnterpriseStandard, { ...candidate, tools: ["enterprise.admin"] }, [1]).valid, false);
  assert.equal(validateCandidate(initialEnterpriseStandard, candidate, [2]).valid, false);
  assert.equal(validateCandidate(initialEnterpriseStandard, { ...candidate, input: { query: 2 } }, [1]).valid, false);
  assert.equal(validateCandidate(initialEnterpriseStandard, { ...candidate, output: { answer: "bad" } }, [1]).valid, false);
  assert.equal(validateCandidate(initialEnterpriseStandard, { ...candidate, output: { answer: "bad", citations: [2] } }, [1]).valid, false);
  assert.throws(() => validateCandidate(initialEnterpriseStandard, { ...candidate, files: { "../escape": "bad" } }, [1]));
  assert.equal(validateCandidate(initialEnterpriseStandard, { ...candidate, files: { ".env": "TOKEN=embedded" } }, [1]).valid, false);
});

test("generated MCP server and App packages use only scoped knowledge transport", () => {
  for (const target of ["cloudflare", "openshell"] as const) {
    for (const kind of ["server", "app"] as const) {
      const archive = generateMcpPackage({
        id: 1, name: "Enterprise knowledge", description: "Approved knowledge",
        kind, transport: "streamable-http", jsonSchema: initialEnterpriseStandard.inputSchema,
      }, target);
      const source = gunzipSync(archive.buffer).toString("utf8");
      assert.ok(source.includes("/enterprise/mcp"));
      assert.ok(source.includes("foundry.knowledge.query"));
      assert.ok(source.includes("workspace/user-scoped capability token are required"));
      assert.ok(!source.includes("${baseUrl}/knowledge/query"));
      assert.ok(source.includes('redirect: "error"'));
    }
  }
});

function packageSources(buffer: Buffer): Map<string, string> {
  const tar = gunzipSync(buffer);
  const sources = new Map<string, string>();
  for (let offset = 0; offset + 512 <= tar.length && tar[offset] !== 0;) {
    const name = tar.subarray(offset, offset + 100).toString().replace(/\0.*$/, "");
    const size = Number.parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0.*$/, "").trim(), 8);
    sources.set(name, tar.subarray(offset + 512, offset + 512 + size).toString());
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return sources;
}

test("generated Cloudflare entrypoints reject anonymous callers before any knowledge handler", async () => {
  for (const kind of ["server", "app"] as const) {
    const sources = packageSources(generateMcpPackage({
      id: 1, name: "Protected knowledge", description: "Private wiki",
      kind, transport: "streamable-http", jsonSchema: initialEnterpriseStandard.inputSchema,
    }, "cloudflare").buffer);
    const access = stripTypeScriptTypes(sources.get("src/access.ts")!);
    const worker = stripTypeScriptTypes(sources.get("src/worker.ts")!).replace(/^import .+;\s*$/gm, "");
    // Use the emitted Worker fetch handler unchanged. The MCP SDK is a probe: unauthorized
    // requests must never construct or invoke it, regardless of the backend grant/token.
    const moduleSource = `${access}
let handlerCalls = 0;
const createServer = () => ({});
const createMcpHandler = () => ({ fetch: async () => { handlerCalls++; return new Response("authorized"); } });
export const getHandlerCalls = () => handlerCalls;
${worker}
// ${kind}`;
    const generated = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
    const env = { FOUNDRY_API_TOKEN: "b".repeat(64), MCP_ACCESS_TOKEN: "c".repeat(64) };
    const anonymous = () => new Request("https://knowledge.example/mcp", { method: "POST" });
    assert.equal((await generated.default.fetch(anonymous(), env)).status, 401);
    assert.equal((await generated.default.fetch(anonymous(), { FOUNDRY_API_TOKEN: env.FOUNDRY_API_TOKEN })).status, 503);
    assert.equal((await generated.default.fetch(anonymous(), { ...env, MCP_ACCESS_TOKEN: env.FOUNDRY_API_TOKEN })).status, 503);
    assert.equal((await generated.default.fetch(new Request("https://knowledge.example/mcp", {
      headers: { authorization: "Bearer wrong" },
    }), env)).status, 401);
    assert.equal(generated.getHandlerCalls(), 0);
    assert.equal((await generated.default.fetch(new Request("https://knowledge.example/mcp", {
      headers: { authorization: `Bearer ${env.MCP_ACCESS_TOKEN}` },
    }), env)).status, 200);
    assert.equal(generated.getHandlerCalls(), 1);
  }
  const nodeSources = packageSources(generateMcpPackage({
    id: 1, name: "Protected knowledge", description: "Private wiki",
    kind: "server", transport: "streamable-http", jsonSchema: initialEnterpriseStandard.inputSchema,
  }, "openshell").buffer);
  const main = nodeSources.get("src/main.ts")!;
  assert.ok(main.indexOf("authorizeMcpRequest(req.get") < main.indexOf("const server = createServer"));
  assert.ok(main.includes("res.status(status)"));
});
