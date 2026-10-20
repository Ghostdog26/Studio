# Control Plane

**An enterprise knowledge workspace and AI-assisted factory for standardized agents, MCP servers, and MCP Apps.**

Control Plane helps teams turn shared knowledge, approved capabilities, and engineering standards into reusable software definitions and reviewable source packages. Instead of asking a development team to build every integration or assistant independently, it provides a common place to discover an approach, describe the intended behavior, select standards, and generate an implementation.

The operating model is:

> Bring the right knowledge and standards together → let AI assist with creation → validate the implementation → have a human review and approve it → deploy a fixed, versioned release.

The repository implements the knowledge workspace, catalogue, guided builder, saved definitions, source-package generation, and scoped enterprise context interfaces. **It does not yet implement the complete approval, isolated verification, or deployment pipeline.** Cloudflare and NVIDIA OpenShell are runtime targets, not connected execution services in the current application.

**Proposed MOSSI direction:** The [MOSSI capability-builder brief](docs/mossi-capability-builder-brief.md) describes a narrower integration: reuse internal capabilities first, review the contract before code generation, and contribute through the existing monorepo review and delivery pipeline. It explains what to keep, adapt, and retire. That proposal has not changed the implementation documented below.

## Contents

- [What this is](#what-this-is)
- [Who it is for](#who-it-is-for)
- [What you can do today](#what-you-can-do-today)
- [How it works](#how-it-works)
- [A typical workflow](#a-typical-workflow)
- [Standards and language support](#standards-and-language-support)
- [Cloudflare OS and NVIDIA OpenShell](#cloudflare-os-and-nvidia-openshell)
- [Security and enterprise knowledge boundaries](#security-and-enterprise-knowledge-boundaries)
- [Repository structure](#repository-structure)
- [Development and operation](#development-and-operation)
- [Current limits and production requirements](#current-limits-and-production-requirements)
- [Further documentation](#further-documentation)

## What this is

Control Plane combines three related functions.

### 1. An enterprise second brain

A shared knowledge repository stores reference material, operating guidance, standards, and reusable context. Users can ask questions over that material and receive answers grounded in retrieved excerpts, with citations back to the source documents.

The important distinction is that knowledge is not just a collection of files for a model to browse. It is context that can inform how tools and agents should be built: what terminology means, which schemas apply, what a workflow is allowed to do, and which requirements a generated implementation must meet.

The current retrieval implementation uses lexical ranking and a separate reranking pass. It is **not an embedding-based vector search system**. Query normalization and a PostgreSQL-backed response cache reduce repeated answer generation.

### 2. An agent factory

Users can create reusable agent definitions containing instructions, input JSON Schema, model selection, and runtime intent. These definitions provide a consistent starting point instead of treating each assistant as an unrelated prompt.

A saved agent is a definition, not proof of a running or deployed agent. Runtime execution and release governance are separate concerns.

### 3. An MCP server and app builder

The Model Context Protocol, or MCP, standardizes how AI applications connect to tools, resources, and prompts. An MCP server exposes capabilities through that protocol. MCP Apps add an interactive interface associated with those capabilities inside a supporting host.

Control Plane helps users:

- Find existing community server references that relate to their goal.
- Understand relevant official MCP specification and SDK guidance.
- Select a supported language and compatible runtime target.
- Draft and edit a tool specification and its input schema.
- Save a reusable component definition.
- Download source packages with standards references, provenance, and review requirements.

The catalogue supplies ideas and source context. It does not automatically install third-party servers, authorize access to enterprise systems, or certify that a referenced capability works.

## Who it is for

| Audience | What Control Plane helps them do |
| --- | --- |
| Enterprise platform teams | Establish reusable contracts, templates, and review expectations across many integrations. |
| Developers | Start from a saved definition and official SDK guidance rather than repeatedly assembling the same project structure. |
| Internal tool builders | Describe a business or technical goal, inspect relevant references, and prepare a reviewable implementation draft. |
| Knowledge and data teams | Make reference material and approved context available to grounded answers and scoped creation workflows. |
| Security and governance reviewers | Inspect requested capabilities, schemas, source provenance, and required evidence before anything is released. |

Example uses include preparing a developer-tool MCP server, defining a research assistant over approved documents, or drafting an interface to an enterprise data platform. A generated project still needs the actual service configuration, permissions, credentials, testing, and approval appropriate to that use case.

## What you can do today

| Area | Available behavior | Important boundary |
| --- | --- | --- |
| Overview | Inspect workspace activity, saved definitions, knowledge statistics, and runtime readiness. | Readiness is reported explicitly; an unconnected adapter is not a running service. |
| Knowledge | Manage shared wiki documents and ask cited questions with retrieval, reranking, and cached responses. | Shared/demo content is not an authenticated enterprise knowledge portal. |
| MCP catalogue | Search imported community references, inspect source context, and begin a guided build. | Entries remain references, not approved or installed integrations. |
| Guided builder | Match a goal to catalogue entries, choose an approach, draft a specification, edit its schema, save it, and generate source. | Matching is deterministic catalogue retrieval; AI generation produces drafts, not verified releases. |
| Agents | Create and maintain structured agent definitions. | Saving does not start execution. |
| MCP components | Maintain server/app definitions and generate compatible source packages. | Package generation does not run installers, build the project, or deploy it. |
| Enterprise context | Publish versioned standards and explicitly grant documents and tools to a workspace/user pair. | This scoped interface does not supply a complete enterprise identity or approval system. |
| OpenMetadata context | Use version-qualified reference knowledge and portable profile templates. | A real enterprise OpenMetadata instance is not connected by importing its documentation. |

The main interface routes are `/`, `/knowledge`, `/catalogue`, `/builder`, `/agents`, and `/mcp`.

## How it works

### Architecture

```text
                         Control Plane web workspace
                    Knowledge · Catalogue · Builder · Agents
                                       |
                                  Express API
                                       |
             +-------------------------+-------------------------+
             |                         |                         |
      PostgreSQL records       Retrieval + reranking     Definition/package
      and query history        + answer generation      generation services
             |                         |                         |
      Wiki documents,          Cited excerpts and        Saved JSON Schemas,
      definitions, grants,     scoped response cache     official SDK references,
      standards and cache                               category standards
                                                                 |
                                                      Reviewable source archive
                                                                 |
                                               Verification, approval, deployment
                                                      (separate release work)

 Runtime boundary:
   Cloudflare OS/workerd-compatible targets  |  NVIDIA OpenShell-compatible targets
   Shared adapter contracts exist; live execution adapters are not connected.
```

The repository is a pnpm monorepo. The React/Vite workspace and Express API share generated API contracts. PostgreSQL, accessed through Drizzle, is the source of truth for persisted workspace data. JSON Schema describes the structured inputs expected by definitions and generation contracts.

### Knowledge retrieval and response caching

When a user asks a knowledge question:

1. The service normalizes the query and determines the applicable knowledge scope.
2. It checks for an eligible cached response.
3. On a cache miss, it selects candidate documents and reranks them using lexical signals such as title, tags, phrases, and term coverage.
4. It sends selected excerpts to the language model as untrusted source data, with instructions to answer only from that context and cite sources.
5. It stores the answer, source references, and query history. Cached responses have a ten-minute time-to-live.

Knowledge edits invalidate cached answers. Enterprise cache identities also incorporate the workspace, user, allowed documents, and standards digest; authorization is checked before scoped tool and cache access. A cache is an optimization, not an alternative permission system.

Citations make an answer inspectable. They do not guarantee that an imported document is correct, current, or appropriate for a particular enterprise.

### Catalogue-backed discovery

The community catalogue comes from [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers). Imported metadata is available both as a browsable directory and as linked knowledge material.

The builder ranks actual catalogue records rather than asking a model to invent a list of servers. A selected reference retains its source URL, revision, and applicable standards context. No match is a valid result.

Catalogue discovery should not be confused with authenticated live discovery. A directory description is not evidence that a remote server is reachable, that a user may invoke its tools, or that its advertised capabilities have been verified.

### From a definition to a package

A specification records the intended tool or component, including its name, description, and input schema. After the user explicitly saves that specification, generation uses the persisted definition together with official MCP references and applicable standards.

Language-aware AI server packages include native-language source, build/dependency configuration, generated test source, definition and protocol schemas, source provenance, and review requirements. A manifest records the selected language/target, source revisions, digest, and unbuilt/undeployed status.

Structural checks reject problems such as unsafe archive paths, duplicate or reserved files, missing required material, oversized output, and mismatched language declarations. These checks do **not** establish that generated code compiles, that its tests are meaningful, or that it safely implements the protocol.

### Why standardization matters

The goal is to reuse more than generated code. Teams should also reuse:

- Input and output contracts.
- Official protocol and SDK guidance.
- Versioned templates and domain-specific requirements.
- Permission and knowledge-access constraints.
- Provenance and review evidence.
- A consistent distinction between a draft, a saved definition, and a released implementation.

This reduces repeated setup and makes differences between integrations easier to review. It does not remove the need for engineering judgment.

## A typical workflow

Suppose a user asks: **“Let’s build a developer MCP server tool today. What can you help me with?”**

1. **Describe the goal.** Open the guided builder and explain the intended capability.
2. **Explore real references.** Review matching catalogue entries and select a useful starting point.
3. **Choose the contract.** Select the SDK language, compatible target, transport, data source, and access requirements. Do not put credentials into the request.
4. **Draft with AI.** Generate a specification grounded in official guidance and the selected standards.
5. **Review and edit.** Check the tool description and input schema before explicitly saving the definition.
6. **Generate source.** Download a package from that saved definition and inspect its manifest and required-review document.
7. **Verify outside generation.** Resolve dependencies on a compatible build host; compile, test protocol behavior, check permissions, audit dependencies, and validate failure cases.
8. **Approve and deploy a fixed release.** This is the intended release process, not an implemented one-click pipeline in the current workspace.

For scoped enterprise creation, an operator must first publish the chosen standards and grant the exact documents and tools to the intended workspace/user pair. The public builder must not be treated as permission to use private enterprise knowledge.

“Deterministic operation” means deploying fixed source, configuration, and locked dependencies rather than regenerating an implementation on each request. **An approved agent that calls an LLM can still produce probabilistic answers.**

## Standards and language support

Control Plane imports selected specification material and reference snapshots from the official [Model Context Protocol organization](https://github.com/modelcontextprotocol). The snapshots are pinned and checksummed; they are not full SDK installations.

Supported server-generation language choices are:

**TypeScript, JavaScript, Python, Go, C#, Rust, Ruby, Java, Swift, PHP, and Kotlin.**

JavaScript and TypeScript share the official TypeScript SDK, so these eleven choices use ten official SDK repositories. Unsupported languages fail explicitly rather than silently falling back to TypeScript.

| Package target | Language boundary |
| --- | --- |
| Cloudflare OS/workerd-compatible | JavaScript or TypeScript; the guided Cloudflare path requires Streamable HTTP. |
| Native/OCI-compatible, including an appropriately configured OpenShell host | Supported native-language server projects, subject to the host and SDK requirements. |
| MCP Apps | The existing TypeScript package path. |

Additional review rigor applies to these twelve catalogue areas:

- Cloud Platforms
- Code Execution
- Coding Agents
- Command Line
- Databases
- Data Platforms
- Developer Tools
- Data Science Tools
- Data Visualization
- Knowledge & Memory
- Product Management
- Search & Data Extraction

These profiles add domain-specific controls, required evidence, and acceptance expectations. Their presence does not mean a catalogue entry or generated package has passed them.

## Cloudflare OS and NVIDIA OpenShell

### Cloudflare OS

The actual upstream [Cloudflare OS](https://github.com/cloudflare/cloudflare-os) source is vendored under `vendor/cloudflare-os`, with provenance recorded separately. It contributes upstream workspace, gadget, blueprint, and Gatekeeper concepts, plus a scoped bridge to Control Plane knowledge and generation standards.

**The default `/cloudflare-os/` endpoint is deliberately non-executing.** It serves a hosting-status page, not a production OS runtime. Process liveness and runtime readiness are separate: `/cloudflare-os/livez` reports liveness, while `/cloudflare-os/healthz` returns `503` when no supported runtime is ready.

An explicitly enabled Wrangler/workerd preview exists for trusted development with test data. It is not production hosting and must not receive production knowledge, credentials, untrusted users, or untrusted code. Starting that preview does not connect the Control Plane Cloudflare execution adapter.

### NVIDIA OpenShell

The project defines an OpenShell runtime adapter contract and can prepare compatible source packages. **NVIDIA OpenShell is not installed or running in this repository's environment, and no gateway is connected.**

### Portability and deployment intent

The shared contracts are intended to keep definitions independent of a single execution provider. Portability does not mean every SDK language runs inside workerd, or that the two providers have identical isolation and networking behavior.

A compact, containerized service is a deployment goal, not a delivered topology in this repository. Vendored source and generated archives do not eliminate dependency installation, model access, PostgreSQL, runtime infrastructure, identity configuration, or external service permissions.

See [Cloudflare OS hosting](docs/cloudflare-os-replit.md) before enabling any development execution.

## Security and enterprise knowledge boundaries

The shared workspace and the scoped enterprise interface serve different purposes.

- **Shared/demo knowledge:** accessible through the public workspace API. Do not place confidential enterprise content here.
- **Restricted knowledge:** ingested through the operator-controlled enterprise path and granted explicitly to a workspace/user pair.
- **Versioned standards:** published with an immutable version/digest relationship. A conflicting change requires a new version.
- **Capabilities:** scoped to specific tools and documents; workspace ownership does not automatically authorize collaborators.
- **Revocation:** removes access without making restricted documents public again.
- **Generated packages:** require separately managed inbound access credentials and backend capabilities where the scoped knowledge path is used.

Keep credentials, identity-bearing grant files, and private capability files out of Git. Use the environment's secrets mechanism, not prompts, source files, schemas, or wiki documents, to supply credentials.

The scoped boundary does not turn the public application into a fully authenticated enterprise product. Enterprise SSO, end-to-end tenant isolation, immutable release storage, approval enforcement, and deployment orchestration require additional work. Current AI planning and generation are development-only until an authenticated production gateway is implemented.

For the exact grant, transport, cache, and revocation model, read [Enterprise factory](docs/enterprise-factory.md).

## Repository structure

```text
artifacts/
  agent-foundry/             Control Plane React/Vite workspace
  api-server/                Express API, generation, retrieval and import tooling
  control-plane-overview/    Original short product video
  control-plane-ui-tour/     Narrated UI walkthrough
  mockup-sandbox/            Design/component previews
lib/
  agent-runtime/            Runtime contracts and enterprise standards/context
  api-spec/                 OpenAPI source of truth
  api-client-react/         Generated client hooks
  db/                       PostgreSQL schema and Drizzle access
scripts/
  cloudflare-os/            Hosting policy, preparation and status/preview runners
  src/                      Standards/grant administration and focused checks
vendor/
  cloudflare-os/            Upstream Cloudflare OS source
  mcp-official/             Pinned official MCP reference snapshots
docs/                       Detailed implementation and operating guides
```

The `agent-foundry` directory, `@workspace/agent-foundry` package, and `FOUNDRY_*` settings retain their original names for compatibility. The product's display name is **Control Plane**.

## Development and operation

### Prerequisites

- Node.js 24 and pnpm 10, matching the workspace tooling.
- A PostgreSQL database.
- `DATABASE_URL` configured securely for the API and database tooling.
- `SESSION_SECRET` for the server-side security features that use it.
- Model access for knowledge answers and AI drafting. The current implementation uses the OpenAI-compatible Replit AI integration settings, including `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`.
- Service-specific `PORT` settings and the web artifact's `BASE_PATH`.

A source checkout alone is not an offline, dependency-free installation. Model-backed operations require a working model service; imported reference sources do not supply one.

### Install and prepare a development database

```sh
pnpm install --frozen-lockfile

# Development database only: review the proposed schema changes before applying.
pnpm --filter @workspace/db run push
```

The schema command changes the configured database. Check that `DATABASE_URL` points to the intended development database; do not use it as an automatic production migration procedure.

### Run the application

The existing workspace has separate managed workflows for the API, web interface, and Cloudflare OS status service. Their commands are:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/agent-foundry run dev
pnpm --filter @workspace/scripts run cloudflare-os:serve
```

Run each service in its configured workflow with its own port. The web interface uses `/`; the Cloudflare OS status service uses `/cloudflare-os/`. Outside the managed workspace, equivalent routing between the frontend and API must be configured; starting Vite alone does not provide the backend.

The API development command builds and then starts the server. Restart the API after backend edits or source-reference imports. Vite handles frontend development updates.

### Refresh reference knowledge

These commands update reference snapshots and/or imported knowledge records; they are not read-only checks:

```sh
pnpm --filter @workspace/api-server run catalogue:import
pnpm --filter @workspace/api-server run mcp:official-import
pnpm --filter @workspace/api-server run openmetadata:import
```

Follow the corresponding guides before refreshing sources, and restart the API afterward. Imports do not install catalogue servers or connect an enterprise OpenMetadata instance.

### Publish standards and administer grants

```sh
# Publish bundled enterprise standards.
pnpm --filter @workspace/scripts run enterprise-standards publish

# Publish the OpenMetadata reference standards.
pnpm --filter @workspace/scripts run enterprise-standards publish openmetadata
```

Restricted document ingestion, explicit grants, capability files, and revocation require the procedures in [Enterprise factory](docs/enterprise-factory.md). Do not substitute a broad default grant for that setup.

### Validation commands

```sh
pnpm run typecheck
pnpm run build

pnpm --filter @workspace/api-server run catalogue:test
pnpm --filter @workspace/api-server run mcp:languages-test
pnpm --filter @workspace/scripts run test:branding
pnpm --filter @workspace/scripts run test:enterprise
pnpm --filter @workspace/scripts run test:mcp-discovery
pnpm --filter @workspace/scripts run test:openmetadata
pnpm --filter @workspace/scripts run cloudflare-os:test

# Regenerate shared API hooks and validators after changing the OpenAPI spec.
pnpm --filter @workspace/api-spec run codegen
```

Some integration checks require a configured database and services. The root build/typecheck includes the video artifacts as well as the main application. Listing these commands is not a claim that the entire suite currently passes.

`cloudflare-os:production-check` is a separate hosting gate and deliberately fails while production blockers remain; it is not a command that enables production execution.

## Current limits and production requirements

Before using this as an enterprise production service, account for these boundaries:

1. **Generated code is unverified.** Compilation, protocol conformance, dependency security, schema behavior, and authorization tests must run in a suitable isolated build environment.
2. **Saving is not approval.** There is no complete human-approval gate or immutable release registry.
3. **Runtime adapters are disconnected.** Cloudflare OS production hosting is blocked, and OpenShell is not installed or connected.
4. **The public workspace is not enterprise SSO.** Production identity, authorization, and tenant-isolation requirements need explicit implementation and verification.
5. **References are not connections.** Community catalogue imports, official SDK snapshots, and OpenMetadata documentation do not grant live access to external systems.
6. **Multi-user collaboration is not complete governance.** Shared data and workspace/user-scoped interfaces are useful building blocks, not a finished multiplayer runtime or enterprise permission system.
7. **Containers are not supplied as a turnkey deployment.** A production packaging, networking, persistence, secrets, and runtime topology still needs to be established.

The useful boundary today is a knowledge-backed, standards-aware creation workspace that produces inspectable definitions and source packages. The intended next layer is verified, approved, versioned deployment—not autonomous release of unreviewed generated code.

## Further documentation

- [Proposed MOSSI capability-builder product and architecture brief](docs/mossi-capability-builder-brief.md)
- [Enterprise factory and scoped creation](docs/enterprise-factory.md)
- [Official MCP sources and language-aware generation](docs/official-mcp-builder.md)
- [MCP catalogue, provenance, and import behavior](docs/mcp-catalogue.md)
- [Cloudflare OS hosting and development safety gate](docs/cloudflare-os-replit.md)
- [OpenMetadata reference context and connector prerequisites](docs/openmetadata-context.md)
- [Project operating notes](replit.md)

Upstream projects retain their own licenses. Review the vendored/source-specific license material and the [awesome-mcp-servers attribution](docs/third-party/awesome-mcp-servers-LICENSE.txt) before redistributing source or generated packages.
