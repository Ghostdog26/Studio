# Enterprise factory: intended operating model

Agent Foundry is a system for producing standardized MCP servers, MCP Apps, and agents for enterprise developers and users—not a requirement for a development team to hand-build every instance.

## Product workflow

1. **Knowledge and standards:** supply approved company context, JSON Schemas, reusable templates, access policies, and deployment constraints.
2. **AI-assisted creation:** generate an implementation against those contracts in a sandbox. Generation is not approval.
3. **Validation:** build and test the implementation; check schema conformance, permissions, dependencies, and behavior.
4. **Human review and approval:** review the exact source, configuration, permissions, and test evidence. Changes invalidate approval.
5. **Deployment assistance:** AI may help prepare deployment, but it must use the approved, versioned build.
6. **Deterministic operation:** deployed software executes the approved implementation rather than regenerating code for each request.

Deterministic deployment means fixed source, configuration, and locked dependencies. An agent that calls an LLM still has probabilistic outputs; an approved build cannot make LLM responses deterministic.

## Current integration boundary

- Agent Foundry retains its PostgreSQL-backed definitions, knowledge queries, caching, and MCP package builder.
- The actual Apache-2.0 Cloudflare OS source is vendored separately, with its provenance recorded in `scripts/cloudflare-os/source.json`.
- Cloudflare OS contributes its upstream agent workspace, gadgets, blueprints, and Gatekeeper capability model.
- Its Replit preview uses the upstream Wrangler/workerd development stack, not Docker or a Cloudflare account.
- The two applications are not yet connected for agent execution or synchronized knowledge.
- Approval enforcement, immutable release storage, deployment orchestration, and enterprise identity integration are not implemented by this import.
- NVIDIA OpenShell is not installed or running.

## Next integration contracts

The knowledge layer should provide scoped context through an explicit Gatekeeper/MCP interface, rather than expose all enterprise data to every agent. Standards should version the input/output schemas, template, permitted tools, and runtime policy used for generation. Release approval must bind to a content digest of the exact build, with any edits requiring a new review.
