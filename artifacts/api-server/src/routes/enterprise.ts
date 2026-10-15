import { Router, type IRouter } from "express";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, enterpriseStandardsTable, enterpriseGrantsTable, enterpriseDocumentGrantsTable,
} from "@workspace/db";
import {
  generationSelectionSchema, parseStandard, validateCandidate,
} from "@workspace/agent-runtime/enterprise-standards";
import { bridgeEnvelopeSchema, enterpriseRpcSchema, verifyBridge } from "../lib/enterprise-auth";
import { queryKnowledge } from "./foundry";

const router: IRouter = Router();
export const enterpriseTools = [
  // Outbound MCP discovery has its own authenticated /enterprise/mcp-discovery API.
  // It is deliberately not a generative tool or an implicit tools/call capability.
  { name: "foundry.generation.context", description: "Get pinned enterprise schemas, template, policy and authorized wiki answer for creation.", inputSchema: {
    type: "object", properties: { standardsVersion: { type: "string" }, templateId: { type: "string" }, query: { type: "string", minLength: 1, maxLength: 4000 } },
    required: ["standardsVersion", "templateId", "query"], additionalProperties: false,
  } },
  { name: "foundry.knowledge.query", description: "Ask only the wiki documents granted to this workspace and user.", inputSchema: {
    type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 4000 } }, required: ["query"], additionalProperties: false,
  } },
  { name: "foundry.generation.validate", description: "Validate candidate examples, citations, files and requested tools against pinned standards. Not approval or a source-code security audit.", inputSchema: {
    type: "object", properties: { standardsDigest: { type: "string" }, templateId: { type: "string" }, candidate: { type: "object" } }, required: ["standardsDigest", "templateId", "candidate"], additionalProperties: false,
  } },
];

router.post("/enterprise/mcp", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  let envelope;
  let grant;
  const authorization = req.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    if (!/^[a-f0-9]{64}$/.test(token)) { res.status(401).json({ error: "Invalid scoped capability." }); return; }
    [grant] = await db.select().from(enterpriseGrantsTable).where(and(
      eq(enterpriseGrantsTable.tokenHash, createHash("sha256").update(token).digest("hex")),
      eq(enterpriseGrantsTable.enabled, true),
    ));
    if (!grant) { res.status(401).json({ error: "Invalid scoped capability." }); return; }
    const assertion = bridgeEnvelopeSchema.safeParse(req.body);
    if (assertion.success) {
      if (assertion.data.workspaceId !== grant.workspaceId || assertion.data.userId !== grant.userId) {
        res.status(403).json({ error: "Capability is not authorized for this workspace/user." }); return;
      }
      envelope = assertion.data;
    } else {
      const rpc = enterpriseRpcSchema.safeParse(req.body);
      if (!rpc.success) { res.status(400).json({ error: "Invalid MCP request." }); return; }
      envelope = { workspaceId: grant.workspaceId, userId: grant.userId, rpc: rpc.data };
    }
  } else {
    const secret = process.env.SESSION_SECRET;
    if (!secret) { res.status(503).json({ error: "Enterprise bridge is not configured." }); return; }
    envelope = verifyBridge(req.body, req.get("x-foundry-signature"), secret);
    if (!envelope) { res.status(401).json({ error: "Invalid or expired workspace assertion." }); return; }
    [grant] = await db.select().from(enterpriseGrantsTable).where(and(
      eq(enterpriseGrantsTable.workspaceId, envelope.workspaceId), eq(enterpriseGrantsTable.userId, envelope.userId),
      eq(enterpriseGrantsTable.enabled, true),
    ));
  }
  const { workspaceId, userId, rpc } = envelope;
  if (!grant) { res.status(403).json({ error: "No active grant for this workspace and user." }); return; }
  const success = (result: unknown) => res.json({ jsonrpc: "2.0", id: rpc.id, result });
  if (rpc.method === "initialize") {
    success({ protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "foundry-enterprise", version: "1.0.0" } });
    return;
  }
  if (rpc.method === "tools/list") {
    success({ tools: enterpriseTools.filter(tool => grant.permittedTools.includes(tool.name)) }); return;
  }
  const call = z.strictObject({
    name: z.string(), arguments: z.record(z.string(), z.unknown()).default({}),
  }).safeParse(rpc.params);
  if (!call.success) { res.status(400).json({ error: "Invalid MCP tool call." }); return; }
  if (!grant.permittedTools.includes(call.data.name)) {
    res.status(403).json({ error: "Tool is not permitted for this workspace and user." }); return;
  }
  const [record] = await db.select().from(enterpriseStandardsTable).where(eq(enterpriseStandardsTable.version, grant.standardsVersion));
  if (!record) { res.status(409).json({ error: "Selected standards are unavailable." }); return; }
  const standard = parseStandard(record.bundle);
  const template = standard.templates.find(t => t.id === grant.templateId);
  if (!template) { res.status(409).json({ error: "Selected template is unavailable." }); return; }
  const documentGrants = await db.select().from(enterpriseDocumentGrantsTable).where(and(
    eq(enterpriseDocumentGrantsTable.workspaceId, workspaceId), eq(enterpriseDocumentGrantsTable.userId, userId),
  ));
  const documentIds = documentGrants.map(row => row.documentId);
  if (!documentIds.length) { res.status(403).json({ error: "No wiki documents have been granted." }); return; }
  const scope = { workspaceId, userId, documentIds, standardsDigest: record.digest };
  try {
    let result: unknown;
    switch (call.data.name) {
      case "foundry.generation.context": {
        const selection = generationSelectionSchema.parse(call.data.arguments);
        if (selection.standardsVersion !== grant.standardsVersion || selection.templateId !== grant.templateId) {
          res.status(403).json({ error: "Standards version or template not granted." }); return;
        }
        const knowledge = await queryKnowledge(selection.query, scope);
        result = {
          standardsVersion: standard.version, standardsDigest: record.digest,
          template, inputSchema: standard.inputSchema, outputSchema: standard.outputSchema,
          permittedTools: standard.permittedTools.filter(tool => grant.permittedTools.includes(tool)),
          validationRules: standard.validationRules, knowledge,
        };
        break;
      }
      case "foundry.knowledge.query": {
        if (!standard.permittedTools.includes(call.data.name)) {
          res.status(403).json({ error: "Tool not allowed by selected standard." }); return;
        }
        const { query } = z.strictObject({ query: z.string().trim().min(1).max(4000) }).parse(call.data.arguments);
        result = await queryKnowledge(query, scope); break;
      }
      case "foundry.generation.validate": {
        const { candidate, standardsDigest, templateId } = z.strictObject({
          candidate: z.unknown(), standardsDigest: z.string(), templateId: z.string(),
        }).parse(call.data.arguments);
        if (standardsDigest !== record.digest || templateId !== grant.templateId) {
          res.status(409).json({ error: "Standards changed since creation. Reload the selected generation context." }); return;
        }
        result = validateCandidate({
          ...standard, permittedTools: standard.permittedTools.filter(tool => grant.permittedTools.includes(tool)),
        }, candidate, documentIds, { workspaceId, userId }); break;
      }
      default: res.status(400).json({ error: "Unknown tool." }); return;
    }
    success({ content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ error: error.message }); return; }
    req.log.error({ err: error }, "Scoped enterprise tool failed");
    res.status(502).json({ error: "Enterprise tool failed; no unscoped fallback was attempted." });
  }
});
export default router;
