import { z } from "zod/v4";
import { open } from "node:fs/promises";
import { createHash } from "node:crypto";
import { BlockList, isIP } from "node:net";

const text = z.string().trim().min(1).max(500);
export const discoveryApprovalSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,80}$/),
  layer: z.enum(["openmetadata-interface", "catalogued-server"]),
  instanceId: text,
  // Identity of a metadata record, NOT an entry in the community directory.
  catalogueRecordId: text.nullable(),
  endpoint: z.string().url().max(2000),
  deployedVersion: text,
  protocolVersion: z.enum(["2025-03-26", "2025-06-18"]),
  transport: z.literal("streamable-http"),
  evidenceDocumentIds: z.array(z.number().int().positive()).min(1).max(20),
  evidenceRevision: text,
  credentialSecretRef: z.string().regex(/^secret:\/\/MCP_DISCOVERY_[A-Z0-9_]+$/),
  approvedBy: text,
  approvedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  workspaceId: text,
  userId: text,
}).superRefine((value, ctx) => {
  if ((value.layer === "catalogued-server") !== (value.catalogueRecordId !== null)) {
    ctx.addIssue({ code: "custom", message: "Catalogue record identity must match the MCP layer." });
  }
});
export type DiscoveryApproval = z.infer<typeof discoveryApprovalSchema>;
export const discoveryPolicySchema = z.strictObject({
  version: z.literal("1"),
  approvals: z.array(discoveryApprovalSchema).max(100),
}).refine(value => new Set(value.approvals.map(a => a.id)).size === value.approvals.length, "Duplicate approval IDs");

export async function loadDiscoveryPolicy() {
  // Operator-controlled file only. No web endpoint can write approvals or choose this path.
  const path = process.env.MCP_DISCOVERY_POLICY_FILE;
  if (!path) return { version: "1" as const, approvals: [], revision: "disabled" };
  const file = await open(path, "r");
  try {
    const before = await file.stat({ bigint: true });
    if (before.size > 128n * 1024n) throw new Error("Invalid discovery policy");
    const bytes = await file.readFile();
    const after = await file.stat({ bigint: true });
    if (bytes.length > 128 * 1024 || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) {
      throw new Error("Discovery policy changed during read");
    }
    // Removing and restoring the same approval must not resurrect cached evidence.
    // Include file identity/timestamps, not only the approval's JSON contents.
    const revision = createHash("sha256").update(bytes)
      .update(`${after.dev}:${after.ino}:${after.mtimeNs}:${after.ctimeNs}`).digest("hex");
    return { ...discoveryPolicySchema.parse(JSON.parse(bytes.toString("utf8"))), revision };
  } finally {
    await file.close();
  }
}

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["168.63.129.16", 32],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001::", 23, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
blocked.addSubnet("3fff::", 20, "ipv6");

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export function approvedUrl(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search ||
      (url.port && url.port !== "443") || isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
      !url.hostname.includes(".") || url.hostname.endsWith(".") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)) {
    throw new Error("Endpoint blocked by egress policy");
  }
  return url;
}

export function approvalIsCurrent(approval: DiscoveryApproval, now = Date.now()) {
  return Date.parse(approval.approvedAt) <= now &&
    Date.parse(approval.expiresAt) > now &&
    Date.parse(approval.expiresAt) > Date.parse(approval.approvedAt);
}
