# OpenMetadata enterprise context

OpenMetadata is a first-class **reference context source**, not a connected enterprise
instance. No customer schemas, API endpoints, credentials or live MCP inventories have
been imported. No network client or execution capability is enabled by this integration.
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
3. **Live authenticated discovery** must later use an explicitly approved client, caller,
   endpoint, transport/protocol and release. It is not implemented here. Do not invoke
   discovered tools automatically.

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
