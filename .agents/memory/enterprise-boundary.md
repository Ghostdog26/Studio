---
name: Enterprise knowledge boundary
description: Why enterprise creation uses explicit operator grants rather than inheriting the shared demo workspace.
---

Do not infer enterprise access from membership in the shared Foundry demo workspace or from a Cloudflare OS workspace owner's access. Authorization must be granted for the actual initiating user and workspace.

**Why:** There is no federated enterprise identity authority in the imported workspace. Reusing shared demo access or an owner's grant would silently give collaborators broader enterprise knowledge access.

**How to apply:** Keep operator provisioning explicit until a trusted enterprise identity layer replaces it. Preserve the legacy shared control-plane behavior without treating it as an authorization source for generated agents.

Document access restrictions must apply to every public read/write and cache path, not just the MCP interface. Revoking a grant must not re-publish previously restricted knowledge or reveal scoped query text.

**Why:** A scoped bridge is bypassable when the same documents or scoped history remain visible through the public shared-workspace API.

**How to apply:** Keep private wiki authoring operator-only, maintain persistent classification independent of grants, exclude scoped history from public activity, and recheck public cache source visibility.

Keep the imported hosting safety gate independent from the knowledge integration. The explicit unsafe development preview may receive a narrow test workspace/user capability, never an automatically derived installation-wide bridge key.

**Why:** The hosting work deliberately disables execution until persistence, identity and isolation are verified. Connecting knowledge must not silently re-enable that runtime or turn an experimental preview into an enterprise credential holder.

**How to apply:** Preserve the default non-executing status service. Use non-sensitive test grants for preview integration checks and the same scoped contracts for a future verified hosted runtime.
