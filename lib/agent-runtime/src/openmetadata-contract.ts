import { z } from "zod/v4";
import { OPENMETADATA_REFERENCE_VERSION, OPENMETADATA_REVISION, OPENMETADATA_REQUIREMENTS, openMetadataDocuments } from "./openmetadata-reference";

const nonempty = z.string().min(1).max(1000);
const timestamp = z.string().regex(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/);
const sourceUrl = z.string().regex(/^https:\/\/[^\s@]+$/);
// Offline snapshot contract. Even authorized snapshots do not establish live connectivity.
export const openMetadataContextSchema = z.strictObject({
  contractVersion: z.literal("1.0.0"),
  connectionState: z.literal("not-connected"),
  instance: z.strictObject({
    instanceId: nonempty, deployedRelease: nonempty,
    capabilityEvidenceDocumentId: z.number().int().positive(),
    credentialSecretRef: z.string().regex(/^secret:\/\/[A-Za-z0-9_/-]+$/).nullable(),
  }).nullable(),
  assets: z.array(z.strictObject({
    entityId: nonempty, fullyQualifiedName: nonempty,
    entityType: z.enum(["table", "apiService", "apiCollection", "apiEndpoint", "mcpService", "mcpServer"]),
    metadataVersion: nonempty.nullable(),
    provenance: z.strictObject({
      kind: z.enum(["illustrative", "authorized-snapshot"]),
      sourceUrl, sourceRevision: nonempty,
      knowledgeDocumentId: z.number().int().positive(),
      retrievedAt: timestamp, expiresAt: timestamp,
    }),
    permissionScope: z.strictObject({ workspaceId: nonempty, userId: nonempty, permissionRevision: nonempty }),
    freshness: z.enum(["unknown", "fresh", "stale", "removed", "inaccessible", "partial"]),
    owners: z.array(nonempty).nullable(), classifications: z.array(nonempty).nullable(),
    businessSemantics: z.array(nonempty).nullable(),
    // Explicitly separate metadata descriptions from live capability evidence.
    schemaDescription: z.string().max(20000).nullable(),
    apiDescription: z.string().max(20000).nullable(),
    mcpReference: z.strictObject({
      layer: z.enum(["openmetadata-interface", "catalogued-server"]),
      protocolVersion: nonempty.nullable(), transport: nonempty.nullable(),
      liveDiscovery: z.literal("unverified"), approvedForInvocation: z.literal(false),
    }).nullable(),
  })).max(100),
});
export const openMetadataProfileSchema = z.strictObject({
  id: z.literal("openmetadata"), version: z.literal(OPENMETADATA_REFERENCE_VERSION),
  sourceRevision: z.literal(OPENMETADATA_REVISION),
  state: z.literal("reference-only"), connectionState: z.literal("not-connected"),
  requirements: z.array(z.string()).min(10),
  referenceDocuments: z.array(z.strictObject({
    title: z.string(), source: z.string(), tags: z.array(z.string()), content: z.string(),
  })).length(4),
});
export const openMetadataProfile = openMetadataProfileSchema.parse({
  id: "openmetadata", version: OPENMETADATA_REFERENCE_VERSION, sourceRevision: OPENMETADATA_REVISION,
  state: "reference-only", connectionState: "not-connected",
  requirements: [...OPENMETADATA_REQUIREMENTS], referenceDocuments: openMetadataDocuments,
});

export function validateOpenMetadataContext(
  value: unknown, documentIds: number[],
  scope?: { workspaceId: string; userId: string },
): string[] {
  const parsed = openMetadataContextSchema.safeParse(value);
  if (!parsed.success) return ["Invalid OpenMetadata context contract."];
  const context = parsed.data;
  const errors: string[] = [];
  if (context.instance && !documentIds.includes(context.instance.capabilityEvidenceDocumentId)) errors.push("Unauthorized instance capability evidence.");
  for (const asset of context.assets) {
    if (!documentIds.includes(asset.provenance.knowledgeDocumentId)) errors.push("Unauthorized OpenMetadata asset evidence.");
    if (scope && (asset.permissionScope.workspaceId !== scope.workspaceId || asset.permissionScope.userId !== scope.userId)) errors.push("OpenMetadata permission scope mismatch.");
    if (asset.provenance.kind === "authorized-snapshot" && !context.instance) errors.push("Instance/release evidence required for actual assets.");
    if (asset.freshness !== "fresh" || Date.parse(asset.provenance.expiresAt) <= Date.now() ||
        Date.parse(asset.provenance.retrievedAt) > Date.now() ||
        !Number.isFinite(Date.parse(asset.provenance.expiresAt)) ||
        !Number.isFinite(Date.parse(asset.provenance.retrievedAt))) errors.push("OpenMetadata asset is not current; refresh authorized evidence before use.");
  }
  return errors;
}
