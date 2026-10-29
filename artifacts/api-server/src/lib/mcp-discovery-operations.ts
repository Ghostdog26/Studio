import { logger } from "./logger";

// This allowlist is the entire telemetry contract. Never add request context,
// error messages, hashes, policy/lease identifiers or upstream data here.
export const discoverySignals = [
  "shared_capacity_denied", "user_concurrency_denied", "user_rate_denied",
  "shared_rate_denied", "rate_state_capacity_denied",
  "database_failure", "lock_timeout", "statement_timeout", "protection_unavailable",
  "lease_expired", "authorization_change_discard", "route_protection_unavailable",
] as const;
export type DiscoverySignal = typeof discoverySignals[number];
export type DiscoveryOperation = "revision" | "acquire" | "finish" | "list" | "refresh" | "oauth";
type Sink = Pick<typeof logger, "info" | "warn" | "error">;
const outageSignals = new Set<DiscoverySignal>([
  "database_failure", "lock_timeout", "statement_timeout", "protection_unavailable",
  "route_protection_unavailable",
]);
const warningSignals = new Set<DiscoverySignal>([
  "shared_capacity_denied", "shared_rate_denied", "rate_state_capacity_denied", "lease_expired",
]);

export function createDiscoveryOperations(sink: Sink = logger, now = Date.now) {
  const counters = new Map<string, number>();
  const alertedAt = new Map<string, number>();
  return {
    record(signal: DiscoverySignal, operation: DiscoveryOperation, amount = 1) {
      // Runtime allowlists prevent accidental high-cardinality/sensitive labels,
      // including from JS callers. Monitoring must never break a protected request.
      if (!discoverySignals.includes(signal) ||
          !["revision", "acquire", "finish", "list", "refresh", "oauth"].includes(operation) ||
          !Number.isSafeInteger(amount) || amount < 1) return;
      const key = `${signal}:${operation}`;
      const total = (counters.get(key) ?? 0) + amount;
      counters.set(key, total);
      try {
        sink.info({
          event: "mcp_discovery_metric", metric: "mcp_discovery_events",
          signal, operation, delta: amount, processTotal: total,
        }, "Discovery protection metric");
        const severity = outageSignals.has(signal) ? "critical" : warningSignals.has(signal) ? "warning" : null;
        const time = now();
        if (severity && (!alertedAt.has(key) || time - alertedAt.get(key)! >= 60_000)) {
          alertedAt.set(key, time);
          sink[severity === "critical" ? "error" : "warn"]({
            event: "mcp_discovery_alert", signal, operation, severity,
            runbook: "docs/mcp-discovery-operations.md",
          }, "Discovery protection requires operator attention");
        }
      } catch { /* A log sink failure must not change admission or publication. */ }
    },
  };
}

export const discoveryOperations = createDiscoveryOperations();

export class DiscoveryCoordinationFailure extends Error {
  constructor() {
    super("Discovery coordinator unavailable");
  }
}

// Drizzle wraps PG errors in cause. Read only SQLSTATE, never messages/SQL/params.
export function coordinationFailureSignal(error: unknown): DiscoverySignal {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (code === "55P03") return "lock_timeout";
    if (code === "57014") return "statement_timeout";
    current = cause;
  }
  return error instanceof DiscoveryCoordinationFailure ? "protection_unavailable" : "database_failure";
}
