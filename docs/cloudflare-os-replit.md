# Cloudflare OS on Replit: production feasibility and safety gate

## Decision

**A persistent enterprise Cloudflare OS service is blocked on the currently
documented Replit capabilities.** This is not a production deployment. No
published app, database migration, external host, or privileged container has
been created. Agent Foundry's PostgreSQL remains in place.

The managed service now serves a **non-executing status endpoint** by default,
instead of automatically launching Wrangler and accepting accounts or gadgets.
This intentionally removes the previous interactive preview from the default
workflow. Existing `.wrangler` data is not deleted.

- `/cloudflare-os/`: explanatory page, HTTP 503.
- `/cloudflare-os/status`: machine-readable blockers, HTTP 200.
- `/cloudflare-os/livez`: status process is alive, HTTP 200; **not** readiness.
- `/cloudflare-os/healthz`: HTTP 503 until an actual supported runtime exists.
- All API requests and WebSocket upgrades are rejected, not proxied.
- `pnpm --filter @workspace/scripts run cloudflare-os:production-check`:
  deliberately exits 1 with the blockers. It cannot be bypassed by setting
  configuration booleans.

No Cloudflare OS production service stanza has been added to the artifact.
Adding a run command would not fix persistence or isolation. Agent Foundry's
existing production settings are unchanged.

## Evidence checked on 2026-10-15

Both the vendored source and **current upstream main** were inspected.

| Source | Relevant evidence |
| --- | --- |
| [Cloudflare OS upstream README](https://github.com/cloudflare/cloudflare-os#deploy-to-your-own-server-using-workerd) | Self-hosted production tooling/documentation is still **COMING SOON**. `run-local`/Wrangler is explicitly not the right way to run a production server. |
| [workerd README](https://github.com/cloudflare/workerd#warning-workerd-is-not-a-hardened-sandbox) | Native Linux binaries exist; workerd alone is **not a hardened sandbox** for possibly malicious code. Separate secure sandboxing is required. |
| [workerd configuration schema](https://github.com/cloudflare/workerd/blob/main/src/workerd/server/workerd.capnp) | Durable Object storage choices are `inMemory` or `localDisk`; local storage uses SQLite, including WAL/SHM files. It is not a PostgreSQL binding. |
| [Replit Publishing](https://docs.replit.com/learn/projects-and-artifacts/replit-deployments#how-it-works) | Publishing makes a separate snapshot; do not rely on writes to the published filesystem. Use storage/database services. |
| [Replit deployment types](https://docs.replit.com/features/publishing/deployment-types#reserved-vm) | Reserved VM supplies always-on compute. It does not document the durable volume contract needed by workerd's SQLite storage. Autoscale is unsuitable for independently writable copies of this local state. |
| [Replit app access](https://docs.replit.com/features/publishing/private-deployments) | Edge visibility controls exist, but do not establish an application's user identity, tenant membership, or administrator privileges. |

Do not interpret this as "native workerd cannot execute on Replit": the earlier
preview already used it. The blockers concern a **supported durable, isolated
production service**, not binary execution. No Docker daemon, privileged
container, nested VM, or systemd workaround was attempted. Replit's customer
isolation does not by itself establish isolation between malicious gadgets and
the control plane/secrets inside the same app.

## Storage and backup requirements

The upstream backend binds Durable Objects for users, workspaces/facets, admin
settings, pending logins, and the user directory; Gatekeepers have additional
state. KV stores `BLUEPRINTS` and `AVATARS`; R2 stores `BLUEPRINT_CONTENT`.
The preview's local Miniflare/Wrangler state is an **emulation**, not managed
Cloudflare storage. Back up the whole state set, not only the named backend DOs.

| Data | Current guarantee | Requirement before enterprise use |
| --- | --- | --- |
| DO SQLite and facets | Local `.wrangler` state; no deployment durability guarantee | Durable POSIX storage with SQLite locking/fsync semantics, a single writer per namespace, stable object IDs, restart/redeploy survival, and version-compatible recovery |
| KV metadata/avatars | Local emulation | Compatible durable implementation and consistent recovery with related DO/R2 references |
| R2 blueprint content | Local emulation | Durable object service plus a tested R2-compatible adapter; Replit App Storage is **not** a drop-in Workers R2 binding |
| Agent Foundry | Existing PostgreSQL | Keep its separate data model and backup policy; do not replace it with local SQLite |

Replit Database/App Storage are durable options for application data, but wiring
their URLs into workerd does not implement its DO/KV/R2 APIs, transactions,
facets, alarms, or concurrency behavior. Periodically copying live SQLite files
to App Storage would neither provide a safe shared filesystem nor guarantee
consistent recovery. This assessment does not silently convert the database.

**No production backups or restore guarantees are configured.** Do not put
enterprise data in the unsafe preview. For preserving existing experimental
data: stop the entire Cloudflare OS workflow, verify all Wrangler/workerd
descendants have exited, and make an access-restricted cold copy of **all**
`.wrangler` state directories (including package-local state, WAL/SHM and blob
files). Keep this outside Git and published images. Treat it as a manual
development copy, not a verified production backup.

A future supported deployment must implement encrypted off-instance backups of
the complete, quiesced/checkpointed state set with manifests/checksums, namespace
IDs, code revision, schema/compatibility versions, timestamps, and key-recovery
instructions. Restrict backup access because it includes sessions and external
grants. Define retention, RPO and RTO with the operator; do not invent guarantees.
Restore to an isolated instance with external effects disabled, check checksums,
then verify login/revocation, workspace contents/facets, alarms, KV references
and R2 blobs before cutover. Prove a fresh deployment can restore without the
original filesystem. No such restore drill has been performed here.

## Identity and access

The default status service has no accounts, signup, admin API, or execution
path. It does not launch the child runtime or forward credentials to it.
There are no default administrator credentials.

Upstream supports password accounts, Cloudflare Access, and verified-email
authentication Gatekeepers (see `vendor/cloudflare-os/docs/public-server.md`
and `oauth-signin.md`). Those are capabilities, **not a configured enterprise
identity solution on this Replit instance**. Generic Google/GitHub login alone
does not enforce an enterprise tenant.

Before enabling production: configure a verified identity provider and explicit
organization membership policy; disable public signup/password fallback;
verify issuer, audience, signature, expiry, nonce and callback origins; reject
spoofed identity headers; assign admin roles by stable verified identity, not
username; test deprovisioning/session revocation, least-privilege sharing, audit
events, and HTTP **and** WebSocket authorization. Replit private app visibility
can add an outer restriction but is not a substitute for those application
checks. Do not map an arbitrary inbound email header to an OS account.
No provider credentials were requested and no SSO connection is claimed.

## Supervision and readiness

For a future supported single-writer service, Reserved VM is the relevant
Replit compute option, not the workspace workflow or static frontend hosting.
Use a pinned, built standalone workerd configuration; no build watchers or
Wrangler dev orchestration in the run path. Bind the public adapter to `PORT`,
keep internal sockets private, forward only sanitized headers, and authorize
WebSocket upgrades. Supervise the process tree: unexpected exit must fail the
service; restart with bounded backoff; stop admitting traffic on shutdown,
drain sessions, flush/checkpoint storage, and enforce a termination deadline.
Replit's process lifecycle is not a reason to install systemd in the app.

Readiness must check the actual backend, schema/storage writability, required
bindings and identity configuration, with timeouts. An HTML `id="root"` check
proves only that the frontend loads. Separate liveness, readiness and
production suitability; never return production-ready because the port opens.
Exercise child crashes, hangs, signals, restarts and cold restore before
declaring this operational. The default status server implements only its own
liveness and explicitly negative readiness; it is not a supervisor for an OS.

## Untrusted generated code

The upstream gadget loader uses `globalOutbound: null` and capability bindings;
the frontend uses sandboxed iframes/CSP. Preserve those restrictions, but they
do not replace the additional host isolation workerd requires.

Do not run generated server code in Agent Foundry's Node process, use `eval`,
give the runtime ambient database/provider secrets, or enable unrestricted
network/filesystem access. A supported execution service must be separated
from the control plane and its credentials, with verified tenant boundaries,
restricted egress, CPU/memory/time limits and failure containment. No documented,
verified per-gadget sandbox mechanism has been established here. A separate
Replit app might reduce credential exposure, but is not proof of a sufficient
host security boundary. Until that is demonstrated, untrusted execution remains
disabled. Human release approval is a separate control, not a sandbox.

This workspace includes the **actual upstream Cloudflare OS project**, not a mockup or a workerd-only starter.

## Source and explicit development preview

- Source: `vendor/cloudflare-os/`
- Repository/revision/license: `scripts/cloudflare-os/source.json`
- Install and build the required frontend/storage packages: `pnpm --filter @workspace/scripts cloudflare-os:prepare`
- Default: non-executing status service at `/cloudflare-os/`
- Unsafe development only: `pnpm --filter @workspace/scripts run cloudflare-os:preview`
- Service: the Cloudflare OS managed service on the existing Agent Foundry artifact.

The upstream project keeps its own dependency workspace and lockfile. It is intentionally not merged into the outer pnpm catalog. The launcher uses the environment's pnpm with version management disabled; the upstream frozen lockfile and minimum-release-age policy remain intact.

The explicit preview requires a valid `PORT`, prepared assets, and a trusted,
restricted-access workspace. Stop the managed status workflow first to avoid a
port conflict. Never enable it on a public enterprise endpoint or with
production secrets/data. It refuses `NODE_ENV=production`; this guard is not a
security boundary against someone who controls the command/environment.
It retains upstream's development auth and isolation limitations and inherits
the invoking environment. Do not run it with Agent Foundry's database/provider
credentials. It is an experimental developer tool, not a supported service.

In that explicit mode only, the hosting adapter strips the preview prefix on requests to upstream and forwards WebSocket upgrades. The frontend uses Vite's base URL and TanStack Router's basepath. Small changes to upstream files add preview-path support, public Gatekeeper URLs, an opt-out of the build cache, and removal of the development runner's implicit `admin` username grant on Replit. Preserve the upstream license and notices when updating the source.

The upstream Vite+ build cache triggers native executable `EBUSY` errors in this environment. Preparation uses a direct Vite frontend build and invokes the pinned TypeScript native binary directly for typed-storage; startup runs Gatekeeper tasks with caching disabled. This changes build orchestration, not the application runtime or the frozen dependency versions.

## What this is not

The opt-in preview is a **development preview hosted on Replit**, using the upstream multi-worker Wrangler runner. Upstream explicitly says its local runner is not for production; production self-hosting documentation/tooling is still in progress.

There is no Cloudflare deployment/account connection, no OpenShell gateway, and no integration yet between Cloudflare OS's accounts/storage and Agent Foundry's PostgreSQL data.

Runtime data is stored in the upstream `.wrangler` directory, excluded from Git and publishing. Do not treat that filesystem state as durable production storage. Production requires an explicitly designed persistence, backup, authentication, isolation, and workerd supervision strategy.

No development auto-login or default administrator credentials are enabled by this adapter. External Gatekeepers and model providers require separate configuration. Browser rendering, third-party OAuth, and arbitrary generated gadget execution must be independently verified before being offered as supported enterprise features.

## Verification

`pnpm --filter @workspace/scripts run cloudflare-os:test` checks the default-deny
policy, production preflight rejection, live/ready distinction, blocked HTTP
mutations and WebSocket upgrades. These checks do **not** verify production
durability, SSO, sandbox escape resistance, or disaster recovery. The production
preflight is expected to fail until those blockers are actually resolved.
