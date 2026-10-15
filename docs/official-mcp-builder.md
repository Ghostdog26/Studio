# Official MCP sources and language-aware generation

`https://github.com/modelcontextprotocol` is the official organization, not a single repository. Agent Foundry imports:

- The `modelcontextprotocol/modelcontextprotocol` specification repository's README, license, language-neutral JSON Schema, and selected normative architecture, transport, authorization, tools, resources, and prompts documents.
- README/license snapshots for the ten official SDK repositories, pinned to exact Git commits. JavaScript and TypeScript share the TypeScript SDK.
- These sources into the shared knowledge repository, alongside the enterprise category standards.

The source snapshots and SHA-256 checksums are at `vendor/mcp-official/`. These are selected reference sources, **not full clones of every SDK implementation or installed SDK environments**. Generated projects obtain SDK implementations through their declared package managers on a compatible build host.

## Language choices

The MCP components page offers TypeScript, JavaScript, Python, Go, C#, Rust, Ruby, Java, Swift, PHP, and Kotlin through the official SDK registry. Unknown languages fail explicitly; the system never silently generates TypeScript for a different requested language.

Cloudflare OS/workerd packages are offered for JavaScript/TypeScript only. Native-language projects target a compatible native/OCI host such as an appropriately configured OpenShell gateway. Package generation does not connect, start, or deploy an OpenShell gateway. MCP Apps retain the existing TypeScript package path.

## Common standards across languages

AI generation uses the saved definition, official SDK documentation, selected specification excerpts, baseline enterprise checks, and requested category profiles. Packages include:

- Native-language source, dependency/build configuration, and model-generated test source.
- The authoritative saved `definition.json` and official protocol `schema.json`.
- SDK/specification licenses and source provenance.
- `REQUIRED-REVIEW.md` with required controls, evidence, and negative acceptance tests.
- A manifest with a source digest, selected language/target, source revisions, and explicit **build not run / not deployed** status.

The imported protocol revision is a reference, not a claim that every generated SDK implementation passed that revision's conformance tests. The project's actual supported version and transport must be checked.

Generated archive paths, duplicate/reserved files, source size, declared language, SDK reference, README, and test-source presence are validated. These structural checks do not replace compilation, real SDK protocol tests, schema constraint tests, authentication/tenant isolation tests, dependency audits, or human review. Generated test source can itself be wrong. An LLM draft is not a verified release.

No generated code, installer, build, or deployment is executed by this endpoint. Generation is workspace-only, bounded and throttled; the existing API has no enterprise identity boundary, so production generation is rejected until an authenticated gateway is implemented.

## Priority review areas

The twelve product-priority categories have versioned knowledge documents and catalogue detail checklists. Each includes five baseline checks plus at least four domain-specific controls with required evidence and an acceptance test. The priority catalogue filter covers the union of these categories without hiding other references. All entries remain unreviewed.

## Maintenance

```sh
pnpm --filter @workspace/api-server run mcp:official-import
pnpm --filter @workspace/api-server run catalogue:import
pnpm --filter @workspace/api-server run catalogue:test
pnpm --filter @workspace/api-server run mcp:languages-test
```

Restart the API after refreshing source snapshots; provenance metadata is cached per process. Local source checksum mismatches fail generation rather than silently using modified or partial source data.
