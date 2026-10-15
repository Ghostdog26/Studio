---
name: Cloudflare OS hosting constraints
description: Non-obvious compatibility constraints when hosting upstream Cloudflare OS inside Replit.
---

Upstream Cloudflare OS has a complete Wrangler/workerd development runner, but it explicitly does not designate that runner as production hosting. Treat a successful workspace preview separately from production self-hosting readiness.

**Why:** The upstream README marks standalone production workerd deployment tooling/documentation as coming soon and warns against using the local runner for production.

**How to apply:** Recheck upstream's current self-hosting guidance when making production changes; do not equate a local-stack preview with persistent, secure enterprise hosting.

The upstream development runner assigns administrative access to an account named `admin`. A publicly reachable preview must not inherit that implicit username grant.

**Why:** A local-development assumption is not an authorization policy for shared infrastructure.

**How to apply:** Keep preview administrator assignment explicit, and reassess development-only assumptions whenever importing an upstream local runner.

Production suitability must not be inferred from Reserved VM always-on compute.
The published filesystem is not a supported durable volume for workerd's SQLite
DO storage; database/object services are not drop-in DO/KV/R2 bindings.

**Why:** Replit publishing guidance warns against relying on filesystem writes,
and upstream workerd exposes local-disk or in-memory DO storage. workerd also
explicitly requires additional sandboxing for possibly malicious code.

**How to apply:** Recheck current platform and upstream contracts before enabling
enterprise hosting. Keep execution disabled when persistence or isolation cannot
be verified; never substitute Docker/privileged workarounds or an external host
for the user's Replit-only requirement.
