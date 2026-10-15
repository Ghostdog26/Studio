import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { discoveryApprovalSchema, type DiscoveryApproval } from "./mcp-discovery-policy";
import { DiscoveryOAuth, type OAuthPost } from "./mcp-discovery-oauth";

const approval = discoveryApprovalSchema.parse({
  id: "oauth-fixture", layer: "openmetadata-interface", instanceId: "fictional",
  catalogueRecordId: null, endpoint: "https://mcp.example.com/mcp",
  deployedVersion: "fixture-1", protocolVersion: "2025-03-26", transport: "streamable-http",
  evidenceDocumentIds: [1], evidenceRevision: "fixture",
  oauth: {
    authorizationEndpoint: "https://auth.example.com/authorize", tokenEndpoint: "https://auth.example.com/token",
    revocationEndpoint: "https://auth.example.com/revoke", redirectUri: "https://app.example.com/discovery-callback",
    clientId: "fictional-public-client", scopes: ["metadata:read"],
  },
  approvedBy: "operator", approvedAt: "2026-01-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z",
  workspaceId: "workspace", userId: "initiating-user",
});
const binding = (value = approval) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const signal = () => new AbortController().signal;
const reply = (patch = {}) => ({
  status: 200, body: { access_token: "fictional-access", token_type: "Bearer", refresh_token: "fictional-refresh", expires_in: 60, ...patch },
});
function fixture(post?: OAuthPost) {
  const calls: { endpoint: string; form: URLSearchParams }[] = [];
  const oauth = new DiscoveryOAuth(post ?? (async (endpoint, form) => {
    calls.push({ endpoint, form }); return reply();
  }));
  const start = (value = approval, key = binding(value)) => {
    const url = new URL(oauth.begin(value, key).authorizationUrl);
    return { state: url.searchParams.get("state")!, code: "fictional-code", redirectUri: value.oauth!.redirectUri };
  };
  return { oauth, calls, start };
}

test("OAuth policy requires exactly one credential source and pins all OAuth endpoints", () => {
  assert.equal(discoveryApprovalSchema.safeParse({ ...approval, credentialSecretRef: "secret://MCP_DISCOVERY_FIXTURE" }).success, false);
  assert.equal(discoveryApprovalSchema.safeParse({ ...approval, oauth: undefined }).success, false);
  for (const field of ["authorizationEndpoint", "tokenEndpoint", "revocationEndpoint", "redirectUri"]) {
    for (const url of ["http://auth.example.com/token", "https://auth.example.com/token?q=x", "https://127.0.0.1/token"]) {
      assert.equal(discoveryApprovalSchema.safeParse({ ...approval, oauth: { ...approval.oauth, [field]: url } }).success, false);
    }
  }
});

test("PKCE state is one-use and token exchange binds the exact redirect, resource and client", async () => {
  const { oauth, calls } = fixture();
  const begun = oauth.begin(approval, binding());
  const url = new URL(begun.authorizationUrl);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("resource"), approval.endpoint);
  const input = { state: url.searchParams.get("state")!, code: "fictional-code", redirectUri: approval.oauth!.redirectUri };
  const credential = await oauth.complete(approval, binding(), input, signal());
  assert.equal(createHash("sha256").update(calls[0]!.form.get("code_verifier")!).digest("base64url"), url.searchParams.get("code_challenge"));
  assert.equal(calls[0]!.form.get("redirect_uri"), approval.oauth!.redirectUri);
  assert.equal(calls[0]!.form.get("resource"), approval.endpoint);
  assert.equal(calls[0]!.form.get("client_id"), approval.oauth!.clientId);
  assert.equal(oauth.access(approval, binding()), "fictional-access");
  assert.equal(JSON.stringify(credential).includes("fictional-access"), false);
  await assert.rejects(oauth.complete(approval, binding(), input, signal()), /remote-denied/);
  assert.equal(calls.length, 1);
});

test("user, workspace, endpoint, redirect, permission revision and expired state substitutions fail before I/O", async t => {
  for (const patch of [
    { userId: "other-user" }, { workspaceId: "other-workspace" }, { endpoint: "https://other.example.com/mcp" },
    { evidenceRevision: "changed" }, { oauth: { ...approval.oauth!, redirectUri: "https://other.example.com/callback" } },
  ]) {
    const { oauth, start, calls } = fixture();
    const input = start();
    const changed: DiscoveryApproval = { ...approval, ...patch };
    await assert.rejects(oauth.complete(changed, binding(changed), input, signal()), /remote-denied/);
    assert.equal(calls.length, 0);
  }
  const { oauth, start, calls } = fixture();
  const input = start();
  await assert.rejects(oauth.complete(approval, binding(), { ...input, redirectUri: "https://other.example.com/callback" }, signal()), /remote-denied/);
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 300001);
  await assert.rejects(oauth.complete(approval, binding(), input, signal()), /remote-denied/);
  assert.equal(calls.length, 0);
});

test("refresh rotates references; revoked and substituted references cannot refresh or retrieve access", async t => {
  const { oauth, start, calls } = fixture();
  const credential = await oauth.complete(approval, binding(), start(), signal());
  await assert.rejects(oauth.refresh(approval, "other-binding", credential.credentialReference, signal()), /remote-denied/);
  const now = Date.now();
  t.mock.method(Date, "now", () => now + 61000);
  assert.throws(() => oauth.access(approval, binding()), /remote-denied/);
  const refreshed = await oauth.refresh(approval, binding(), credential.credentialReference, signal());
  assert.notEqual(refreshed.credentialReference, credential.credentialReference);
  assert.equal(calls[1]!.form.get("grant_type"), "refresh_token");
  await assert.rejects(oauth.refresh(approval, binding(), credential.credentialReference, signal()), /remote-denied/);
  const revoked = await oauth.revoke(approval, binding(), refreshed.credentialReference, signal());
  assert.deepEqual(revoked, { revoked: true, remoteRevoked: true });
  assert.equal(calls.filter(call => call.endpoint.endsWith("/revoke")).length, 2);
  assert.throws(() => oauth.access(approval, binding()), /remote-denied/);
  await assert.rejects(oauth.refresh(approval, binding(), refreshed.credentialReference, signal()), /remote-denied/);
});

test("provider refresh rejection and invalid or over-scoped token responses fail closed", async () => {
  for (const patch of [{ token_type: "MAC" }, { expires_in: 0 }, { scope: "metadata:read metadata:write" }, { access_token: "bad\nheader" }]) {
    const { oauth, start } = fixture(async () => reply(patch));
    await assert.rejects(oauth.complete(approval, binding(), start(), signal()), /remote-denied/);
    assert.throws(() => oauth.access(approval, binding()), /remote-denied/);
  }
  const { oauth, start } = fixture(async (_endpoint, form) => {
    if (form.get("grant_type") === "refresh_token") throw new Error("provider invalid_grant");
    return reply();
  });
  const credential = await oauth.complete(approval, binding(), start(), signal());
  await assert.rejects(oauth.refresh(approval, binding(), credential.credentialReference, signal()), /remote-denied/);
  assert.throws(() => oauth.access(approval, binding()), /remote-denied/);
});

test("local revocation survives a provider outage and in-flight refresh cannot resurrect a token", async () => {
  let release!: (value: Awaited<ReturnType<OAuthPost>>) => void;
  const { oauth, start } = fixture(async (endpoint, form) => {
    if (endpoint.endsWith("/revoke")) throw new Error("provider unavailable");
    if (form.get("grant_type") === "refresh_token") return new Promise(resolve => { release = resolve; });
    return reply();
  });
  const credential = await oauth.complete(approval, binding(), start(), signal());
  const refresh = oauth.refresh(approval, binding(), credential.credentialReference, signal());
  assert.deepEqual(await oauth.revoke(approval, binding(), credential.credentialReference, signal()), { revoked: true, remoteRevoked: false });
  release(reply());
  await assert.rejects(refresh, /remote-denied/);
  assert.throws(() => oauth.access(approval, binding()), /remote-denied/);
});
