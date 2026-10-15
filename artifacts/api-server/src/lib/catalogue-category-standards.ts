export interface CategoryCheck {
  id: string;
  requirement: string;
  evidence: string;
  acceptanceTest: string;
}

export interface CategoryStandard {
  category: string;
  summary: string;
  checks: CategoryCheck[];
}

export const CATEGORY_STANDARDS_VERSION = "1";
export const CATEGORY_STANDARDS_SOURCE_PREFIX = "Agent Foundry priority MCP standards | ";
const check = (id: string, requirement: string, evidence: string, acceptanceTest: string): CategoryCheck =>
  ({ id, requirement, evidence, acceptanceTest });

export const BASELINE_CHECKS: CategoryCheck[] = [
  check("contracts", "Declare Resources, Tools, and Prompts separately; pin protocol/SDK versions and validate input and output JSON Schemas.",
    "Capability inventory, schemas, selected transport/version, and SDK compatibility report.",
    "Reject malformed inputs; validate actual outputs; exercise discovery and calls with the selected transport and MCP Apps extension if used."),
  check("identity-tenancy", "Authorize every operation with least privilege and isolate tenant data, credentials, sessions, caches, and workspaces.",
    "Permission matrix, credential boundary, tenant propagation design, and negative-test results.",
    "Deny unauthenticated and unauthorized requests; attempt cross-tenant access and prove no protected data or secret appears in responses or logs."),
  check("supply-chain", "Inspect implementation and license; pin source and dependencies; deploy the exact reviewed build rather than regenerated code.",
    "Source commit, license inventory, dependency lockfile/SBOM, scan findings with dispositions, and artifact digest tied to review.",
    "Build from the pinned inputs; reject digest/configuration drift from the reviewed release. Do not claim LLM outputs or all builds are intrinsically deterministic."),
  check("side-effects", "Separate reads from writes; require explicit, bounded authorization and human review for destructive or privileged actions.",
    "Side-effect annotations, dry-run examples, approval scope/expiry, and rollback or recovery procedure.",
    "An unapproved write must not run. Reject replay, altered parameters, and approval reuse outside the reviewed scope."),
  check("operations", "Bound latency, concurrency, output, retries, and cost; instrument errors and support safe cancellation and failure recovery.",
    "Limits, redacted audit events, health/error contract, idempotency policy, and load/failure reports.",
    "Inject timeouts, 429s, crashes, oversized output, and duplicate requests; verify bounded retries, truthful errors, and no duplicate mutation."),
];

export const PRIORITY_CATEGORY_STANDARDS: CategoryStandard[] = [
  {
    category: "Cloud Platforms",
    summary: "Infrastructure tools can alter production resources and incur cost; privilege, change scope, and provider portability need explicit evidence.",
    checks: [
      check("cloud-scope", "Use tenant-specific credentials scoped to allowed accounts, projects, regions, and resource types; never expose provider tokens.",
        "IAM policy and account/region allowlist; secret injection/redaction design.",
        "Reject requests for another account or forbidden region, including indirect resource references."),
      check("cloud-change-plan", "Separate discovery from provisioning/deletion; preview exact changes, cost limits, and destructive consequences.",
        "Machine-readable plan, budget thresholds, approval binding, and recovery procedure.",
        "Deny deletion without approval; reject a changed plan; stop provisioning when a defined spend/quota limit is exceeded."),
      check("cloud-idempotency", "Manage asynchronous deployments with idempotency keys, status polling, cancellation, and partial-failure recovery.",
        "Job lifecycle, resource ownership tags, retry strategy, and cleanup policy.",
        "Retry the same deployment after a timeout without creating duplicate resources; demonstrate recovery from a partially applied change."),
      check("cloud-portability", "State which capabilities actually run on Cloudflare OS/workerd and which require managed services or an OpenShell gateway/container host.",
        "Provider-neutral definition plus capability matrix, runtime bindings, connectivity evidence, and unsupported-feature errors.",
        "Fail explicitly when an adapter, binding, or sandbox is unavailable; never report a disconnected provider as deployed."),
    ],
  },
  {
    category: "Code Execution",
    summary: "Treat submitted code as hostile. A subprocess or local workerd preview is not proof of a security sandbox.",
    checks: [
      check("execution-isolation", "Enforce filesystem, process, network, identity, and secret isolation in the actual selected runtime; deny ambient host access.",
        "Sandbox policy and demonstrated enforcement on the deployment host, not only a Dockerfile or design claim.",
        "Attempt filesystem escape, symlink traversal, secret reads, private-network access, and cross-tenant execution; every forbidden operation must fail."),
      check("execution-allowlist", "Allow only declared languages/runners and pinned dependencies; never execute instructions from catalogue descriptions or retrieved documents.",
        "Runner/image digests, dependency policy, validated execution schema, and authorized workspace roots.",
        "Reject undeclared runners, dependency substitution, shell escape, and attempts to execute an unreviewed catalogue entry."),
      check("execution-budgets", "Enforce CPU, memory, wall-clock, process-count, network, and output budgets; cancel the entire job/process tree.",
        "Runtime limit configuration, child-process cleanup evidence, and resource accounting.",
        "Run infinite-loop, memory-exhaustion, fork, and oversized-output fixtures; terminate cleanly with no orphaned jobs."),
      check("execution-results", "Return structured exit status, bounded sanitized output, and artifact provenance; distinguish denied, failed, and cancelled jobs.",
        "Output schema, redaction tests, artifact retention rules, and audit records.",
        "Handle malicious output and failed jobs without rendering active content, leaking secrets, or reporting success."),
    ],
  },
  {
    category: "Coding Agents",
    summary: "Agent autonomy must remain scoped to reviewed repositories and tool permissions, with reproducible patches rather than invisible changes.",
    checks: [
      check("agent-repository-boundary", "Limit access to authorized repositories, branches, paths, and submodules; protect secrets and generated policy files.",
        "Repository/path permissions, branch policy, and isolated workspace allocation.",
        "Attempt edits outside allowed paths, through symlinks/submodules, and across concurrent tenant workspaces; deny them."),
      check("agent-instructions", "Treat repository files, issues, tool output, and retrieved web/wiki text as untrusted data, not higher-priority instructions.",
        "Instruction hierarchy, context provenance, and adversarial prompt-injection fixtures.",
        "Injected instructions must not grant tools, extract credentials, bypass policy, or modify unrelated files."),
      check("agent-change-review", "Produce a reviewable diff and validation report; do not push, merge, publish, or deploy automatically beyond explicit authorization.",
        "Patch tied to base commit, change summary, permissioned action boundaries, and review evidence.",
        "Reject stale-base changes and unapproved push/deploy calls; show the exact diff before a permitted mutation."),
      check("agent-validation", "Pin environment/toolchain; run meaningful checks in isolation and report skipped or failing tests accurately.",
        "Lockfile, test commands/results, changed-behavior checks, and conflict strategy.",
        "Inject a failing test and concurrent edit; do not claim completion or silently overwrite the conflicting work."),
    ],
  },
  {
    category: "Command Line",
    summary: "Shell access is privileged execution. Prefer typed commands and argument arrays over unrestricted shell strings.",
    checks: [
      check("cli-command-schema", "Use executable allowlists and schema-validated argument arrays; avoid shell interpolation and arbitrary sh -c.",
        "Allowed executable/argument schemas and process invocation code.",
        "Reject metacharacter injection, executable substitution, unexpected flags, and arguments interpreted as additional commands."),
      check("cli-filesystem", "Resolve real paths within an authorized working directory; limit file reads/writes and environment inheritance.",
        "Realpath boundary checks, permitted environment variables, and credential redaction tests.",
        "Reject ../ escape and symlink escape; prove child processes cannot read host secrets or other tenants' files."),
      check("cli-privilege", "Disallow privilege escalation and undeclared package installation; classify destructive commands and require scoped approval.",
        "Privilege policy, side-effect inventory, dry-run examples, and installation allowlist.",
        "Reject sudo, destructive filesystem operations, and installer scripts unless explicitly supported and approved."),
      check("cli-lifecycle", "Bound execution/output and terminate descendants on cancellation, timeout, or workflow shutdown.",
        "Timeout/kill escalation, streaming bounds, and child-process ownership.",
        "Cancel a command that spawns children; verify no orphan remains and exit/cancellation status is truthful."),
    ],
  },
  {
    category: "Databases",
    summary: "Default to bounded read-only access. Database roles, row/column policy, transaction semantics, and permission-aware caching are critical.",
    checks: [
      check("database-read-safety", "Use bound parameters, read-only roles/transactions, statement deadlines, row limits, and allowed schemas/functions.",
        "Database grants, query builder/validator, transaction settings, and result-size limits.",
        "Block SQL injection, stacked statements, unauthorized tables/functions, and write-capable operations; stop long-running queries."),
      check("database-tenant-policy", "Apply row/column access policy per request and reset tenant context safely when reusing pooled connections.",
        "RLS/column policy and connection-pool lifecycle tests.",
        "Alternate tenants through the same pool; no row, metadata, query result, or cache entry may cross the permission boundary."),
      check("database-mutations", "Keep writes/migrations as separate capabilities with previews, revision checks, approval, and a tested recovery plan.",
        "Mutation schemas, transaction/idempotency rules, backup/restore evidence, and schema migration plan.",
        "Reject unapproved and stale-revision writes; inject a mid-transaction failure and prove rollback or documented recovery."),
      check("database-cache", "Key caches by tenant, effective permissions, query parameters, schema/data revision, and expiry; invalidate when policy/data changes.",
        "Cache-key specification, invalidation mechanism, and redaction/retention policy.",
        "Change access policy or data after caching; return no unauthorized or incorrectly current cached result."),
    ],
  },
  {
    category: "Data Platforms",
    summary: "Warehouse and pipeline access needs governance, lineage, schema-change handling, and bounded jobs, not just a working connector.",
    checks: [
      check("platform-data-governance", "Honor dataset, row, column, export, and residency policies; minimize sensitive fields in outputs and logs.",
        "Connector grants, dataset allowlist, masking/export rules, and destination controls.",
        "Deny forbidden columns, exports, and destinations; verify masking persists in cached results and generated artifacts."),
      check("platform-contract-lineage", "Version source/output schemas and record lineage, freshness, quality checks, and transformation provenance.",
        "Schema contracts, lineage manifest, freshness thresholds, and quality test results.",
        "Inject missing/renamed columns, duplicates, nulls, and stale partitions; reject or explicitly flag incompatible data."),
      check("platform-pipeline-recovery", "Use idempotent ingestion, checkpoints, bounded retries, and deliberate replay/backfill semantics.",
        "Checkpoint and deduplication design, backfill plan, and partial-commit recovery evidence.",
        "Restart mid-batch and replay events without duplicate writes or skipped records; expose failures rather than synthesizing success."),
      check("platform-job-cost", "Budget scan volume, concurrency, compute cost, and job duration; support cancellation and safe polling.",
        "Query/job budgets, quotas, status lifecycle, and cleanup procedure.",
        "Stop an oversized scan or repeated rate-limit response within the configured budget and cancel remote work."),
    ],
  },
  {
    category: "Developer Tools",
    summary: "Repository, CI, package, and release integrations require supply-chain controls and explicit separation between inspection and mutation.",
    checks: [
      check("developer-permissions", "Scope tokens to permitted repositories, pipelines, packages, and read/write actions; preserve branch protections.",
        "Token scopes, operation permission matrix, and protected-branch integration behavior.",
        "Deny unauthorized repository access and protected-branch mutation; prove reads do not request broad write credentials."),
      check("developer-supply-chain", "Review package licenses, integrity, vulnerabilities, and lifecycle scripts; do not auto-run untrusted installation hooks.",
        "Pinned dependencies, SBOM, integrity checks, scan dispositions, and lifecycle-script policy.",
        "Block substituted packages or an unapproved postinstall script; fail rather than silently switching dependencies."),
      check("developer-release", "Tie build/test reports and release artifacts to exact source/configuration; gate publish/deploy/secret modification.",
        "Commit and artifact digests, CI checks, release permissions, and audit trail.",
        "Reject an unapproved publish or modified artifact; do not mark a failed or skipped CI check as passing."),
      check("developer-events", "Verify webhooks, deduplicate deliveries, and bound retries/concurrency without logging credentials.",
        "Webhook verification/replay policy, idempotency keys, and redacted failure logs.",
        "Reject spoofed/replayed events and process duplicates without duplicate comments, releases, or workflow runs."),
    ],
  },
  {
    category: "Data Science Tools",
    summary: "Scientific outputs need dataset provenance, isolation, reproducibility parameters, and honest uncertainty—not unsupported conclusions.",
    checks: [
      check("science-provenance", "Pin dataset revisions, schemas, units, licenses, preprocessing, and train/evaluation splits; enforce data permissions.",
        "Dataset manifest, transformation lineage, split policy, and access grants.",
        "Detect incompatible units/schema and train-test leakage; reject unauthorized datasets."),
      check("science-reproducibility", "Record code, environment, seeds, parameters, and tolerances; identify nondeterministic components explicitly.",
        "Experiment manifest, lockfile, seed configuration, and reproducibility report.",
        "Rerun a small fixture within declared tolerances; do not promise deterministic LLM/GPU outputs without supporting evidence."),
      check("science-execution", "Run notebooks/scripts only in an enforced sandbox with scoped data access and compute/GPU/time budgets.",
        "Sandbox enforcement tests, dependency policy, job budgets, and cancellation behavior.",
        "Block notebook shell escapes and unauthorized network access; terminate excessive compute without orphaned jobs."),
      check("science-validity", "Use justified methods and document assumptions, missingness, uncertainty, and evaluation metrics.",
        "Method notes, statistical checks, baseline comparisons, and limitations.",
        "Test a known-answer dataset plus missing/biased inputs; surface uncertainty and reject unsupported causal claims."),
    ],
  },
  {
    category: "Data Visualization",
    summary: "Charts and MCP Apps must preserve data meaning and permissions while rendering safely and accessibly.",
    checks: [
      check("visual-data-contract", "Validate chart data types, units, timezones, missing values, aggregation, and source revision.",
        "Chart schema, source/aggregation manifest, and known-answer fixtures.",
        "Handle NaN, missing rows, mixed units, and timezone boundaries without silently changing totals or meaning."),
      check("visual-integrity", "Use appropriate encodings and disclose axis truncation, sampling, uncertainty, and stale data.",
        "Encoding/axis rationale and visible labels, limitations, and freshness metadata.",
        "Compare displayed totals and scales with a known dataset; prevent misleading defaults or undisclosed truncation."),
      check("visual-app-safety", "Apply the selected MCP Apps isolation/CSP model; sanitize active content and authorize every UI-initiated tool call.",
        "App resource manifest, CSP/bridge policy, input validation, and tool authorization tests.",
        "Reject script/URL injection, forged bridge messages, and unauthorized tool calls from the app."),
      check("visual-accessibility-export", "Provide keyboard access, readable contrast, textual alternatives, and permission-preserving safe exports.",
        "Accessibility checks, chart descriptions, export format/retention policy, and masking rules.",
        "Navigate without a mouse and inspect export files; no hidden protected row or active script may leak through export."),
    ],
  },
  {
    category: "Knowledge & Memory",
    summary: "Retrieval quality, provenance, permission-aware caching, and resistance to prompt injection are central to the enterprise second brain.",
    checks: [
      check("knowledge-acl", "Apply document/tenant permissions before retrieval, reranking, summarization, and caching; enforce retention and deletion.",
        "ACL propagation and cache-key design including effective permissions, source/model/standards revisions, and expiry.",
        "Revoke access or delete a document after caching; it must disappear from retrieval, answers, citations, and reusable cached content."),
      check("knowledge-grounding", "Preserve source, version, freshness, trust status, and citation evidence; distinguish community references from approved standards.",
        "Source manifests, citation validation, known-answer/abstention fixtures, and retrieval/reranking evaluation.",
        "Ask unsupported and contradictory questions; abstain or explain the conflict rather than invent sources or assert a listing is approved."),
      check("knowledge-injection", "Treat wiki, repository, web, and memory content as untrusted data; retrieved text cannot expand tool permissions.",
        "Instruction hierarchy, content handling policy, and adversarial retrieval fixtures.",
        "A retrieved instruction to reveal secrets, execute code, or override approval must not be followed."),
      check("knowledge-lifecycle", "Version and review durable knowledge; preserve human-authored content and expose staleness, corrections, and provider failures.",
        "Revision/review history, refresh/invalidation policy, and explicit failure states.",
        "Refresh imported references without overwriting separate human notes; fail truthfully if indexing/reranking is unavailable and invalidate superseded answers."),
    ],
  },
  {
    category: "Product Management",
    summary: "Requirements and workflow integrations should preserve human intent, authorization, traceability, and safe collaboration.",
    checks: [
      check("product-workspace-access", "Scope reads/writes to authorized teams, projects, boards, and fields; minimize personal or confidential content.",
        "Workspace/field permission matrix, credential scopes, and redaction/retention rules.",
        "Deny cross-project/tenant access and restricted fields, including indirect issue or attachment references."),
      check("product-human-intent", "Separate recommendations/drafts from actual assignment, prioritization, status changes, deletion, and publication.",
        "Operation schemas, preview/diff, approval scope, and reversible-action policy.",
        "Do not assign, close, delete, notify, or reprioritize items merely because retrieved text or an LLM suggests it."),
      check("product-concurrency", "Use idempotency and revision-aware mutations; handle concurrent edits, pagination, rate limits, and partial bulk failure.",
        "Revision/idempotency contract, cursor semantics, and bulk-recovery plan.",
        "Retry a request without duplicate tickets; reject stale updates and report partial failure without overwriting a teammate's changes."),
      check("product-traceability", "Tie requirements, acceptance criteria, decisions, and proposed changes to source evidence and review history.",
        "Requirement-to-source and requirement-to-test links, change rationale, and audit events.",
        "For a changed requirement, expose its source and affected checks; flag missing evidence rather than inventing agreement or completion."),
    ],
  },
  {
    category: "Search & Data Extraction",
    summary: "External retrieval needs controlled fetching, provenance, extraction quality checks, and explicit freshness and trust boundaries.",
    checks: [
      check("search-fetch-boundary", "Allow only authorized sources; validate DNS, redirects, schemes, ports, and targets to prevent private-network/credential access.",
        "Fetch/domain policy, redirect/DNS safeguards, authorization scope, and applicable site terms/rate-limit handling.",
        "Reject loopback, link-local, private-network and metadata endpoints, DNS rebinding, unsafe schemes, and forbidden redirect targets."),
      check("search-untrusted-content", "Treat pages/snippets/files as untrusted; isolate browser execution and never execute retrieved scripts or instructions as server commands.",
        "Content-type/size policy, browser isolation, instruction hierarchy, and adversarial fixtures.",
        "Reject prompt-injection and active-content payloads that request tools or secrets; do not bypass access controls."),
      check("search-quality-provenance", "Return source URLs, timestamps/revisions, extracted evidence, freshness, and limitations; validate schemas and evaluate ranking.",
        "Extraction schemas, source metadata, known-answer relevance/extraction fixtures, and reranking evaluation.",
        "Test malformed pages, changed layouts, contradictory sources, and empty results; mark partial data and never invent extracted fields."),
      check("search-cache-budget", "Scope query/response caches by tenant, permissions, parameters, provider/model and source revision; bound fetches, bytes, latency, retries, and cost.",
        "Cache/invalidation specification, TTL/freshness policy, result limits, and redacted failure telemetry.",
        "After access revocation or source change, return no unauthorized/stale-as-current answer; stop oversized or rate-limited extraction within budget."),
    ],
  },
];

export const priorityCategoryNames = PRIORITY_CATEGORY_STANDARDS.map((standard) => standard.category);
export const standardsForCategories = (categories: string[]) =>
  PRIORITY_CATEGORY_STANDARDS.filter((standard) => categories.includes(standard.category));

export function categoryStandardContent(standard: CategoryStandard): string {
  const checks = [...BASELINE_CHECKS, ...standard.checks];
  return `# ${standard.category}: enterprise MCP review standard
Standard version: ${CATEGORY_STANDARDS_VERSION}
Priority category requested by the product owner.

${standard.summary}

These are REQUIRED checks and evidence requests, NOT completed audits or proof of compliance. All catalogue implementations remain unreviewed; missing evidence is unknown, not a pass.

${checks.map((item) => `## ${item.id}
Requirement: ${item.requirement}
Required evidence: ${item.evidence}
Acceptance test to run: ${item.acceptanceTest}`).join("\n\n")}

Before deployment, a human must review the exact implementation, configuration, schemas, permission policy, tests, and pinned artifact. A brief or checklist does not enforce these controls on its own.`;
}
