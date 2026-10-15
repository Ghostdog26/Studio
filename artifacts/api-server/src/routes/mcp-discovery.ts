import { Router, type IRouter, type Request } from "express";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, enterpriseGrantsTable, enterpriseDocumentGrantsTable, knowledgeDocumentsTable } from "@workspace/db";
import { ListMcpDiscoveryEvidenceResponse, RefreshMcpDiscoveryEvidenceResponse } from "@workspace/api-zod";
import { mcpDiscoveryStatusSchema } from "@workspace/agent-runtime/openmetadata-contract";
import { loadDiscoveryPolicy, approvalIsCurrent, approvedUrl, type DiscoveryApproval } from "../lib/mcp-discovery-policy";
import { discoverMcp, networkExchange, DiscoveryFailure, type DiscoveryInventory } from "../lib/mcp-discovery-client";
import { createDiscoveryCoordinator, type DiscoveryCoordinator } from "../lib/mcp-discovery-coordination";
import {
  BeginMcpDiscoveryOAuthBody, BeginMcpDiscoveryOAuthResponse,
  CompleteMcpDiscoveryOAuthBody, CompleteMcpDiscoveryOAuthResponse,
  RefreshMcpDiscoveryOAuthBody, RefreshMcpDiscoveryOAuthResponse,
  RevokeMcpDiscoveryOAuthBody, RevokeMcpDiscoveryOAuthResponse,
} from "@workspace/api-zod";
import { DiscoveryOAuth } from "../lib/mcp-discovery-oauth";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Grant = typeof enterpriseGrantsTable.$inferSelect;
type Evidence = {
  status: "unknown" | "denied" | "verified";
  reason: string;
  checkedAt: string;
  expiresAt: string;
  inventory: DiscoveryInventory | null;
  revision: string;
  bytes: number;
};

async function authenticate(req: Request) {
  const token = req.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return null;
  const [grant] = await db.select().from(enterpriseGrantsTable).where(and(
    eq(enterpriseGrantsTable.tokenHash, createHash("sha256").update(token).digest("hex")),
    eq(enterpriseGrantsTable.enabled, true),
  ));
  return grant ?? null;
}

async function scopeFor(approval: DiscoveryApproval, grant: Grant, revision: string) {
  if (!approvalIsCurrent(approval) || approval.workspaceId !== grant.workspaceId ||
      approval.userId !== grant.userId) return null;
  approvedUrl(approval.endpoint);
  const documents = await db.select({
    documentId: enterpriseDocumentGrantsTable.documentId,
    content: knowledgeDocumentsTable.content,
    updatedAt: knowledgeDocumentsTable.updatedAt,
  }).from(enterpriseDocumentGrantsTable)
    .innerJoin(knowledgeDocumentsTable, eq(knowledgeDocumentsTable.id, enterpriseDocumentGrantsTable.documentId))
    .where(and(
      eq(enterpriseDocumentGrantsTable.workspaceId, grant.workspaceId),
      eq(enterpriseDocumentGrantsTable.userId, grant.userId),
      inArray(enterpriseDocumentGrantsTable.documentId, approval.evidenceDocumentIds),
    ));
  if (new Set(documents.map(d => d.documentId)).size !== new Set(approval.evidenceDocumentIds).size) return null;
  documents.sort((a, b) => a.documentId - b.documentId);
  return digest({ approval, grant, documents, revision });
}

export function createMcpDiscoveryRouter(
  runDiscovery: (approval: DiscoveryApproval, signal: AbortSignal, oauthCredential?: string) => Promise<DiscoveryInventory> = async (approval, signal, oauthCredential) => {
    const credential = approval.oauth ? oauthCredential :
      process.env[approval.credentialSecretRef!.slice("secret://".length)];
    if (!credential || /[\r\n]/.test(credential)) throw new DiscoveryFailure("remote-denied");
    return discoverMcp(approval, networkExchange(approval, credential, signal));
  },
  coordinator: DiscoveryCoordinator = createDiscoveryCoordinator(),
  oauth = new DiscoveryOAuth(),
): IRouter {
const router: IRouter = Router();
const evidence = new Map<string, Evidence>();
let evidenceBytes = 0;
function remove(key: string) {
  evidenceBytes -= evidence.get(key)?.bytes ?? 0;
  evidence.delete(key);
}
function prune(revision?: string) {
  for (const [key, saved] of evidence) {
    if (revision !== undefined && saved.revision !== revision) { remove(key); continue; }
    if (Date.parse(saved.expiresAt) <= Date.now()) {
      // Keep only the bounded status metadata so the UI can still report "stale".
      evidenceBytes -= saved.bytes;
      saved.inventory = null;
      saved.bytes = 0;
    }
  }
}
// Idle replicas also drop expired payloads. The timer does not keep a worker alive.
const cleanup = setInterval(() => prune(), 30_000);
cleanup.unref();

function evidenceKey(approval: DiscoveryApproval, binding: string | null) {
  if (!binding || !approval.oauth) return binding;
  try {
    oauth.access(approval, binding);
    return digest({ binding, credentialReference: oauth.revision(binding) });
  } catch { return null; }
}

router.all("/enterprise/mcp-discovery/:id/oauth/:action", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") { res.sendStatus(405); return; }
  try {
    // The shared monotonic epoch must be captured before any authorization reads.
    const revision = await coordinator.revision();
    const grant = await authenticate(req);
    if (!grant) { res.status(401).json({ error: "An initiating-user scoped enterprise capability is required." }); return; }
    const { id, action } = req.params;
    const policy = await loadDiscoveryPolicy();
    const scopeRevision = `${revision}:${policy.revision}`;
    prune(scopeRevision);
    const approval = policy.approvals.find(a =>
      a.id === id && a.workspaceId === grant.workspaceId && a.userId === grant.userId);
    const binding = approval ? await scopeFor(approval, grant, scopeRevision) : null;
    if (!approval?.oauth || !binding) { res.status(403).json({ error: "Current user-bound OAuth approval and evidence permission required." }); return; }
    const schemas = {
      authorize: BeginMcpDiscoveryOAuthBody, callback: CompleteMcpDiscoveryOAuthBody,
      refresh: RefreshMcpDiscoveryOAuthBody, revoke: RevokeMcpDiscoveryOAuthBody,
    };
    if (typeof action !== "string" || !Object.hasOwn(schemas, action)) { res.sendStatus(404); return; }
    const input = schemas[action as keyof typeof schemas].strict().safeParse(req.body);
    if (!input.success || Object.keys(req.query).length) { res.status(400).json({ error: "Invalid OAuth lifecycle request." }); return; }
    const userKey = digest({ workspaceId: grant.workspaceId, userId: grant.userId });
    const rateKey = digest({ workspaceId: grant.workspaceId, userId: grant.userId, oauthAction: action });
    // Lifecycle actions share global capacity and same-user concurrency with discovery,
    // while preserving one admitted attempt per user per lifecycle phase per minute.
    const lease = await coordinator.acquire(userKey, rateKey);
    if (!lease && action !== "revoke") {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Discovery capacity or shared action limit reached." }); return;
    }
    const controller = new AbortController();
    // Local revocation remains possible when shared outbound capacity is exhausted.
    if (!lease) controller.abort();
    const timer = setTimeout(() => controller.abort(), 20000);
    const oldEvidenceKey = evidenceKey(approval, binding);
    try {
      let result: unknown;
      let live = false;
      try {
        if ((lease && lease.revision !== revision) || await coordinator.revision() !== revision ||
            (await loadDiscoveryPolicy()).revision !== policy.revision) {
          throw new DiscoveryFailure("remote-denied");
        }
        if (action === "authorize") result = BeginMcpDiscoveryOAuthResponse.parse(oauth.begin(approval, binding));
        else if (action === "callback") result = CompleteMcpDiscoveryOAuthResponse.parse(
          await oauth.complete(approval, binding, CompleteMcpDiscoveryOAuthBody.parse(input.data), controller.signal));
        else if (action === "refresh") result = RefreshMcpDiscoveryOAuthResponse.parse(
          await oauth.refresh(approval, binding, RefreshMcpDiscoveryOAuthBody.parse(input.data).credentialReference, controller.signal));
        else result = RevokeMcpDiscoveryOAuthResponse.parse(
          await oauth.revoke(approval, binding, RevokeMcpDiscoveryOAuthBody.parse(input.data).credentialReference, controller.signal));
        if (oldEvidenceKey && action !== "authorize") remove(oldEvidenceKey);
        const currentGrant = await authenticate(req);
        const currentPolicy = await loadDiscoveryPolicy();
        const currentApproval = currentPolicy.approvals.find(a => a.id === id);
        if (!currentGrant || !currentApproval ||
            await scopeFor(currentApproval, currentGrant, `${revision}:${currentPolicy.revision}`) !== binding ||
            await coordinator.revision() !== revision) {
          throw new DiscoveryFailure("remote-denied");
        }
      } finally {
        clearTimeout(timer);
        live = lease ? await coordinator.finish(lease) : true;
      }
      if (!live) throw new DiscoveryFailure("remote-denied");
      res.json(result);
    } catch {
      oauth.invalidate(binding);
      if (oldEvidenceKey && action !== "authorize") remove(oldEvidenceKey);
      res.status(403).json({ error: "OAuth credential or authorization rejected; restart authorization if necessary." });
    }
  } catch {
    res.status(503).json({ error: "Discovery policy or authorization evidence is unavailable." });
  }
});

function report(approval: DiscoveryApproval, key: string | null) {
  const saved = key ? evidence.get(key) : undefined;
  const expired = !approvalIsCurrent(approval) || (saved && Date.parse(saved.expiresAt) <= Date.now());
  const status = expired ? "stale" : !key ? "denied" : saved?.status ?? "unknown";
  return {
    id: approval.id, layer: approval.layer, instanceId: approval.instanceId,
    catalogueRecordId: approval.catalogueRecordId, endpoint: approval.endpoint,
    deployedVersion: approval.deployedVersion, transport: approval.transport,
    protocolVersion: approval.protocolVersion, evidenceRevision: approval.evidenceRevision,
    permissionRevision: key, status: mcpDiscoveryStatusSchema.parse(status),
    reason: expired ? "Approval or discovery evidence expired; rediscovery required." :
      !key ? "Current evidence-document permission and, for OAuth approvals, a current user credential are required." : saved?.reason ?? "No discovery has been performed.",
    checkedAt: saved?.checkedAt ?? null, expiresAt: saved?.expiresAt ?? approval.expiresAt,
    inventory: status === "verified" ? saved?.inventory ?? null : null,
    approvedForInvocation: false, descriptionsAreUntrusted: true,
  };
}

router.all("/enterprise/mcp-discovery{/:id}", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") { res.sendStatus(405); return; }
  // An explicit per-user approval below is a separate discovery grant; generation tool
  // permissions, shared demo membership and bridge assertions cannot authorize discovery.
  try {
    // Capture the invalidation epoch BEFORE reading any authorization rows.
    // Otherwise a revoke between authentication and this read could use an old grant
    // with a new epoch and still start network I/O.
    const revision = await coordinator.revision();
    const grant = await authenticate(req);
    if (!grant) { res.status(401).json({ error: "An initiating-user scoped enterprise capability is required." }); return; }
    const policy = await loadDiscoveryPolicy();
    const scopeRevision = `${revision}:${policy.revision}`;
    // A revoked/restored grant or operator policy must never resurrect an old inventory.
    prune(scopeRevision);
    const approvals = policy.approvals.filter(a => a.workspaceId === grant.workspaceId && a.userId === grant.userId);
    const id = req.params.id;
    if (req.method === "GET") {
      if (id) { res.sendStatus(405); return; }
      const scopes = [];
      for (const approval of approvals) scopes.push({ approval, key: evidenceKey(approval, await scopeFor(approval, grant, scopeRevision)) });
      if (await coordinator.revision() !== revision || (await loadDiscoveryPolicy()).revision !== policy.revision) {
        for (const key of evidence.keys()) remove(key);
        res.status(403).json({ status: "denied", error: "Discovery authorization changed; results discarded." }); return;
      }
      const results = scopes.map(({ approval, key }) => report(approval, key));
      res.json(ListMcpDiscoveryEvidenceResponse.parse({ mode: "discovery-only", results })); return;
    }
    const emptyBody = req.body === undefined || (req.body !== null && typeof req.body === "object" &&
      !Array.isArray(req.body) && Object.keys(req.body).length === 0);
    if (!id || !/^[a-z0-9-]{1,80}$/.test(id) || !emptyBody || Object.keys(req.query).length) {
      res.status(400).json({ error: "Use an approved server ID and an empty body; arbitrary RPC and endpoints are forbidden." }); return;
    }
    const approval = approvals.find(a => a.id === id);
    if (!approval) { res.status(403).json({ status: "denied", error: "No operator approval for this initiating user and endpoint." }); return; }
    const binding = await scopeFor(approval, grant, scopeRevision);
    const key = evidenceKey(approval, binding);
    if (!key) { res.status(403).json(report(approval, null)); return; }
    const rateKey = digest({ workspaceId: grant.workspaceId, userId: grant.userId });
    const lease = await coordinator.acquire(rateKey);
    if (!lease) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Discovery capacity or shared request limit reached." }); return;
    }
    if (lease.revision !== revision) {
      await coordinator.finish(lease);
      res.status(403).json({ status: "denied", error: "Discovery authorization changed; results discarded." }); return;
    }
    // A failed/expired refresh must not leave an earlier verified inventory available.
    remove(key);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let result: Evidence;
    try {
      // Enforce the deadline even if an injected/buggy transport ignores cancellation.
      const inventory = await Promise.race([
        runDiscovery(approval, controller.signal, approval.oauth ? oauth.access(approval, binding!) : undefined),
        new Promise<never>((_resolve, reject) => controller.signal.addEventListener("abort",
          () => reject(new DiscoveryFailure("discovery-failed")), { once: true })),
      ]);
      controller.signal.throwIfAborted();
      const bytes = Buffer.byteLength(JSON.stringify(inventory));
      if (bytes > 1024 * 1024) throw new DiscoveryFailure("incomplete-discovery");
      result = {
        status: "verified", reason: "Authenticated initialization and complete supported capability lists observed; not invocation approval.",
        checkedAt: new Date().toISOString(),
        expiresAt: new Date(Math.min(Date.now() + 5 * 60_000, Date.parse(approval.expiresAt))).toISOString(),
        inventory, bytes, revision: scopeRevision,
      };
    } catch (error) {
      if (approval.oauth && error instanceof DiscoveryFailure && error.reason === "remote-denied") oauth.invalidate(binding!);
      const reason = error instanceof DiscoveryFailure ? error.reason : "discovery-failed";
      result = {
        status: reason === "remote-denied" || reason === "network-policy" ? "denied" : "unknown",
        reason, checkedAt: new Date().toISOString(),
        expiresAt: new Date(Math.min(Date.now() + 60_000, Date.parse(approval.expiresAt))).toISOString(),
        inventory: null, bytes: 0, revision: scopeRevision,
      };
    } finally {
      clearTimeout(timer);
    }
    // Recheck revocation, permissions, evidence edits and operator policy after network I/O.
    let currentApproval: DiscoveryApproval | undefined;
    let authorized = false;
    let live = false;
    try {
      const currentGrant = await authenticate(req);
      const currentPolicy = await loadDiscoveryPolicy();
      currentApproval = currentPolicy.approvals.find(a => a.id === id);
      authorized = !!currentGrant && !!currentApproval &&
        evidenceKey(currentApproval, await scopeFor(currentApproval, currentGrant, `${revision}:${currentPolicy.revision}`)) === key;
    } finally {
      // An expired lease cannot publish, and a late completion cannot release a successor.
      live = await coordinator.finish(lease);
    }
    if (!authorized || !live || !currentApproval) {
      remove(key);
      res.status(403).json({ status: "denied", error: "Discovery authorization or lease changed; results discarded." }); return;
    }
    prune(scopeRevision);
    remove(key);
    while (evidence.size >= 1000 || evidenceBytes + result.bytes > 8 * 1024 * 1024) remove(evidence.keys().next().value!);
    evidence.set(key, result);
    evidenceBytes += result.bytes;
    res.json(RefreshMcpDiscoveryEvidenceResponse.parse(report(currentApproval, key)));
  } catch {
    // Do not log upstream data, secret references or credential-bearing errors.
    res.status(503).json({ status: "denied", error: "Discovery policy or authorization evidence is unavailable; no network fallback." });
  }
});

return router;
}
export default createMcpDiscoveryRouter();
