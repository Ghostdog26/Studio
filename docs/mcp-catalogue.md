# MCP reference catalogue

Agent Foundry imports the **directory metadata** from [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers), not the implementation code of every listed server.

## Using it

- Open **Catalogue** in the Agent Foundry navigation.
- Search by name/description, filter by category, language, or service scope, and browse paginated results.
- Select an entry for its repository link, linked knowledge document, and a copyable AI builder brief.
- The shared knowledge query endpoint can retrieve and cite these descriptions when answering MCP design questions.
- The architecture notes supplied by the user are retained as a separate knowledge document. A qualified builder standards document covers Host/Client/Server roles, Resources/Tools/Prompts, version/transport selection, authorization, and the human-review workflow.

## Provenance and trust

The pinned directory revision is in `artifacts/api-server/mcp-catalogue-source.json`. Each row records that revision and its import time; this is a snapshot, not a live claim about current repository status. The directory's MIT license is retained at `docs/third-party/awesome-mcp-servers-LICENSE.txt`. Every listed implementation has its own license, which must be checked separately.

All references are **unreviewed**. “Listed official” only reflects the upstream directory's label, not Agent Foundry verification. Scope refers to the service connected to, not the transport used by MCP. Unknown metadata is not inferred.

Importing does not clone, install, connect, execute, audit, or approve the listed servers. Catalogue text is untrusted reference data; AI must not treat it as executable instructions. Before reuse, inspect source, permissions, dependencies, supported protocol/transport, tenancy, and license, then review the exact build before deployment.

## Re-importing

1. Apply development schema changes: `pnpm --filter @workspace/db run push`.
2. Run `pnpm --filter @workspace/api-server run catalogue:import`.
3. To choose a newer reviewed directory snapshot, pass `--revision=<full Git commit>` and update the source metadata deliberately.

The importer is transactional, serializes concurrent imports, deduplicates URLs and merges categories, preserves catalogue IDs on repeat imports, and invalidates answer caches after a successful import. It updates its generated reference/guide knowledge documents; keep human-written additions in separate wiki documents rather than editing importer-managed content. It never deletes unrelated enterprise wiki data. Entries removed upstream are retained historically, but browsing lists the latest imported revision.

The raw source download, license copy, build output, and import report live under ignored `generated-artifacts/mcp-catalogue/`. PostgreSQL stores catalogue metadata and linked wiki documents. No GitHub credentials are needed for this public directory import.
