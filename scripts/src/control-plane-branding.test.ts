import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { openMetadataDocuments } from "@workspace/agent-runtime/openmetadata";
// Runtime-only test targets, following the existing cross-workspace test convention.
const { generateMcpPackage } = await import(new URL("../../artifacts/api-server/src/lib/mcp-packages.ts", import.meta.url).href);
const { CATEGORY_STANDARDS_SOURCE_PREFIX } = await import(new URL("../../artifacts/api-server/src/lib/catalogue-category-standards.ts", import.meta.url).href);
const { MCP_STANDARDS_SOURCE } = await import(new URL("../../artifacts/api-server/src/lib/catalogue-standards.ts", import.meta.url).href);
const { knowledgeSourceLabel, OPENMETADATA_SOURCE_PREFIX } = await import(new URL("../../artifacts/agent-foundry/src/lib/knowledge-source.ts", import.meta.url).href);

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function archiveFiles(buffer: Buffer): Map<string, string> {
  const tar = gunzipSync(buffer);
  const files = new Map<string, string>();
  for (let offset = 0; offset + 512 <= tar.length && tar[offset] !== 0;) {
    const name = tar.subarray(offset, offset + 100).toString().replace(/\0.*$/, "");
    const size = parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0.*$/, "").trim(), 8);
    assert.ok(Number.isFinite(size));
    files.set(name, tar.subarray(offset + 512, offset + 512 + size).toString());
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

test("legacy managed sources keep importer identity while displaying MOSSI Studio", () => {
  assert.equal(OPENMETADATA_SOURCE_PREFIX, "Agent Foundry managed OpenMetadata reference | ");
  assert.equal(CATEGORY_STANDARDS_SOURCE_PREFIX, "Agent Foundry priority MCP standards | ");
  assert.equal(MCP_STANDARDS_SOURCE, "Agent Foundry MCP architecture guidance");
  for (const doc of openMetadataDocuments) {
    const source = doc.source;
    assert.ok(source.startsWith(OPENMETADATA_SOURCE_PREFIX));
    assert.equal(knowledgeSourceLabel(source), source.replace(/^Agent Foundry/, "MOSSI Studio"));
    assert.equal(doc.source, source);
  }
  assert.equal(knowledgeSourceLabel(`${CATEGORY_STANDARDS_SOURCE_PREFIX}Cloud Platforms`),
    "MOSSI Studio priority MCP standards | Cloud Platforms");
  assert.equal(knowledgeSourceLabel(MCP_STANDARDS_SOURCE), "MOSSI Studio MCP architecture guidance");
});

test("user-authored sources are not indiscriminately rebranded", () => {
  for (const source of ["", "Agent Foundry notes from our team", "https://example.com/agent-foundry",
    "Agent Foundry priority MCP standards", "Upstream Foundry product"]) {
    assert.equal(knowledgeSourceLabel(source), source);
  }
});

test("reference panels and readers use stored identities separately from display labels", () => {
  const reference = read("artifacts/agent-foundry/src/components/openmetadata-reference.tsx");
  assert.match(reference, /doc\.source\.startsWith\(OPENMETADATA_SOURCE_PREFIX\)/);
  const page = read("artifacts/agent-foundry/src/pages/knowledge.tsx");
  assert.match(page, /knowledgeSourceLabel\(doc\.source\)/);
  assert.match(page, /knowledgeSourceLabel\(reading\.source\)/);
  // Editing must retain the real source, not save a presentation label back into the importer identity.
  assert.match(page, /source: doc\.source \?\? ''/);
  const importer = read("artifacts/api-server/src/lib/openmetadata-import.ts");
  assert.match(importer, /reference\.source/);
});

for (const target of ["cloudflare", "openshell"] as const) {
  test(`${target} MCP app presentation is rebranded without renaming package or integration contracts`, () => {
    const definition = { id: 42, name: "Agent Foundry customer tool", description: "User-authored description",
      kind: "app" as const, transport: "streamable-http",
      jsonSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } };
    const pkg = generateMcpPackage(definition, target);
    assert.equal(pkg.filename, `agent-foundry-agent-foundry-customer-tool-${target}.tar.gz`);
    const files = archiveFiles(pkg.buffer);
    const html = files.get("mcp-app.html")!;
    assert.match(html, /CONTROL PLANE · MCP APP/);
    assert.match(html, /<h1>Agent Foundry customer tool<\/h1>/);
    assert.match(html, /User-authored description/);
    const readme = files.get("README.md")!;
    assert.match(readme, /Control Plane/);
    assert.doesNotMatch(readme, /Agent Foundry's|Agent Foundry API/);
    assert.match(readme, /FOUNDRY_API_BASE_URL/);
    assert.match(readme, /FOUNDRY_API_TOKEN/);
    assert.equal(JSON.parse(files.get("package.json")!).name,
      `agent-foundry-agent-foundry-customer-tool-${target}`);
    const server = files.get("src/server.ts")!;
    assert.match(server, /foundry\.knowledge\.query/);
    assert.match(server, /FOUNDRY_API_TOKEN/);
    assert.match(server, /Control Plane knowledge query failed/);
    assert.match(server, /"required":\["query"\]/);
    assert.match(files.get("src/access.ts")!, /MCP_ACCESS_TOKEN/);
  });
}

test("saved builder journey key and version stay compatible across the rebrand", () => {
  const builder = read("artifacts/agent-foundry/src/pages/prototype-builder.tsx");
  assert.match(builder, /const STORAGE_KEY = 'agent-foundry\.builder\.journey';/);
  assert.match(builder, /const STORAGE_VERSION = 1;/);
  assert.match(builder, /sessionStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(builder, /sessionStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(\{ v: STORAGE_VERSION, j \}\)\)/);
  assert.match(builder, /d\.v !== STORAGE_VERSION/);
});

test("browser/social metadata and artifact retain routing but expose MOSSI Studio", () => {
  const html = read("artifacts/agent-foundry/index.html");
  assert.match(html, /<title>MOSSI Studio<\/title>/);
  for (const name of ["og:title", "twitter:title"]) {
    assert.ok(html.includes(`${name}" content="MOSSI Studio"`));
  }
  assert.doesNotMatch(html, /Agent Foundry|Update this description/);
  assert.match(html, /[Ii]ntegrations are not (?:yet )?connected/);
  const artifact = read("artifacts/agent-foundry/.replit-artifact/artifact.toml");
  assert.match(artifact, /title = "MOSSI Studio"/);
  assert.match(artifact, /id = "artifacts\/agent-foundry"/);
  assert.match(artifact, /previewPath = "\/"/);
});
