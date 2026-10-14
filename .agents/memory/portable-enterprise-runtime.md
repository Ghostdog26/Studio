---
name: Portable enterprise runtime
description: Product scope and portability decisions for Agent Foundry's enterprise agent and MCP stack.
---

Agent Foundry is intended as a multiplayer enterprise second brain, agent factory, and MCP server/App builder built from a monorepo. The user selected portability across both Cloudflare and NVIDIA OpenShell rather than a single initial runtime.

**Why:** The user explicitly described this product scope and chose “Portable across both.”

**How to apply:** Keep saved definitions and knowledge-query behavior provider-neutral; use separate deployment adapters/packages for the two environments.

Keep package generation independent of provider credentials. The initial NVIDIA delivery uses OCI packages and the OpenShell CLI rather than the private-registry TypeScript SDK.

**Why:** The CLI-based package route does not require NVIDIA/GitHub package-registry credentials, and no provider account or OpenShell gateway was connected when this approach was chosen.

**How to apply:** Distinguish generated/build-verified packages from actual remote deployments. Do not describe an OpenShell gateway or Cloudflare account as connected without verifying it.
