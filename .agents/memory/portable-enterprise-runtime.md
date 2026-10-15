---
name: Portable enterprise runtime
description: Product scope and portability decisions for Agent Foundry's enterprise agent and MCP stack.
---

Agent Foundry is intended as a multiplayer enterprise second brain, agent factory, and MCP server/App builder built from a monorepo. The user selected portability across both Cloudflare and NVIDIA OpenShell rather than a single initial runtime.

**Why:** The user explicitly described this product scope and chose “Portable across both.”

**How to apply:** Keep saved definitions and knowledge-query behavior provider-neutral; use separate deployment adapters/packages for the two environments.

The user describes the system as producing scalable, standardized MCP servers, MCP Apps, and agents for enterprise developers or users, rather than requiring the development team to build each individually. Their intended workflow is: AI builds, a human reviews and approves, AI assists deployment, then the deployed implementation is deterministic. Knowledge and standardization layers are important.

**Why:** The user explicitly clarified the enterprise factory operating model.

**How to apply:** Keep AI generation separate from execution. Approval must apply to the exact versioned artifact being deployed, and changes should require renewed review. Do not describe LLM outputs themselves as deterministic.

The user wants a library of community MCP server references, specifically awesome-mcp-servers, included both as a catalogue and in the knowledge repository so AI can help users build standardized servers. Their supplied MCP architecture notes should inform the knowledge and standardization layers.

**Why:** The user explicitly asked for both catalogue browsing and knowledge inclusion, and emphasized the architecture notes.

**How to apply:** Keep reference discovery and grounded AI retrieval connected, while distinguishing directory metadata from installed or enterprise-approved implementations. Qualify protocol claims against the selected official specification rather than treating every source note or community listing as verified.

Keep package generation independent of provider credentials. The initial NVIDIA delivery uses OCI packages and the OpenShell CLI rather than the private-registry TypeScript SDK.

**Why:** The CLI-based package route does not require NVIDIA/GitHub package-registry credentials, and no provider account or OpenShell gateway was connected when this approach was chosen.

**How to apply:** Distinguish generated/build-verified packages from actual remote deployments. Do not describe an OpenShell gateway or Cloudflare account as connected without verifying it.

The user wants the actual Cloudflare OS project (https://github.com/cloudflare/cloudflare-os), which runs on workerd, and NVIDIA OpenShell hosted on Replit infrastructure, not on their local machine or an external host. Cloudflare OS does not mean bare workerd or the entire managed Cloudflare platform.

**Why:** The user explicitly corrected the proposed self-hosted deployment location.

**How to apply:** Inspect the Cloudflare OS project's own self-hosting path rather than assuming all Cloudflare services are required. Do not substitute an off-platform Docker deployment or bare workerd for this requirement. Explain Replit's container-hosting limitations before proposing a different architecture; package downloads alone do not satisfy the requested hosted runtimes.
