# Cloudflare OS on Replit

This workspace includes the **actual upstream Cloudflare OS project**, not a mockup or a workerd-only starter.

## Source and commands

- Source: `vendor/cloudflare-os/`
- Repository/revision/license: `scripts/cloudflare-os/source.json`
- Install and build the required frontend/storage packages: `pnpm --filter @workspace/scripts cloudflare-os:prepare`
- Preview: `/cloudflare-os/`
- Readiness: `/cloudflare-os/healthz`
- Service: the Cloudflare OS managed service on the existing Agent Foundry artifact.

The upstream project keeps its own dependency workspace and lockfile. It is intentionally not merged into the outer pnpm catalog. The launcher uses the environment's pnpm with version management disabled; the upstream frozen lockfile and minimum-release-age policy remain intact.

The hosting adapter strips the preview prefix on requests to upstream and forwards WebSocket upgrades. The frontend uses Vite's base URL and TanStack Router's basepath. Small changes to upstream files add preview-path support, public Gatekeeper URLs, an opt-out of the build cache, and removal of the development runner's implicit `admin` username grant on Replit. Preserve the upstream license and notices when updating the source.

The upstream Vite+ build cache triggers native executable `EBUSY` errors in this environment. Preparation uses a direct Vite frontend build and invokes the pinned TypeScript native binary directly for typed-storage; startup runs Gatekeeper tasks with caching disabled. This changes build orchestration, not the application runtime or the frozen dependency versions.

## What this is not

This is a **development preview hosted on Replit**, using the upstream multi-worker Wrangler runner. Upstream explicitly says its local runner is not for production; production self-hosting documentation/tooling is still in progress.

There is no Cloudflare deployment/account connection, no OpenShell gateway, and no integration yet between Cloudflare OS's accounts/storage and Agent Foundry's PostgreSQL data.

Runtime data is stored in the upstream `.wrangler` directory, excluded from Git and publishing. Do not treat that filesystem state as durable production storage. Production requires an explicitly designed persistence, backup, authentication, isolation, and workerd supervision strategy.

No development auto-login or default administrator credentials are enabled by this adapter. Create an account through the upstream UI. External Gatekeepers and model providers require separate configuration. Browser rendering, third-party OAuth, and arbitrary generated gadget execution must be independently verified before being offered as supported enterprise features.
