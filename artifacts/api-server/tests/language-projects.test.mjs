import { test } from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { validateLanguageProject, languageGenerationContext, assembleLanguageProject } from "../src/lib/language-mcp-projects.ts";
import { OFFICIAL_SDKS, sdkTargets } from "../src/lib/official-mcp-sdks.ts";

const definition = { id: 1, name: "KnowledgeSearch", description: "Search the wiki", kind: "server",
  transport: "stdio", jsonSchema: { type: "object", properties: { query: { type: "string", minLength: 2 } }, required: ["query"] } };
const files = [
  { path: "server.py", content: "from mcp.server.fastmcp import FastMCP\nserver = FastMCP('Example')\n" },
  { path: "README.md", content: "Source fixture. Build and protocol tests have not run." },
  { path: "tests/test_contract.py", content: "def test_contract():\n    assert True\n" },
];

test("each official SDK language is explicit; native languages do not silently target workerd", () => {
  assert.equal(OFFICIAL_SDKS.length, 11);
  for (const sdk of OFFICIAL_SDKS) {
    assert.equal(sdkTargets(sdk.language).includes("cloudflare"), ["typescript", "javascript"].includes(sdk.language));
  }
});

test("rejects path traversal, absolute/duplicate/reserved paths, binary content, and language substitution", () => {
  assert.equal(validateLanguageProject({ files }, "python").length, 3);
  for (const path of ["../../host", "/etc/passwd", "definition.json", ".env", "nested/.env.local", "server.py"]) {
    assert.throws(() => validateLanguageProject({ files: [...files, { path, content: "bad" }] }, "python"), /path/i);
  }
  assert.throws(() => validateLanguageProject({ files: [...files, { path: "binary.dat", content: "\0" }] }, "python"), /binary/);
  assert.throws(() => validateLanguageProject({ files }, "go"), /source file/);
  assert.throws(() => validateLanguageProject({ files: files.slice(0, 2) }, "python"), /3–30/);
});

test("rejects unsupported language/runtime and app combinations before generation", async () => {
  await assert.rejects(languageGenerationContext(definition, "python", "cloudflare", []), /cannot run natively/);
  await assert.rejects(languageGenerationContext(definition, "unknown", "openshell", []), /Unsupported language/);
  await assert.rejects(languageGenerationContext({ ...definition, kind: "app" }, "python", "openshell", []), /MCP servers/);
});

test("packages preserve schema, official provenance, unverified status and review controls", async () => {
  const context = await languageGenerationContext(definition, "python", "openshell", ["Knowledge & Memory"]);
  const project = await assembleLanguageProject(definition, "python", "openshell", ["Knowledge & Memory"], context, { files });
  assert.equal(project.buildStatus, "not-run");
  assert.equal(project.deploymentStatus, "not-deployed");
  assert.match(project.sourceDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(project.files.find((file) => file.path === "definition.json").content), definition);
  assert.match(project.files.find((file) => file.path === "REQUIRED-REVIEW.md").content, /knowledge-injection/);
  assert.ok(project.files.some((file) => file.path === "official-mcp/schema.json"));
  assert.ok(gunzipSync(Buffer.from(project.archiveBase64, "base64")).length > 1000);
  const second = await assembleLanguageProject(definition, "python", "openshell", ["Knowledge & Memory"], context, { files });
  assert.equal(second.sourceDigest, project.sourceDigest);
  assert.equal(second.archiveBase64, project.archiveBase64);
});
