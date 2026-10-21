# MOSSI Studio: product and architecture brief

**Status: adopted refactor direction; integration foundation in progress. The target MOSSI integrations are not connected.**

The capability is named **MOSSI Studio**. The first refactor introduces server-owned readiness, replaces the primary public-first builder path, and blocks standalone prototype generation/download endpoints. Existing records and compatibility identifiers remain intact. Most of the architecture below describes subsequent integration work, not completed functionality.

The user requested a placeholder GitLab destination for now: `https://gitlab.example.com/mossi/monorepo`. Studio marks it as a placeholder, does not contact it, and does not treat it as verified access, policy, or authorization to create merge requests.

This brief responds to the supplied MOSSI feedback. It defines a narrower role for Control Plane, identifies reusable work, and describes how it should integrate with existing enterprise services.

The MOSSI repository, Enterprise Shell, internal registries, identity services, and delivery configuration have **not** been inspected. References to MOSSI's current policies and infrastructure below come from the feedback and require verification. Suggested paths and interfaces are proposals, not claims about existing APIs.

## 1. Product definition

> MOSSI Studio is MOSSI's guided capability builder: discover what already exists, propose a standards-compliant contract, and prepare a monorepo contribution for the existing review and deployment pipeline.

Its job is to make the standard contribution path easier for developers and non-developers. It should not become a second knowledge platform, standards authority, authorization system, or runtime control plane.

### The problem it solves

Templates and coding agents help developers implement a capability. On their own, they do not ensure that:

- An equivalent capability or canonical schema does not already exist.
- A non-developer can describe a need and participate in shaping a contribution.
- Capability owners review the tools, schemas, permissions, and interface contract before implementation code is generated.

These are the three product responsibilities that justify a dedicated builder.

### Primary users

| User | Desired outcome |
| --- | --- |
| Business or operational contributor | Describe a need, discover existing options, and submit a structured proposal without managing SDK boilerplate. |
| Developer or coding agent | Follow the same reuse and contract process, then contribute in the correct monorepo location. |
| Capability or schema owner | Review scope, reuse decisions, permissions, and contracts before implementation grows around them. |
| Platform team | Keep contributions on established templates, shared libraries, CI checks, and deployment conventions. |

### What success looks like

The preferred outcome is often **“this already exists; use it.”** Other valid outcomes are extending an existing capability or proposing a genuinely new one.

A downloadable project is not the target deliverable. An accepted contribution to the authoritative monorepo is.

## 2. Scope and non-goals

### In scope

1. Explain a goal in ordinary language.
2. Search authorized internal capabilities, data metadata, canonical schemas, and supporting knowledge.
3. Present reuse, extension, and new-capability options with evidence.
4. Draft a contract from authoritative standards and templates.
5. Obtain an owner-reviewed contract checkpoint using the repository's review mechanism.
6. Prepare a merge request in the approved monorepo location.
7. Display CI and review status from the systems that own those decisions.
8. Offer the same workflow through the Enterprise Shell and a coding-agent skill.

### Out of scope

- A replacement enterprise second brain or independent standards store.
- A builder-owned CI, approval service, artifact registry, or deployment orchestrator.
- Automatic execution of community MCP servers.
- Arbitrary language selection outside the enterprise-supported set.
- Custom MCP App frontends as the default interface mechanism.
- Deployment to multiple competing runtime paths.
- Automatic merges, self-approval, CI bypass, or release of unreviewed model output.

Agent definitions, MCP server implementations, and views may still be contribution types, but each must use MOSSI's actual contracts and delivery conventions.

## 3. Keep, adapt, retire, integrate

“Retire” means remove from the proposed MOSSI product path after a reviewed migration. **This brief does not authorize deleting current code, records, packages, or vendored dependencies.**

| Existing investment | Proposed treatment | Reason |
| --- | --- | --- |
| Goal form and guided builder | **Keep and adapt.** Add reuse-first decisions and repository handoff. | Useful entry point for non-developers and developers. |
| Catalogue ranking and evidence display | **Adapt.** Query internal sources first; public references become an explicitly secondary source. | Internal reuse should precede outside inspiration. |
| AI specification drafting | **Keep.** Ground it in pinned repository standards and authorized knowledge. | Contract drafting is a central product function. |
| Schema editing and structural checks | **Keep and adapt.** Reference canonical schemas and validate with repository-owned rules. | Reduce duplicate definitions and catch errors early. |
| Provenance and source digests | **Keep.** Include standards/template revisions and contribution provenance. | Reviewers need to know which inputs produced a proposal. |
| PostgreSQL persistence | **Narrow.** Retain workflow state and authorized caches where needed. | It must not become the authority for enterprise standards or approved capabilities. |
| Local wiki and reference imports | **Transition.** Use the enterprise knowledge service; preserve current content until ownership and migration are settled. | Avoid a competing second brain without losing existing work. |
| Local grants model | **Adapt, not copy unchanged.** Map to MOSSI identity and authorization. | Existing enterprise permissions must remain authoritative. |
| Source archive downloads | **Retire as the primary delivery path.** Prepare monorepo merge requests. | Standalone projects bypass the standard contribution destination. |
| Eleven server languages | **Replace the UI choice with policy-backed options.** | Maintain only languages supported by enterprise templates, telemetry, and runtime libraries. |
| TypeScript MCP App package path | **Replace the default output with shared-renderer YAML views.** | Follow the reported MOSSI view policy; exceptions require explicit approval. |
| Portable deployment adapters | **Remove from the normal MOSSI delivery flow.** | Use the existing deployment system rather than establish a parallel one. |
| Cloudflare OS integration | **Exclude from the baseline target.** Retain only if a documented need justifies it. | The proposed builder should be a MOSSI capability, not depend on a second OS. |
| OpenShell | **Integrate only as the existing agent enforcement layer, if confirmed.** | Enforcement is not a separate deployment destination. |
| Proposed approval/release pipeline | **Do not build a duplicate.** Read existing review and CI status. | GitLab, owners, and the delivery system own these decisions. |

The earlier request for broad language portability remains reflected in the current implementation. This proposal deliberately narrows the MOSSI contribution path; it does not silently remove that existing behavior.

## 4. Target architecture and ownership

```text
 Enterprise Shell UI                      Coding-agent skill
          |                                       |
          +--------- Same builder workflow -------+
                              |
                    Capability builder service
                    (proposed apps/capability-builder/)
                              |
          +-------------------+----------------------+
          |                   |                      |
 Authorized internal     Enterprise knowledge   Monorepo standards,
 capability registry     / second brain          templates, Global schemas,
 and OpenMetadata                                view definitions
          |                   |                      |
          +------- Evidence-backed contract --------+
                              |
                    GitLab contribution interface
                              |
                    Contract review checkpoint
                              |
                 Implementation merge request/update
                              |
                  Existing CI gates and CODEOWNERS
                              |
                   Existing OCI → Flux → Kubernetes

 OpenShell: existing agent enforcement boundary, where applicable.
 Not a second deployment route owned by the builder.
```

The exact capability path and Shell embedding mechanism must be confirmed in MOSSI.

### Sources of truth

| Information | Proposed authority | What the builder may retain |
| --- | --- | --- |
| Standards, templates, supported languages, telemetry conventions | Versioned monorepo content | Revision/digest references and bounded caches. |
| Canonical “Global” schemas | MOSSI's schema source, to be located | Stable schema references and resolved-version evidence. |
| Existing capability definitions | Internal capability registry and its backing repository | Search results with provenance and freshness metadata. |
| Data assets and metadata | Approved OpenMetadata instance | Authorized metadata excerpts and source identifiers. |
| Enterprise knowledge | Existing second-brain service | Permission-scoped excerpts, citations, and short-lived caches. |
| User identity and permissions | Enterprise identity/authorization services | Verified subject/scope references, not independent permission policy. |
| Proposed implementation | GitLab branch and merge request | Request-to-MR linkage and observed status. |
| Approval and verification | Repository review rules and CI | Read-only status and links to authoritative evidence. |
| Release and deployment | Existing artifact and GitOps systems | Release identifiers and observed deployment links, if exposed. |

A cached value must never become a competing editable source of truth.

## 5. Contribution workflow

### Step 1: Describe the goal

Capture the desired outcome, intended users, relevant systems, data sensitivity, and likely permissions. Do not ask users to paste credentials or sensitive sample records.

Authenticate the contributor before searching restricted sources. The builder derives identity and accessible scope server-side rather than trusting user-supplied tenant or permission fields.

### Step 2: Search for reuse

Search the authorized internal capability registry, canonical schema inventory, and relevant OpenMetadata records. Use the second brain to explain standards and terminology with citations.

Present:

- **Use an existing capability:** show what it does, who owns it, and its authoritative reference. End the creation path unless the user requests a justified extension.
- **Extend a capability:** identify the existing owner and contribution destination.
- **Propose a new capability:** explain the gap and record which sources were searched.

Unavailable or stale internal discovery must not be presented as “nothing exists.” Report the limitation and block an automatic new-capability conclusion. Public catalogue matches must remain clearly labeled external references.

### Step 3: Draft the contract

Use the repository-approved template to propose:

- Capability purpose, ownership, and intended consumers.
- MCP tool names, descriptions, and input/output contracts.
- References to existing canonical schemas; new schema proposals only when reuse is insufficient.
- Required data access and tool permissions, with least-privilege justification.
- Shared-renderer view templates and proposed YAML bindings.
- Supported language and shared runtime/telemetry library references.
- Acceptance cases, failure cases, and observability requirements.
- Reuse search evidence, source citations, and pinned standards/template revisions.

Tool/resource/prompt declarations must follow the actual selected MOSSI template; do not invent interfaces that its runtime does not support. The draft should be explicitly labeled unapproved.

### Step 4: Review the contract before generating implementation

Use MOSSI's existing GitLab review mechanism, not a separate builder approval database.

**Recommended default:** open a contract-only merge request first, with no generated implementation. Once the required owners approve that exact contract revision under the repository's rules, prepare the implementation contribution. Whether the contract MR must merge first, and where contract files belong, must be decided from the real repository policy.

If MOSSI uses one MR for both stages, it needs an explicit, enforced contract-review checkpoint. “Draft MR” status or a local Save button alone is insufficient. Adding implementation commits may invalidate earlier approvals according to repository rules; the builder must not carry approval forward on its own.

### Step 5: Prepare the implementation contribution

Generate only within approved repository templates and paths. The expected new-capability destination from the feedback is `apps/<capability>/`; proposed views belong in its approved `views/*.yaml` layout, subject to confirmation.

Reuse shared runtime libraries and telemetry envelopes instead of reproducing them per package. Never modify CI policy, CODEOWNERS, shared standards, or unrelated applications as a side effect of capability generation.

Create or update the appropriate branch/MR with:

- The reviewed contract reference and current digest.
- Generated implementation, YAML views, and required tests.
- Reused schema and capability references.
- A summary of model-assisted changes and their provenance.
- Remaining review questions and custom-UI exception references, if any.

Retries should reconcile with the existing request/MR, not create duplicate contributions. Branch conflicts and changed upstream standards require explicit reconciliation, not force-pushes or silent regeneration.

### Step 6: Hand off, then report

GitLab CI and owners determine whether the contribution meets the repository's gates. Existing delivery systems build the OCI artifact and manage GitOps deployment under their configured policies.

The builder may show “MR opened,” “checks failed,” or “awaiting owner review.” It must not equate those with “approved,” “merged,” or “deployed.” It should not expose an independent Publish button that bypasses this process.

## 6. Shared UI and coding-agent interface

The Enterprise Shell UI and coding-agent skill should call the same workflow service and receive the same policy decisions. A developer using an agent must not bypass reuse checks or the contract checkpoint.

Proposed service responsibilities—not established endpoint names:

1. Search reuse candidates with permission-filtered evidence.
2. Load standards and templates at an explicit repository revision.
3. Draft and structurally validate a contract.
4. Prepare a contract contribution and return its MR reference.
5. Recheck repository-owned review state for the exact contract revision.
6. Prepare the implementation contribution when permitted.
7. Read authoritative CI, review, merge, and release status.

The skill is a client of this process, not a second set of prompt-only rules.

## 7. Security, caching, and failure behavior

- **Restricted retrieval:** search and model context must respect the contributor's enterprise permissions. Do not use a broadly privileged service account to expose documents the contributor cannot read.
- **Source instructions:** treat retrieved documents, catalogue descriptions, and repository content as data, not permission to override policy or invoke arbitrary tools.
- **Model data handling:** confirm the approved model provider, allowed data classifications, retention rules, and logging policy before sending private context.
- **Repository writes:** use narrowly scoped credentials, server-approved repository destinations, branch restrictions, and an allowlist of writable paths. Model-generated paths must not expand that scope.
- **Approval integrity:** verify review status against the exact contract revision and current repository rules. A changed contract, permission request, template, or schema version can require renewed review.
- **Cache isolation:** key retrieval and draft caches by relevant identity/scope and source revisions. Recheck access after grant changes; permission revocation must not be bypassed by old responses.
- **Stale standards:** do not create a contribution against silently outdated or unverifiable policy. Surface the mismatch and revalidate.
- **Integration failures:** missing OpenMetadata, knowledge, registry, or GitLab access must produce an explicit blocked/partial state—not a fabricated no-match, approval, or successful MR.
- **Custom interfaces:** require a verified exception before departing from renderer YAML; a model explanation is not approval.
- **Auditability:** correlate a request with its evidence, contract revision, MR, and observed CI results without logging secrets or unrestricted document contents.

OpenShell policy, if used, belongs to the enterprise enforcement boundary. The builder must not turn off enforcement to make generated code run.

## 8. Delivery sequence

These are proposed implementation stages, not permission to change the current application.

### Stage A: Verify the integration contract

Inspect MOSSI's actual repository and authoritative documentation. Establish a written mapping of standards, canonical schemas, templates, identity, renderer contracts, registries, CI checks, and contribution permissions.

**Exit evidence:** an owner-confirmed integration map and a representative existing capability that follows it.

### Stage B: Run a read-only reuse pilot

Connect authorized internal discovery and knowledge sources. Support evidence-backed reuse decisions before any repository-writing automation.

**Exit evidence:** known existing capabilities are found; inaccessible and unavailable sources are not reported as absent; duplicates are flagged for review.

### Stage C: Add contract contributions

Read pinned standards and templates, draft contracts, reference canonical schemas, propose YAML views, and open contract-only MRs through a constrained integration.

**Exit evidence:** a non-developer can submit a reviewable contract; retries do not duplicate MRs; owners review through GitLab.

### Stage D: Add implementation contributions

Generate from the approved contract and standard template into the correct repository location. Use existing CI and review controls. Expose the same workflow through a coding-agent skill.

**Exit evidence:** a contribution passes the real repository checks and reaches the standard delivery path without builder-owned bypasses.

### Stage E: Consolidate the prototype

After the replacement path works, agree what prototype data and behavior to migrate, retain as development-only, or retire. Preserve provenance and restricted knowledge classifications.

**Exit evidence:** one authority per domain, a tested cutover/rollback approach, and explicit approval for destructive changes. Do not delete the current wiki, standards, grants, or portable runtime work merely because this brief proposes a narrower product.

## 9. Pilot and decision criteria

Run three real requests over two weeks and compare against the same work performed with the standard template plus a coding agent:

1. A request whose capability already exists.
2. A request that should extend an existing capability and reuse a canonical schema.
3. A genuinely new capability, preferably initiated by a non-developer.

Measure:

| Measure | Definition |
| --- | --- |
| Reuse outcome rate | Requests resolved by using an existing capability divided by all requests evaluated; track extensions separately. |
| Time to merged contribution | Time from recorded goal to merge for requests that require a change; show reuse-only outcomes separately. |
| Duplicate schemas | Proposed or merged schemas judged by the responsible owner to duplicate an existing canonical schema; report both prevented and escaped duplicates. |

Also record review effort and blocked cases so a fast but poor-quality contribution is not treated as a win. Use the same acceptance expectations for both approaches.

Agree success thresholds before the pilot. Three requests provide directional evidence, not statistical proof. If the builder does not improve reuse or contribution time without weakening review quality, simplify it to the shared skill or stop further platform development.

## 10. Decisions to verify before implementation

| Question | Why it matters |
| --- | --- |
| Where are MOSSI's repository and the actual capability template? | Determines paths, dependencies, ownership, and contribution shape. |
| Where are standards and Global schemas authored and versioned? | Establishes authority and prevents parallel standards/schema stores. |
| Which languages are supported? | TypeScript/Python are suggestions in the feedback, not a verified allowlist. |
| What is the internal registry API, and what does OpenMetadata cover? | Avoids assuming data metadata is a complete capability registry. |
| How does the second brain enforce identity and document permissions? | Required for safe retrieval and model context. |
| What is the Enterprise Shell renderer's YAML schema and exception policy? | The reported October 15 policy revision has not been independently verified. |
| How is contract-first review enforced today? | Determines whether two MRs or a gated single-MR process is appropriate. |
| What CI gates, approval rules, and deployment triggers actually exist? | Prevents building against assumed CODEOWNERS or Flux behavior. |
| What repository-write identity may the builder use? | Sets branch, path, audit, and non-developer contribution boundaries. |
| Where does OpenShell enforce agent behavior in the existing deployment? | Keeps enforcement separate from the deployment destination. |
| Which prototype records need preservation or migration? | Prevents accidental data loss and private-to-public disclosure. |

Until these are answered, this is a proposed integration design—not a claim that MOSSI is connected or that its policies are enforced here.

## Related documents

- [Current implementation README](../README.md)
- [Current enterprise context boundary](enterprise-factory.md)
- [Current MCP builder and language generation](official-mcp-builder.md)
- [Current community catalogue](mcp-catalogue.md)
- [Current OpenMetadata reference context](openmetadata-context.md)
- [Current Cloudflare OS hosting constraints](cloudflare-os-replit.md)
