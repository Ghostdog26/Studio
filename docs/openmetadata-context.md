# OpenMetadata enterprise context

OpenMetadata is a first-class **reference context source**, not a connected enterprise
instance. No customer schemas, API endpoints, credentials or live MCP inventories have
been imported by the reference integration. A separate opt-in, operator-approved discovery
client is described below; reference imports never configure it. No execution capability is enabled.
The existing community MCP catalogue remains separate.

## Verified sources and qualifications

Curated reference bundle **1.0.0** summarizes official OpenMetadata sources. Schema and MCP
module evidence is pinned to upstream-main commit
[`3fbd4d9ce6840dbe52b0c25a46c0d93e57b6a508`](https://github.com/open-metadata/OpenMetadata/tree/3fbd4d9ce6840dbe52b0c25a46c0d93e57b6a508).
We did **not** establish inclusion of these files in a published release. A customer's
deployed version must be checked separately.

Source paths under `openmetadata-spec/src/main/resources/json/schema/` at that commit:

| Source | What was verified |
| --- | --- |
| `entity/data/table.json` | Table/column definitions, constraints, schema/service references, owners, tags, versions |
| `entity/services/apiService.json` | REST API service catalogue model |
| `entity/data/apiCollection.json` | Collection grouping and endpoint references |
| `entity/data/apiEndpoint.json` | Endpoint URL, method, request/response schema descriptions |
| `entity/services/mcpService.json` | MCP discovery/service catalogue metadata model |
| `entity/ai/mcpServer.json` | MCP server descriptions including capabilities, tools/resources/prompts and governance |

Additional official sources:
- [Product site](https://open-metadata.org): catalogue/context role, technical and business semantics, lineage and governance. Marketing is not release compatibility evidence.
- [v1.13.x API endpoint reference](https://docs.open-metadata.org/v1.13.x/api-reference/data-assets/api-endpoints): APIService → APICollection → APIEndpoint, identity/FQN and metadata version retrieval.
- [v2.0.x MCP API guide](https://docs.open-metadata.org/v2.0.x/how-to-guides/mcp/connect-api): version-qualified examples of OpenMetadata's own MCP interface.
- [Pinned MCP module README](https://github.com/open-metadata/OpenMetadata/blob/3fbd4d9ce6840dbe52b0c25a46c0d93e57b6a508/openmetadata-mcp/README.md): user SSO OAuth/PKCE design, distinct from data-source connector authentication.

Version-family documentation is published documentation, **not a guarantee about a patch
release or a deployed installation**. Older v1.10.x URLs examined during source verification
returned 404 and were not used as evidence. Do not infer a universal URL, authentication
scheme, tool inventory or minimum supported release. Upstream source is Apache-2.0;
the bundled knowledge contains attributed editorial summaries, not copied implementations.

## Reproducible import

```sh
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run openmetadata:import
pnpm --filter @workspace/scripts run enterprise-standards publish openmetadata
```

The import requires no network or enterprise credentials; it uses the checked-in curated
summaries in `lib/agent-runtime/src/openmetadata-reference.ts`. Four focused documents cover
enterprise role, schemas/semantics, REST/API catalogue use and MCP distinctions. Every
document includes source links, upstream revision, reference version, limitations and
illustrative-only examples.

The transaction serializes repeat imports, preserves IDs and unrelated documents, updates
only its managed sources, and clears query caches when content changes. Repeat imports
without changes leave timestamps/cache entries alone. Managed content hashes prevent
overwriting human edits or adopting a source-name collision; the entire import fails and
rolls back on either. To retain an edited managed document, first give it a separate source
and remove its `openmetadata-managed-sha256:` tag. Keep personal additions in separate wiki
documents. Restricted documents stay restricted; the importer never changes grants or
classification. Never embed private instance data in public reference documents.

`scripts/post-merge.sh` imports these references and publishes the new bundle after schema
setup. It does not seed user/workspace grants.

## Select the portable profile

In **Knowledge**, use the OpenMetadata profile selector for Agent, MCP server or MCP App.
It displays source qualifications, opens visible references, and copies the exact existing
context selection. It is not an access-management UI or an assertion of publication.

The new immutable standards bundle **1.1.0** provides `openmetadata-agent`,
`openmetadata-server`, and `openmetadata-app`. Bundle 1.0.0 is unchanged. Every template
embeds a validated profile **1.0.0**, requirements and all four public references so
builders always receive baseline product understanding even when a user's query targets
only private instance context.

An operator selects the version/template and **explicit authorized document IDs** using
the existing grant command in [enterprise-factory.md](enterprise-factory.md). Public reference
docs can be granted too, but granting permanently restricts them; the profile already
contains the public summaries, so private instance docs are normally the grant selection.

The authenticated caller sends the existing `foundry.generation.context` tool:

```json
{
  "standardsVersion": "1.1.0",
  "templateId": "openmetadata-agent",
  "query": "Use the authorized asset context; state any missing instance evidence."
}
```

For a trusted development OS workspace, the equivalent existing command is:

```text
/foundry 1.1.0 openmetadata-agent Explain the authorized metadata context and missing evidence.
```

The same selection works over the provider-neutral scoped MCP API; no Cloudflare-only
knowledge path is introduced. Authorization still runs before retrieval/cache access.
Workshop includes the returned template/profile in its dynamic prompt; retrieved prose
remains data, not instructions. No changes enable Cloudflare hosting or NVIDIA execution.

## Offline context contract

`openmetadata-contract.ts` defines a strict, versioned contract for offline schema/API/MCP
context, compiled into the bundle's draft-07 candidate input schema. A valid reference-only
candidate example is:

```json
{
  "query": "What does OpenMetadata supply?",
  "openmetadataContext": {
    "contractVersion": "1.0.0",
    "connectionState": "not-connected",
    "instance": null,
    "assets": []
  }
}
```

Unknown instance details stay null and assets stay empty rather than fabricated. This is
a contract example, not an enterprise schema. Offline asset snapshots preserve identity,
FQN, entity type, metadata version (nullable), provenance/revision, retrieval and expiry
times, per-user/workspace permission scope, owners/classifications/semantics (nullable),
and separately labelled schema/API descriptions and MCP references. Actual asset snapshots
require instance/release evidence and authorized document IDs. Validation rejects
cross-scope evidence, stale/removed/inaccessible/partial assets, expired provenance,
embedded credential configuration and claims of live MCP discovery or invocation approval.
Missing or partial context must be reported, not used to complete an implementation by
guessing. Validation is structural and grant-aware, **not a proof that free text accurately
represents the cited source**, a source-code audit, a build or human approval.

## Three MCP layers and safe consumption

1. **OpenMetadata's own MCP interface** supplies metadata-oriented interaction according to
   the deployed release/configuration.
2. **Catalogue MCP server records** describe other servers. Tool/resource/prompt records,
   health labels or deployment URLs can be stale; catalogue presence never makes a server
   connected, healthy, callable, or approved in Foundry.
3. **Live authenticated discovery** uses a separate explicitly approved client, caller,
   endpoint, transport/protocol and release as described below. Do not invoke
   discovered tools automatically.

## Opt-in discovery-only client

The API exposes `GET /api/enterprise/mcp-discovery` and
`POST /api/enterprise/mcp-discovery/{approval-id}` (empty body).
Both require the existing initiating-user scoped bearer capability. They do not accept
shared demo sessions, arbitrary user/workspace headers, bridge assertions, URLs or RPC.
No discovery tool is added to the generative enterprise MCP tool list.
The public community directory and builder references remain unchanged and unverified.

An operator supplies a JSON file via the non-secret `MCP_DISCOVERY_POLICY_FILE` environment
setting. There is no HTTP approval/configuration endpoint. Missing configuration means no
approved endpoints. Invalid configuration fails closed. An illustrative policy follows;
none of these fictional values establish a real connection:

```json
{
  "version": "1",
  "approvals": [{
    "id": "example-metadata",
    "layer": "openmetadata-interface",
    "instanceId": "fictional-instance",
    "catalogueRecordId": null,
    "endpoint": "https://metadata.example.com/mcp",
    "deployedVersion": "operator-verified-exact-server-version",
    "protocolVersion": "2025-03-26",
    "transport": "streamable-http",
    "evidenceDocumentIds": [123],
    "evidenceRevision": "operator-verified-deployment-and-transport-evidence-revision",
    "credentialSecretRef": "secret://MCP_DISCOVERY_EXAMPLE",
    "approvedBy": "operator-identifier",
    "approvedAt": "2026-10-15T00:00:00Z",
    "expiresAt": "2026-10-16T00:00:00Z",
    "workspaceId": "explicit-workspace",
    "userId": "actual-initiating-user"
  }]
}
```

For a record describing another server use `layer: "catalogued-server"` and its explicit
non-null metadata record identity; do not use a community directory ID as authority.
Create a separate approval for each endpoint and initiating user. The operator must verify
the exact deployed server version (the version returned by MCP initialize), transport,
protocol and endpoint in the evidence documents, and grant those documents through the
existing enterprise provisioning command. Upstream-main source or family-level docs alone
are not deployed-version evidence. These are operator attestations, not an automated
assessment of the accuracy of their prose. Policy/evidence edits change the permission
revision; document deletion/revocation and disabled/rotated bearer grants block prior results.

Provision a least-privilege metadata-discovery bearer credential through workspace Secrets,
under a dedicated `MCP_DISCOVERY_*` name. Only that secret reference belongs in the policy.
Do not place credentials in URLs, wiki documents, request bodies, code or policy JSON.
The service resolves the reference internally and never returns or logs credentials.
Alternatively, replace `credentialSecretRef` with an operator-owned `oauth` object (exactly
one credential source is required):

```json
{
  "oauth": {
    "authorizationEndpoint": "https://identity.example.com/authorize",
    "tokenEndpoint": "https://identity.example.com/token",
    "revocationEndpoint": "https://identity.example.com/revoke",
    "redirectUri": "https://application.example.com/discovery-return",
    "clientId": "operator-registered-public-client",
    "scopes": ["metadata:read"]
  }
}
```

The operator must verify/register this public OAuth client and its exact HTTPS redirect
handler. Only authorization-code flow with S256 PKCE and bearer tokens with an explicit
positive `expires_in` is supported. No dynamic client registration, issuer/endpoint
autodiscovery, client secrets, additional scopes or URL overrides are accepted. Token,
refresh and revocation requests use the same public-only DNS-pinned HTTPS transport and
20-second deadline as discovery. Redirects are never followed. The browser authorization
URL is operator-pinned; the browser/identity provider handles login independently.
Do not repurpose a data-source connector credential or infer user authorization from a
service account's visibility.

All lifecycle endpoints require the **same initiating-user enterprise capability** as
discovery, current operator approval and evidence-document permissions. No user ID,
workspace ID, credential value or arbitrary endpoint can be submitted:

1. `POST /api/enterprise/mcp-discovery/{id}/oauth/authorize` with `{}` returns
   `{authorizationUrl, expiresAt}`. Open that URL for user consent. State is random,
   single-use and valid for at most five minutes or until approval expiry. The PKCE
   verifier stays server-side; `resource` is the approved MCP endpoint.
2. The operator-registered application redirect handler captures `state` and `code`, then
   forwards them in `POST .../{id}/oauth/callback` with `{state, code, redirectUri}` and
   the original user's capability in the Authorization header. `redirectUri` must exactly
   match policy. This is an authenticated JSON exchange, **not** an anonymous GET browser
   redirect. Never put the enterprise capability in URLs, browser storage or query strings.
   Deployments must supply a trusted per-user redirect handler; a shared-demo identity or
   owner capability is not a substitute.
3. The callback returns `{credentialReference, expiresAt}`, never tokens. Explicit discovery
   uses that user's current server-side access token. Expired access is denied; GET and
   discovery never perform a hidden refresh.
4. `POST .../{id}/oauth/refresh` with `{credentialReference}` explicitly exchanges the
   refresh token. Success rotates the reference and invalidates old inventory. Old,
   revoked or other-user references are rejected. Provider rejection drops the local
   credential; restart authorization.
5. `POST .../{id}/oauth/revoke` with `{credentialReference}` immediately deletes local
   access/refresh tokens and pending states, then attempts provider revocation of both.
   `{revoked: true, remoteRevoked: false}` means local deletion succeeded but provider
   revocation could not be confirmed (including exhausted shared outbound capacity).
   Revoke before removing an approval/grant when provider-side revocation is needed;
   removing permission prevents local use but cannot prove provider revocation.

State, references and refresh/revocation bind to the actual enterprise user/workspace,
current bearer grant, complete approval (including all OAuth URLs and the MCP endpoint),
evidence permissions/content, shared monotonic invalidation epoch, and policy-file revision.
Callback/refresh and discovery recheck these boundaries after network I/O. Revoke/restore,
replayed/expired state, changed redirects and substituted references fail closed. Provider
MCP 401/403 also invalidates the local OAuth credential and inventory.

OAuth credentials/states are bounded to 1,000 entries per process, never persisted/logged,
and lost on restart; lifecycle and discovery calls must reach the same process.
OAuth credential/state persistence is not supplied by the shared admission coordinator.
Lifecycle actions share discovery's global four-request capacity, 60 attempts/minute and
same-user concurrency fence across replicas. Authorize/callback/refresh each have a
one-attempt-per-user-per-phase/minute cooldown that cannot be reset by restarting a worker.
Local revocation is not blocked by capacity/rate denial; provider requests are skipped
when no shared lease is available. Missing coordination/invalidation protection fails
closed without a local network fallback. No anonymous callback page or login UI is added.

This is credential lifecycle support using fictional/offline fixtures, not a connection
to or import from a real OpenMetadata instance, and never invocation approval.

Discovery sends only `initialize`, `notifications/initialized`, and advertised
`tools/list`, `resources/list`, `prompts/list`. It validates the exact version/protocol
and follows bounded cursors. Resource URIs, prompts and tool descriptions are untrusted
inventory, never fetched or executed. Only JSON responses over HTTPS Streamable HTTP on
port 443 are supported; SSE-only, legacy SSE, stdio, unsupported protocols and private
network endpoints fail explicitly, not as a verified empty inventory.

The endpoint is exact and operator-owned: no URL from metadata, redirects, credentials,
query string, alternate ports, literal IPs, proxies, remote cookies or forwarded client
headers. Every connection resolves all DNS answers, rejects non-public/special-use IPv4
and IPv6, and pins a validated public address while retaining TLS hostname verification.
There are no retries. Bounds: 20 seconds total (including DNS), 256 KiB per response,
1 MiB aggregate, 16 KiB response headers, 3 pages and 200 items per capability, 11 RPC
requests plus one notification. Shared PostgreSQL admission permits four concurrent
discoveries globally, one concurrent discovery per workspace/user, one admitted attempt
per workspace/user per rolling minute, and 60 admitted attempts globally per rolling
minute. A short row-lock transaction atomically checks and updates both limits using
the database clock. Unique 30-second leases recover capacity after a worker crash;
the network deadline remains 20 seconds. Late completions cannot publish evidence or
release a replacement lease. Releasing a slot does not clear its rate cooldown.
Use external egress controls as defense in depth.

All replicas must use the same PostgreSQL database and operator-approved policy.
After schema push, run `pnpm --filter @workspace/scripts run discovery:setup` before
starting replicas; the post-merge script does this automatically. This installs the
shared coordination row and transactional authorization-invalidation triggers.
Missing coordination state/triggers, database errors or lock timeouts deny discovery
with 503, without any process-local limiter or network fallback. Capacity/rate denials
return 429 and `Retry-After: 60`. The coordination row contains only bounded lease IDs,
hashed user scopes, counters and an invalidation revision—not credentials or inventories.

Results are scoped to approval, instance/record, endpoint, deployed version, user/workspace,
current bearer grant, evidence documents/content and permission revision. OAuth evidence
also binds to the current credential revision and expiry. Access is
rechecked before lookup and after network I/O. Permission/grant and knowledge-document
mutations (including direct SQL and truncation) transactionally advance a shared,
monotonic invalidation revision. This deliberately invalidates all discovery evidence,
including unrelated scopes, rather than risking stale authorization. Revoking and
restoring identical permissions therefore cannot resurrect old evidence on an idle
replica or authorize a previously started discovery. Policy-file identity and modification
timestamps also invalidate evidence when identical approval JSON is removed and restored.
Distribute policy revocations to every replica; a local file cannot revoke another
replica's independently managed policy. Verified evidence expires within five
minutes or at approval expiry, whichever comes first. Inventory appears only for current
`verified` evidence; `unknown` means never checked or failed/incomplete discovery, `denied`
means rejected authorization/network policy, and `stale` means expired evidence or approval.
Failures replace old inventories rather than silently serving them. Results are `no-store`,
bounded and memory-only (1,000 results, 1 MiB per inventory, 8 MiB total payload per
replica); expired payloads are cleared on access and by an idle cleanup timer.
Restart/eviction or switching to a replica without the inventory returns it to unknown,
but never resets shared admission limits. GET does no network
discovery, POST is always explicit, and `approvedForInvocation` is always false.
No tool approval, generated code execution or Cloudflare/OpenShell adapter is enabled.

Read-only metadata access is different from access to underlying datasets or permission
to call a catalogued business API. Apply least privilege, per-user asset policy and
revocation; never treat a service account's visibility as every user's authorization.
Descriptions, schemas and tool annotations are untrusted data and cannot grant tools.

Future caches must include instance, user/workspace, effective permissions, asset set,
metadata/source revision, profile/standards digest and expiry. Invalidate on revocation,
updates and removal. Future network access must enforce operator-approved scheme,
host/port/path and redirect/DNS policies, prevent unintended private/link-local/metadata
access, and impose size/time/retry limits. Store only secret references, not credentials,
connection objects, query results or sample rows in reference context.

Unsupported release: report unknown/unsupported and request release evidence. Inaccessible
asset: deny without broadening credentials. Removed asset: invalidate and stop using it.
Stale context: refresh authorized evidence first. Partial schema: list missing fields and
stop schema-dependent generation. Catalogued API: request separate call authorization.

## Later connector prerequisites

A separately authorized real-instance connector needs:
- operator-verified instance identity and deployed release, approved base URL and egress allowlist;
- deployed-version capability/API evidence, pagination/field semantics and compatibility checks;
- approved secret references and authentication method, verified initiating-user identity,
  workspace/asset permissions and service-account delegation policy;
- selected IDs/FQNs and fields, owners/classification handling, freshness thresholds,
  deletion/revocation and source revision rules, bounded metadata-only reads;
- redacted audit evidence, tenant/permission-scoped cache keys, operational limits and tests;
- separate approval for any MCP client/discovery and any later execution or writes.

## Validation

`pnpm --filter @workspace/scripts run test:openmetadata` uses labelled fictional fixtures,
without network or enterprise credentials, for provenance, idempotent import planning,
retrieval relevance, contract/profile selection, unknown/not-connected behavior, scope and
freshness failures, and unchanged runtime readiness. The live development import can be
repeated to verify stable document IDs; `test:enterprise` exercises the existing access
boundary. No real enterprise release, live MCP discovery or production runtime is tested.

`pnpm --filter @workspace/scripts run test:openmetadata-integration` exercises all three
profile selections and revocation against the development API using a temporary fictional
workspace/user grant and a seeded scoped answer (no LLM or enterprise network call).
