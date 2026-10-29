# Disposable discovery infrastructure rehearsal

From the workspace root:

```sh
pnpm --filter @workspace/api-server discovery:rehearse --disposable-local-postgres
```

Requires Node, pnpm and the PostgreSQL `initdb`, `postgres` and `pg_ctl`
executables on `PATH`, with a non-root user able to create a temporary cluster.
Allow about a minute, including setup. The command fails without the explicit
`--disposable-local-postgres` argument.

The runner creates a fresh PostgreSQL cluster in a temporary directory, binds it
only to loopback on a temporary port, pushes the workspace schema, installs the
real invalidation triggers, and bundles/runs the integration tests. It does not
read or reuse the project's database connection, policy, or credentials. Child
processes receive a minimal environment and a generated disposable database URL.
All discovery transport is injected fictional inventory; no enterprise endpoint,
credential exchange, DNS resolution or MCP network request is performed.

The opt-in test checks:

- Three separate Node API processes share the four-slot concurrency cap.
- `SIGKILL` during in-flight discovery leaves the committed lease occupied.
- A surviving process reclaims all four slots after real database time passes
  the 30-second lease expiry, without rewriting stored deadlines or mocking time.
- A `SIGSTOP`/`SIGCONT` worker cannot publish stale evidence or release a
  successor's slot.
- Immediate shutdown of the private PostgreSQL server makes new admission,
  reads, refresh and in-flight completion fail closed.
- The same surviving API processes/pools reconnect after PostgreSQL crash
  recovery, retain shared cooldowns and the global minute budget, and successfully
  publish only fresh discovery.
- The existing deterministic integration tests still pass.

The worker processes, bundled files and entire database cluster are cleaned up on
success or failure. The runner handles interruption and bounds the test process
group's lifetime. No destructive command accepts a caller-supplied database URL
or cluster path. The test additionally checks the temporary path, database URL,
PostgreSQL data directory and database user before stopping the private server.

Ordinary execution of `mcp-discovery.integration.test.ts` skips the infrastructure
test unless invoked with the runner's private environment. Do not set that
environment yourself or point any rehearsal at an existing installation.

This rehearses database disconnect/reconnect and local crash recovery, not
promotion of a physical standby or a particular managed database provider's
failover mechanism.
