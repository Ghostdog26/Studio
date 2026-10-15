import { test } from "node:test";
import assert from "node:assert/strict";
import { openMetadataDocuments, OPENMETADATA_REVISION, openMetadataSources } from "@workspace/agent-runtime/openmetadata";
import { openMetadataContextSchema, openMetadataProfileSchema, openMetadataProfile, validateOpenMetadataContext } from "@workspace/agent-runtime/openmetadata-contract";
import { initialEnterpriseStandard, openMetadataEnterpriseStandard, parseStandard, validateCandidate, generationSelectionSchema } from "@workspace/agent-runtime/enterprise-standards";
import { runtimeAdapters } from "@workspace/agent-runtime";
// Runtime-only test targets: do not pull another workspace's source into scripts' TS project.
const { managedOpenMetadataDocument, openMetadataImportAction } = await import(new URL("../../artifacts/api-server/src/lib/openmetadata-import-plan.ts", import.meta.url).href);
const { rankDocuments } = await import(new URL("../../artifacts/api-server/src/lib/knowledge-ranking.ts", import.meta.url).href);

const emptyContext = { contractVersion: "1.0.0", connectionState: "not-connected", instance: null, assets: [] };
// Fictional, offline, no network or enterprise credentials. Version is deliberately not a release claim.
const fixture = () => ({
  ...emptyContext,
  instance: { instanceId: "illustrative-instance", deployedRelease: "illustrative-release", capabilityEvidenceDocumentId: 1, credentialSecretRef: "secret://EXAMPLE_METADATA_READ" },
  assets: [{
    entityId: "illustrative-table-id", fullyQualifiedName: "example.db.schema.table", entityType: "table",
    metadataVersion: "illustrative-metadata-version",
    provenance: { kind: "authorized-snapshot", sourceUrl: "https://metadata.example.invalid/entity", sourceRevision: "illustrative-revision", knowledgeDocumentId: 2, retrievedAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" },
    permissionScope: { workspaceId: "fixture-workspace", userId: "fixture-user", permissionRevision: "fixture-grant" },
    freshness: "fresh", owners: null, classifications: null, businessSemantics: null,
    schemaDescription: "Illustrative only: field availability is unknown.", apiDescription: null,
    mcpReference: null,
  }],
});
test("references retain pinned provenance, source links, qualifications and explicit absence of a connection", () => {
  assert.equal(openMetadataDocuments.length, 4);
  assert.equal(new Set(openMetadataDocuments.map(doc => doc.source)).size, 4);
  for (const doc of openMetadataDocuments) {
    assert.ok(doc.content.length < 6000, "retrieval must not truncate source qualifications");
    assert.ok(doc.content.includes(OPENMETADATA_REVISION));
    assert.match(doc.content, /No enterprise instance or live catalogue data is connected/);
    assert.match(doc.content, /Illustrative only/);
    assert.match(doc.content, /Source: https:\/\//);
    assert.match(doc.content, /release inclusion is not established/);
  }
  for (const url of Object.values(openMetadataSources)) assert.ok(openMetadataDocuments.some(doc => doc.content.includes(url)));
});
test("repeat import plans are idempotent, detect edits and do not adopt unrelated human sources", () => {
  for (const doc of openMetadataDocuments) {
    const managed = managedOpenMetadataDocument(doc);
    assert.equal(openMetadataImportAction(undefined, managed), "insert");
    assert.equal(openMetadataImportAction(managed, managed), "unchanged");
    assert.equal(openMetadataImportAction(managed, managedOpenMetadataDocument({ ...doc, content: `${doc.content}\nNew revision` })), "update");
    assert.throws(() => openMetadataImportAction({ ...managed, content: "Human addition" }, managed), /human edits/);
    assert.throws(() => openMetadataImportAction(doc, managed), /collision/);
  }
});
test("retrieval ranks relevant OpenMetadata references alongside unrelated and community documents", () => {
  const corpus = [...openMetadataDocuments,
    { title: "MCP reference: Other server", content: "A community MCP server directory description", tags: ["MCP", "catalogue"] },
    { title: "Holiday policy", content: "Office closures", tags: ["HR"] },
  ];
  for (const [query, key] of [
    ["OpenMetadata table schemas columns business semantics", "schemas-semantics"],
    ["OpenMetadata REST API endpoints collections", "rest-api"],
    ["OpenMetadata MCP live discovery tools servers", "mcp"],
    ["What does OpenMetadata supply builders enterprise context", "enterprise-context"],
  ]) {
    const ranked = rankDocuments(query, corpus);
    assert.equal(ranked[0]?.document.title, openMetadataDocuments.find(doc => doc.source.endsWith(`| ${key}`))?.title);
    assert.ok(!ranked.some((result: { document: { title: string } }) => result.document.title === "Holiday policy"));
  }
  assert.deepEqual(rankDocuments("unfindablexyz", corpus), []);
});
test("profile selection reuses pinned template contracts across all kinds without changing old standards or runtime readiness", async () => {
  const standard = parseStandard(openMetadataEnterpriseStandard);
  assert.equal(standard.version, "1.1.0");
  assert.equal(initialEnterpriseStandard.version, "1.0.0");
  for (const kind of ["server", "app", "agent"]) {
    const selection = generationSelectionSchema.parse({ standardsVersion: standard.version, templateId: `openmetadata-${kind}`, query: "Describe metadata" });
    const template = standard.templates.find(t => t.id === selection.templateId)!;
    assert.equal(template.kind, kind);
    assert.equal(template.integrationProfile?.connectionState, "not-connected");
    assert.ok(template.integrationProfile?.referenceDocuments.every(doc => doc.content.includes(OPENMETADATA_REVISION)));
  }
  assert.equal(openMetadataProfileSchema.safeParse({ ...openMetadataProfile, connectionState: "connected" }).success, false);
  assert.deepEqual(standard.permittedTools, ["foundry.knowledge.query"]);
  for (const adapter of runtimeAdapters) {
    assert.equal(adapter.isConfigured(), false);
    await assert.rejects(() => adapter.run({ agentId: 1, input: {} }), /not connected/);
  }
});
test("offline context validates reference-only unknowns, scope, version evidence, expiry and secret references", () => {
  assert.equal(openMetadataContextSchema.safeParse(emptyContext).success, true);
  assert.deepEqual(validateOpenMetadataContext(emptyContext, []), []);
  assert.deepEqual(validateOpenMetadataContext(fixture(), [1, 2], { workspaceId: "fixture-workspace", userId: "fixture-user" }), []);
  assert.ok(validateOpenMetadataContext(fixture(), [1]).includes("Unauthorized OpenMetadata asset evidence."));
  assert.ok(validateOpenMetadataContext(fixture(), [2]).includes("Unauthorized instance capability evidence."));
  assert.ok(validateOpenMetadataContext(fixture(), [1, 2], { workspaceId: "other", userId: "fixture-user" }).includes("OpenMetadata permission scope mismatch."));
  assert.ok(validateOpenMetadataContext({ ...fixture(), instance: null }, [1, 2]).some(error => /Instance\/release/.test(error)));
  for (const freshness of ["unknown", "stale", "removed", "inaccessible", "partial"]) {
    const context = fixture(); context.assets[0]!.freshness = freshness;
    assert.ok(validateOpenMetadataContext(context, [1, 2]).some(error => /not current/.test(error)));
  }
  const expired = fixture(); expired.assets[0]!.provenance.expiresAt = "2020-01-01T00:00:00Z";
  assert.ok(validateOpenMetadataContext(expired, [1, 2]).length);
  assert.equal(openMetadataContextSchema.safeParse({ ...emptyContext, connectionState: "connected" }).success, false);
  const credential = fixture(); credential.instance.credentialSecretRef = "raw-credential-not-allowed";
  assert.equal(openMetadataContextSchema.safeParse(credential).success, false);
  const mcp = fixture();
  const asset = { ...mcp.assets[0], mcpReference: { layer: "catalogued-server", protocolVersion: null, transport: null, liveDiscovery: "unverified", approvedForInvocation: false } };
  assert.equal(openMetadataContextSchema.safeParse({ ...mcp, assets: [asset] }).success, true);
  assert.equal(openMetadataContextSchema.safeParse({ ...mcp, assets: [{ ...asset, mcpReference: { ...asset.mcpReference, approvedForInvocation: true } }] }).success, false);
});
test("builder rejects missing or unauthorized metadata examples and cannot add live tool permissions", () => {
  const candidate = {
    input: { query: "Describe OpenMetadata", openmetadataContext: emptyContext },
    output: { answer: "No enterprise instance is connected.", citations: [1] },
    tools: ["foundry.knowledge.query"], citations: [1], files: { "AGENT.md": "Illustrative only" },
  };
  assert.equal(validateCandidate(openMetadataEnterpriseStandard, candidate, [1]).valid, true);
  assert.equal(validateCandidate(openMetadataEnterpriseStandard, { ...candidate, input: { query: "Describe metadata" } }, [1]).valid, false);
  assert.equal(validateCandidate(openMetadataEnterpriseStandard, { ...candidate, input: { ...candidate.input, openmetadataContext: fixture() } }, [1]).valid, false);
  assert.equal(validateCandidate(openMetadataEnterpriseStandard, { ...candidate, tools: ["search_metadata"] }, [1]).valid, false);
});
