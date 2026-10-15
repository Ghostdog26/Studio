---
name: Cloudflare OS hosting constraints
description: Non-obvious compatibility constraints when hosting upstream Cloudflare OS inside Replit.
---

Upstream Cloudflare OS has a complete Wrangler/workerd development runner, but it explicitly does not designate that runner as production hosting. Treat a successful workspace preview separately from production self-hosting readiness.

**Why:** The upstream README marks standalone production workerd deployment tooling/documentation as coming soon and warns against using the local runner for production.

**How to apply:** Recheck upstream's current self-hosting guidance when making production changes; do not equate a local-stack preview with persistent, secure enterprise hosting.

Cached upstream Vite+ tasks caused native compiler and esbuild executable `EBUSY` failures in this Replit environment, while direct execution worked. Use uncached tasks or direct builds rather than changing compiler dependencies to compensate.

**Why:** This was observed with both the pinned native TypeScript compiler and esbuild; the same binaries executed successfully outside the cached task runner.

**How to apply:** If updating upstream restores cached execution, verify it explicitly before re-enabling cache. Preserve dependency lockfiles rather than treating this as a package-version failure.

The upstream development runner assigns administrative access to an account named `admin`. A publicly reachable preview must not inherit that implicit username grant.

**Why:** A local-development assumption is not an authorization policy for shared infrastructure.

**How to apply:** Keep preview administrator assignment explicit, and reassess development-only assumptions whenever importing an upstream local runner.
