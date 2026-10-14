# Agent Foundry

Agent Foundry is a shared enterprise control plane for grounded knowledge retrieval, standardized agent definitions, and MCP server/app contracts that can target Cloudflare or NVIDIA OpenShell.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/agent-foundry` — React workspace for knowledge, agents, MCP components, and runtime status
- `artifacts/api-server/src/routes/foundry.ts` — workspace API, retrieval/reranking, and response cache
- `lib/api-spec/openapi.yaml` — source of truth for generated API schemas and hooks
- `lib/db/src/schema/` — Postgres models for wiki documents, agent definitions, MCP components, and query cache/history
- `lib/agent-runtime` — provider-neutral Cloudflare and NVIDIA OpenShell adapter contracts

## Architecture decisions

- Keep Cloudflare and NVIDIA OpenShell behind a shared runtime adapter interface so agent and JSON Schema contracts remain portable.
- Use Postgres as the workspace source of truth; store query responses by normalized query hash with a ten-minute TTL.
- Retrieval uses lexical candidate selection followed by a separate title/tag/phrase/coverage reranking pass. The LLM answers only from cited wiki excerpts.
- Runtime adapters are scaffolds until provider access is configured; the API reports them as disconnected rather than implying live execution.

## Product

Users can manage shared wiki documents, ask cited questions over that knowledge, build reusable agents, define MCP servers and MCP Apps with JSON Schema, and inspect Cloudflare/NVIDIA adapter readiness.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
