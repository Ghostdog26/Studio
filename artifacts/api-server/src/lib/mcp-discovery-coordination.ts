import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { z } from "zod/v4";
import {
  discoveryOperations, coordinationFailureSignal, DiscoveryCoordinationFailure,
  type DiscoveryOperation, type DiscoverySignal,
} from "./mcp-discovery-operations";

const stateSchema = z.object({
  leases: z.array(z.object({ id: z.string(), user: z.string(), until: z.number() })).max(4),
  attempts: z.array(z.object({ user: z.string(), until: z.number() })).max(1000),
  globalAttempts: z.array(z.number()).max(60),
});
const emptyState = { leases: [], attempts: [], globalAttempts: [] };
const invalidationInstalled = sql`(SELECT count(*) FROM pg_trigger
  WHERE tgname = 'invalidate_mcp_discovery' AND tgenabled = 'O'
  AND tgrelid IN ('enterprise_grants'::regclass, 'enterprise_document_grants'::regclass, 'knowledge_documents'::regclass)) = 3`;
export type DiscoveryLease = { id: string; revision: string };
export interface DiscoveryCoordinator {
  revision(): Promise<string>;
  acquire(user: string, rateScope?: string): Promise<DiscoveryLease | null>;
  finish(lease: DiscoveryLease): Promise<boolean>;
}

// All limits use the DB clock, not replica clocks. No process-local fallback.
export function createDiscoveryCoordinator(coordinationId = "discovery"): DiscoveryCoordinator {
  async function guarded<T>(operation: DiscoveryOperation, action: () => Promise<T>) {
    try { return await action(); }
    catch (error) {
      discoveryOperations.record(coordinationFailureSignal(error), operation);
      // Do not propagate credential-bearing database errors to route loggers.
      throw new DiscoveryCoordinationFailure();
    }
  }
  async function locked<T>(operation: "acquire" | "finish",
    action: (state: z.infer<typeof stateSchema>, now: number, revision: string,
      emit: (signal: DiscoverySignal, amount?: number) => void) => T) {
    const events: Array<{ signal: DiscoverySignal; amount: number }> = [];
    const emit = (signal: DiscoverySignal, amount = 1) => events.push({ signal, amount });
    const result = await guarded(operation, () => db.transaction(async tx => {
      await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
      await tx.execute(sql`SET LOCAL statement_timeout = '2s'`);
      const row = (await tx.execute(sql`
        SELECT state, revision::text FROM mcp_discovery_coordination
        WHERE id = ${coordinationId} AND ${invalidationInstalled} FOR UPDATE
      `)).rows[0];
      if (!row) throw new DiscoveryCoordinationFailure();
      const now = Number((await tx.execute(sql`SELECT extract(epoch FROM clock_timestamp()) * 1000 AS now`)).rows[0]!.now);
      const state = stateSchema.parse(Object.keys(row.state as object).length ? row.state : emptyState);
      const expired = state.leases.filter(l => l.until <= now).length;
      if (expired) emit("lease_expired", expired);
      state.leases = state.leases.filter(l => l.until > now);
      state.attempts = state.attempts.filter(a => a.until > now);
      state.globalAttempts = state.globalAttempts.filter(until => until > now);
      const result = action(state, now, String(row.revision), emit);
      await tx.execute(sql`UPDATE mcp_discovery_coordination SET state = ${JSON.stringify(state)}::jsonb WHERE id = ${coordinationId}`);
      return result;
    }));
    // Count only committed decisions; failed transactions have their own signal.
    for (const event of events) discoveryOperations.record(event.signal, operation, event.amount);
    return result;
  }
  return {
    async revision() {
      return guarded("revision", async () => {
        // Refuse to use evidence if invalidation triggers have not been installed.
        const result = await db.execute(sql`
          SELECT revision::text FROM mcp_discovery_coordination WHERE id = ${coordinationId}
          AND ${invalidationInstalled}
        `);
        if (!result.rows[0]) throw new DiscoveryCoordinationFailure();
        return String(result.rows[0].revision);
      });
    },
    acquire(user, rateScope = user) {
      return locked("acquire", (state, now, revision, emit) => {
        const denial = state.leases.length >= 4 ? "shared_capacity_denied" :
          state.leases.some(l => l.user === user) ? "user_concurrency_denied" :
          state.attempts.some(a => a.user === rateScope) ? "user_rate_denied" :
          state.attempts.length >= 1000 ? "rate_state_capacity_denied" :
          state.globalAttempts.length >= 60 ? "shared_rate_denied" : null;
        if (denial) { emit(denial); return null; }
        const id = randomUUID();
        state.leases.push({ id, user, until: now + 30_000 });
        state.attempts.push({ user: rateScope, until: now + 60_000 });
        state.globalAttempts.push(now + 60_000);
        return { id, revision };
      });
    },
    finish(lease) {
      return locked("finish", (state, _now, revision, emit) => {
        const valid = revision === lease.revision && state.leases.some(l => l.id === lease.id);
        if (revision !== lease.revision) emit("authorization_change_discard");
        state.leases = state.leases.filter(l => l.id !== lease.id);
        return valid;
      });
    },
  };
}
