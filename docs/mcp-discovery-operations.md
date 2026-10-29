# Discovery protection operations

## Monitoring channel

The API's existing Pino operations log is the monitoring channel. Production
emits newline-delimited JSON to stdout; development displays the same fields via
pino-pretty. No third-party monitoring service, public metrics route or external
credential is required. These are log-based metrics and alert events, not an
out-of-band paging integration. An operator must connect the production log
collector to their notification destination if paging is required.

Keep `LOG_LEVEL=info` (the default) to retain metrics. `warn` retains warning and
critical alerts only; `error` retains critical alerts only; `silent` disables
this monitoring. Configure the log collector to retain structured fields.

## Metric and alert rules

Select `event=mcp_discovery_metric`, `metric=mcp_discovery_events`. Sum `delta`
over a time window, grouping only by `signal` and `operation` across all replicas.
`processTotal` is diagnostic only: it resets on restart and must not be summed as
a delta or treated as a durable/global counter. Expiry observations are counted
when a subsequent acquire/finish removes expired leases, not by a polling job.
Failed transactions count as failures, not committed denials or expirations.
For simultaneous denials the first applicable reason is counted: shared slots,
same-user concurrency, same-user cooldown, rate-state capacity, shared rate.

| Signal | Meaning | Alert |
| --- | --- | --- |
| `shared_capacity_denied` | Four shared outbound leases occupied | Warning |
| `user_concurrency_denied` | Same user already holds a lease | Metric only |
| `user_rate_denied` | Same discovery/action scope is cooling down | Metric only |
| `shared_rate_denied` | Shared 60/minute admission budget exhausted | Warning |
| `rate_state_capacity_denied` | Bounded shared cooldown storage full | Warning |
| `database_failure` | Coordination database operation failed | Critical |
| `lock_timeout` | PostgreSQL SQLSTATE 55P03, including wrapped errors | Critical |
| `statement_timeout` | PostgreSQL SQLSTATE 57014 (statement cancelled) | Critical |
| `protection_unavailable` | Required coordinator row/invalidation protection absent | Critical |
| `route_protection_unavailable` | Route cannot establish policy/authorization evidence | Critical |
| `lease_expired` | Lease expired before release, observed on next locked operation | Warning |
| `authorization_change_discard` | Authorization changed; cached evidence or in-flight results discarded | Metric only |

Operations are limited to `revision`, `acquire`, `finish`, `list`, `refresh`,
and `oauth`. A coordination failure is recorded at its source; routes do not
count the same typed failure again. Policy/authorization-read failures outside
the coordinator are deliberately grouped under `route_protection_unavailable`,
not falsely diagnosed as a specific database or policy problem.

Alert events use `event=mcp_discovery_alert`, `severity=critical|warning`, `signal`,
`operation`, and a static runbook path. The first alert is immediate. Repeated
alerts for the same signal/operation are limited to one per minute per process;
all metric deltas remain available. Configure the collector to notify on any
critical event immediately and group warnings over five minutes. Deduplicate
alerts across replicas using signal/operation, not request or user identifiers.
Recovery is not inferred from process restart or lack of traffic. Check the
dependency and a deliberately initiated authorized request before resolving an
incident. There is no background discovery, retry, external probe or recovery
claim.

## Operator response

1. **Database/timeout/protection critical:** check database reachability, pool
   saturation, blocking transactions, and the installed discovery coordination
   row and invalidation triggers. Restore the protection; never bypass it,
   delete active leases, reset rate budgets, or disable invalidation to recover.
2. **Route protection critical:** check local policy readability/validity and
   authorization storage availability using privileged operator tools. Do not
   copy the policy, SQL errors, capability tokens or upstream payloads into logs.
3. **Capacity/rate warning:** inspect aggregate demand and database contention.
   Limits remain shared across replicas; adding replicas does not add capacity.
   A 429 is not a database outage and must not cause automatic rediscovery.
4. **Expired lease warning:** inspect worker restarts and discovery duration.
   Expiration safely reclaims capacity and rejects late results. Do not rerun
   discovery without the initiating user's explicit request.
5. **Authorization discards:** normally expected during permission changes.
   Investigate a sustained increase against operator change activity without
   adding identity/policy labels. Revoked/restored permissions cannot resurrect
   old discovery results.

All discovery and OAuth responses remain `Cache-Control: no-store`, including
429, 403 and 503 failures. Database and lock failures remain fail-closed with no
local admission fallback. Telemetry contains no identities (including hashes),
policy contents, inventory, endpoints, credentials, secret references, lease
IDs, database errors, SQL, request IDs or request log context. Log aggregation
must not enrich these events with sensitive request fields.
