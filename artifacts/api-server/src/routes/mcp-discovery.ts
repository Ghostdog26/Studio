import { Router, type IRouter, type Request } from "express";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, enterpriseGrantsTable, enterpriseDocumentGrantsTable, knowledgeDocumentsTable } from "@workspace/db";
import { ListMcpDiscoveryEvidenceResponse, RefreshMcpDiscoveryEvidenceResponse } from "@workspace/api-zod";
import { mcpDiscoveryStatusSchema } from "@workspace/agent-runtime/openmetadata-contract";
import { loadDiscoveryPolicy, approvalIsCurrent, approvedUrl, type DiscoveryApproval } from "../lib/mcp-discovery-policy";
import { discoverMcp, networkExchange, DiscoveryFailure, type DiscoveryInventory } from "../lib/mcp-discovery-client";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Grant = typeof enterpriseGrantsTable.$inferSelect;
type Evidence = {
  status: "unknown" | "denied" | "verified";
  reason: string;
  checkedAt: string;
  expiresAt: string;
  inventory: DiscoveryInventory | null;
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

async function scopeFor(approval: DiscoveryApproval, grant: Grant) {
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
  return digest({ approval, grant, documents });
}

export function createMcpDiscoveryRouter(
  runDiscovery: (approval: DiscoveryApproval, signal: AbortSignal) => Promise<DiscoveryInventory> = async (approval, signal) => {
    const credential = process.env[approval.credentialSecretRef.slice("secret://".length)];
    if (!credential || /[\r\n]/.test(credential)) throw new DiscoveryFailure("remote-denied");
    return discoverMcp(approval, networkExchange(approval, credential, signal));
  },
): IRouter {
const router: IRouter = Router();
const evidence = new Map<string, Evidence>();
const attempts = new Map<string, number>();
let active = 0;
const inFlight = new Set<string>();

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
      !key ? "Current evidence-document permission is required." : saved?.reason ?? "No discovery has been performed.",
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
    const grant = await authenticate(req);
    if (!grant) { res.status(401).json({ error: "An initiating-user scoped enterprise capability is required." }); return; }
    const policy = await loadDiscoveryPolicy();
    const approvals = policy.approvals.filter(a => a.workspaceId === grant.workspaceId && a.userId === grant.userId);
    const id = req.params.id;
    if (req.method === "GET") {
      if (id) { res.sendStatus(405); return; }
      const results = [];
      for (const approval of approvals) results.push(report(approval, await scopeFor(approval, grant)));
      res.json(ListMcpDiscoveryEvidenceResponse.parse({ mode: "discovery-only", results })); return;
    }
    const emptyBody = req.body === undefined || (req.body !== null && typeof req.body === "object" &&
      !Array.isArray(req.body) && Object.keys(req.body).length === 0);
    if (!id || !/^[a-z0-9-]{1,80}$/.test(id) || !emptyBody || Object.keys(req.query).length) {
      res.status(400).json({ error: "Use an approved server ID and an empty body; arbitrary RPC and endpoints are forbidden." }); return;
    }
    const approval = approvals.find(a => a.id === id);
    if (!approval) { res.status(403).json({ status: "denied", error: "No operator approval for this initiating user and endpoint." }); return; }
    const key = await scopeFor(approval, grant);
    if (!key) { res.status(403).json(report(approval, null)); return; }
    const now = Date.now();
    for (const [k, until] of attempts) if (until <= now) attempts.delete(k);
    const rateKey = digest({ workspaceId: grant.workspaceId, userId: grant.userId });
    if (inFlight.has(rateKey) || active >= 4 || (attempts.get(rateKey) ?? 0) > now || attempts.size >= 1000) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({ error: "Discovery capacity or per-user request limit reached." }); return;
    }
    attempts.set(rateKey, now + 60_000);
    inFlight.add(rateKey); active++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let result: Evidence;
    try {
      const inventory = await runDiscovery(approval, controller.signal);
      result = {
        status: "verified", reason: "Authenticated initialization and complete supported capability lists observed; not invocation approval.",
        checkedAt: new Date().toISOString(),
        expiresAt: new Date(Math.min(Date.now() + 5 * 60_000, Date.parse(approval.expiresAt))).toISOString(),
        inventory,
      };
    } catch (error) {
      const reason = error instanceof DiscoveryFailure ? error.reason : "discovery-failed";
      result = {
        status: reason === "remote-denied" || reason === "network-policy" ? "denied" : "unknown",
        reason, checkedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), inventory: null,
      };
    } finally {
      clearTimeout(timer); inFlight.delete(rateKey); active--;
    }
    // Recheck revocation, permissions, evidence edits and operator policy after network I/O.
    const currentGrant = await authenticate(req);
    const currentApproval = (await loadDiscoveryPolicy()).approvals.find(a => a.id === id);
    if (!currentGrant || !currentApproval || await scopeFor(currentApproval, currentGrant) !== key) {
      evidence.delete(key);
      res.status(403).json({ status: "denied", error: "Discovery authorization changed; results discarded." }); return;
    }
    if (evidence.size >= 1000) evidence.delete(evidence.keys().next().value!);
    evidence.set(key, result);
    res.json(RefreshMcpDiscoveryEvidenceResponse.parse(report(currentApproval, key)));
  } catch {
    // Do not log upstream data, secret references or credential-bearing errors.
    res.status(503).json({ status: "denied", error: "Discovery policy or authorization evidence is unavailable; no network fallback." });
  }
});

return router;
}
export default createMcpDiscoveryRouter();
