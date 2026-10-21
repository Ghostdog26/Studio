# Enterprise factory: intended operating model

> **MOSSI Studio refactor:** the capability is now MOSSI Studio. Existing scoped context interfaces described below remain prototype infrastructure, not MOSSI's authoritative identity, standards, or second-brain services. The target handoff is the existing repository review/CI/delivery pipeline, not a new builder-owned release system. Standalone public planning and source downloads are blocked. See the [Studio brief](mossi-capability-builder-brief.md).

Control Plane brings enterprise knowledge, governed capability definitions, and standards together for reviewable AI delivery. It produces standardized MCP servers, MCP Apps, and agents for enterprise developers and users—not a requirement for a development team to hand-build every instance. Generation does not imply approval or a connected runtime.

OpenMetadata's portable reference profile uses this same scoped standards/context boundary.
See [OpenMetadata enterprise context](openmetadata-context.md) for standards 1.1.0 selection,
version-qualified sources, offline context contracts and later connector prerequisites.

## Product workflow

1. **Knowledge and standards:** supply approved company context, JSON Schemas, reusable templates, access policies, and deployment constraints.
2. **AI-assisted creation:** generate an implementation against those contracts in a sandbox. Generation is not approval.
3. **Validation:** build and test the implementation; check schema conformance, permissions, dependencies, and behavior.
4. **Human review and approval:** review the exact source, configuration, permissions, and test evidence. Changes invalidate approval.
5. **Deployment assistance:** AI may help prepare deployment, but it must use the approved, versioned build.
6. **Deterministic operation:** deployed software executes the approved implementation rather than regenerating code for each request.

Deterministic deployment means fixed source, configuration, and locked dependencies. An agent that calls an LLM still has probabilistic outputs; an approved build cannot make LLM responses deterministic.

## Current integration boundary

- Control Plane retains its PostgreSQL-backed definitions, knowledge queries, caching, and MCP package builder.
- The actual Apache-2.0 Cloudflare OS source is vendored separately, with its provenance recorded in `scripts/cloudflare-os/source.json`.
- Cloudflare OS contributes its upstream agent workspace, gadgets, blueprints, and Gatekeeper capability model.
- Its default Replit endpoint is a non-executing hosting status page. The upstream Wrangler/workerd development stack requires explicit trusted-preview opt-in; production hosting remains blocked. See `docs/cloudflare-os-replit.md`.
- Cloudflare OS creation can now consume Control Plane's scoped wiki answers and pinned generation standards through the enterprise Gatekeeper/MCP bridge described below. This does not connect a Cloudflare execution/deployment adapter.
- Approval enforcement, immutable release storage, deployment orchestration, and enterprise identity integration are not implemented by this import.
- NVIDIA OpenShell is not installed or running.

## Scoped enterprise creation

The integration does **not** bypass the hosting safety gate. The default `/cloudflare-os/`
endpoint stays non-executing. Test the workflow only in the explicit unsafe trusted-development
preview using non-sensitive wiki documents and a narrow test grant. This preview is not suitable
for production knowledge, credentials, or untrusted users/code. A future verified hosted OS can
use the same scoped interface without changing the generation inputs.

1. Apply the additive development schema with `pnpm --filter @workspace/db run push`.
2. Publish the bundled standards: `pnpm --filter @workspace/scripts run enterprise-standards publish`.
   To publish your own version, append a JSON file matching `standardSchema` in
   `lib/agent-runtime/src/enterprise-standards.ts`. JSON Schemas use draft-07 and are compiled
   before publication. Versions are insert-only: a conflicting digest requires a new version.
3. Add enterprise wiki content **without passing it through the shared public wiki API**:
   `pnpm --filter @workspace/scripts run enterprise-standards wiki /path/to/document.json`.
   The private file contains `title`, `content`, optional `source` and `tags`; add `id` to update
   an existing restricted document. New documents are restricted immediately, before any grant.
   An operator then prepares a grant JSON file with **explicit** `workspaceId` (Cloudflare OS's workspace
   Durable Object ID), `userId` (the authenticated OS user identifier), `standardsVersion`,
   `templateId`, `documentIds`, and `permittedTools`. No wildcard or enterprise-wide grants exist.
   Obtain the workspace ID from its workspace URL/DO registry and the user identifier from the
   authenticated OS account, not a display name. A workspace owner grant does not grant collaborators.
   Example shape (replace all identifiers with actual authorized values):

   ```json
   {
     "workspaceId": "explicit-workspace-do-id",
     "userId": "explicit-authenticated-user-id",
     "standardsVersion": "1.0.0",
     "templateId": "grounded-agent",
     "documentIds": [1, 2],
     "permittedTools": ["foundry.generation.context", "foundry.generation.validate", "foundry.knowledge.query"]
   }
   ```

4. Run `pnpm --filter @workspace/scripts run enterprise-standards grant /path/to/grant.json`.
   This atomically replaces the document/tool grant and pins the selected version/template.
   Granting an existing shared wiki document **permanently removes it from the public wiki,
   public query retrieval, overview, and public edit/delete routes**. Revocation does not publish it
   again. Previously public content cannot be made retroactively secret from past readers.
   For a standalone generated MCP package, append a **new private token-file path**. The command
   creates a random capability file with mode 0600, never prints its value, and stores only its
   hash in Postgres. Transfer it through your runtime's secret workflow as `FOUNDRY_API_TOKEN`.
   Keep grant files with identity details and token files outside Git.
5. For the trusted development preview, create a **test-only** workspace/user grant and append
   a private token-file path to the grant command. Start the preview explicitly with
   `pnpm --filter @workspace/scripts run cloudflare-os:preview --foundry-capability-file /path/to/private-token`.
   Do not run this alongside the managed status service on the same port; use your configured
   preview workflow/port. No global knowledge bridge credential is automatically inherited.
   In that Cloudflare OS workspace's existing AI chat, send:

   ```
   /foundry 1.0.0 grounded-agent Create an assistant for our approved incident response process.
   ```

   Other bundled template IDs: `knowledge-server` and `knowledge-app`. Regrant with the desired
   template/version before selecting it. The current authenticated human initiator and current
   workspace DO ID are captured server-side. The builder cannot choose either in tool arguments.
   Ordinary chats remain unchanged. Gadget-initiated enterprise creation is denied.
6. Workshop fetches `foundry.generation.context` **before the model call** and places the selected
   schemas, template source files, permitted runtime tools, validation rules, digest, and cited wiki
   answer into the dynamic (workspace-salted) prompt section. It exposes
   `validateEnterpriseCandidate` to check input/output examples, citations, declared tool names,
   safe relative source paths, file limits, and obvious embedded credentials. Validation rechecks
   the live grant and pinned digest. Errors stop creation context loading; they never retry via
   the legacy wiki API. Retrieved prose is explicitly marked as data, not trusted instructions.
7. Revoke immediately with `pnpm --filter @workspace/scripts run enterprise-standards revoke /path/to/identity.json`
   (`workspaceId` and `userId` only). Regranting rotates any package token. Revoked credentials
   cannot use cached answers; authorization is checked before every tool/cache lookup.

### Boundary and caching

`POST /api/enterprise/mcp` implements stateless JSON MCP initialize, tools/list, and tools/call.
Cloudflare OS uses a server-only scoped capability in `gatekeeper-context/src/foundry.ts`.
For the explicit trusted preview, Workshop receives only a revocable token bound to one test
workspace/user pair. Its MCP envelope asserts the server-captured workspace and initiating user;
the API requires both to match the token's grant. Other users/workspaces cannot borrow that token.
The preview host never automatically derives a global bridge key from `SESSION_SECRET`.

A separately trusted server can alternatively use `FOUNDRY_BRIDGE_KEY`, derived with HMAC-SHA256
from `SESSION_SECRET` and the domain string `foundry-cloudflare-knowledge-v1`. Its HMAC assertion
covers workspace ID, authenticated user ID, timestamp and the entire tool request. Assertions
expire after 60 seconds; HTTPS is required off loopback and redirects are refused. This is a
trusted single-installation server boundary, not federated enterprise SSO or a browser-accessible
signing service. Generated gadgets never receive either transport credential.
The dev runner places explicitly supplied transport credentials in its ignored, mode-0600 backend
`.dev.vars` file so Wrangler redacts their values. Stale managed credentials are removed when no
longer supplied. Other existing secret entries are preserved. Restrict workspace filesystem access
and never publish these files.

Standalone generated MCP packages send a bearer capability to the same endpoint. Scope comes
from the matching database grant, never from request-supplied IDs. Both transports enforce
workspace/user, tool, document, and pinned standards selection at the boundary.
The generated Cloudflare and OpenShell network entrypoints also require an independent
`MCP_ACCESS_TOKEN` (a random secret of at least 32 characters). Anonymous/invalid clients are
denied before the MCP handler runs; absent access configuration fails closed with 503.
Only clients authorized for the server's granted knowledge may receive this inbound credential.
It cannot equal the backend Control Plane capability. This explicit shared-client policy is not
per-user SSO; replace it with verified enterprise caller identity where that is required.

Existing lexical retrieval, reranking, query history, and ten-minute TTL are reused. Enterprise
cache hashes additionally include workspace ID, user ID, allowed document IDs, and standards
digest. Knowledge edits still invalidate the cache. Grant changes cannot reuse a broader cache.
The legacy shared Control Plane wiki API continues to serve public/demo documents, but an enforced
visibility filter excludes restricted or ever-granted enterprise documents from public listing,
retrieval, overview, editing, and deletion. Public cache hits recheck source visibility, including
entries computed before a grant. The operator grant command also invalidates previous caches.
Scoped query history is tagged with workspace/user identity and is excluded from public overview
counts and activity. Generated agents use only the scoped interface, not the shared wiki.

### Limits

These are generation inputs and contract checks, not a source-code security proof, build/test
runner, human approval, or deployment gate. Requested-tool manifests are checked, but arbitrary
source behavior must still be inspected and sandboxed before execution. Do not treat a valid
candidate as approved or production-ready. Existing Cloudflare OS model-provider configuration
is still required for actual AI generation. No grants are automatically seeded for real users
or documents; an operator must explicitly authorize them.
