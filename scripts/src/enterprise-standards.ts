// Operator-only provisioning: never expose this script as an unauthenticated HTTP endpoint.
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db, pool, enterpriseStandardsTable, enterpriseGrantsTable, enterpriseDocumentGrantsTable, knowledgeDocumentsTable, knowledgeQueryCacheTable,
} from "@workspace/db";
import { initialEnterpriseStandard, openMetadataEnterpriseStandard, parseStandard } from "@workspace/agent-runtime/enterprise-standards";

const [command, file, tokenFile] = process.argv.slice(2);
try {
  if (command === "publish") {
    const standard = parseStandard(file === "openmetadata" ? openMetadataEnterpriseStandard : file ? JSON.parse(await readFile(file, "utf8")) : initialEnterpriseStandard);
    const digest = createHash("sha256").update(JSON.stringify(standard)).digest("hex");
    const inserted = await db.insert(enterpriseStandardsTable).values({
      version: standard.version, digest, bundle: standard,
    }).onConflictDoNothing().returning();
    const [existing] = await db.select().from(enterpriseStandardsTable).where(eq(enterpriseStandardsTable.version, standard.version));
    if (existing?.digest !== digest) throw new Error("Published versions are immutable. Choose a new version.");
    console.info(`${inserted.length ? "Published" : "Already published"} standards ${standard.version} (${digest}).`);
  } else if (command === "wiki" && file) {
    const input = z.strictObject({
      id: z.number().int().positive().optional(),
      title: z.string().trim().min(1).max(500), content: z.string().min(1),
      source: z.string().default("Enterprise wiki"), tags: z.array(z.string()).default([]),
    }).parse(JSON.parse(await readFile(file, "utf8")));
    const { id, ...values } = input;
    const document = await db.transaction(async tx => {
      const [saved] = id
        ? await tx.update(knowledgeDocumentsTable).set({ ...values, enterpriseRestricted: true })
          .where(and(eq(knowledgeDocumentsTable.id, id), eq(knowledgeDocumentsTable.enterpriseRestricted, true))).returning()
        : await tx.insert(knowledgeDocumentsTable).values({ ...values, enterpriseRestricted: true }).returning();
      if (!saved) throw new Error("Restricted document not found. Shared documents must be promoted with a grant first.");
      await tx.delete(knowledgeQueryCacheTable);
      return saved;
    });
    console.info(`Saved restricted enterprise wiki document ${document.id}.`);
  } else if (command === "grant" && file) {
    const input = z.strictObject({
      workspaceId: z.string().min(1).max(200), userId: z.string().min(1).max(200),
      standardsVersion: z.string(), templateId: z.string(),
      documentIds: z.array(z.number().int().positive()).min(1),
      permittedTools: z.array(z.enum([
        "foundry.generation.context", "foundry.generation.validate", "foundry.knowledge.query",
      ])).min(1),
    }).parse(JSON.parse(await readFile(file, "utf8")));
    const [version] = await db.select().from(enterpriseStandardsTable).where(eq(enterpriseStandardsTable.version, input.standardsVersion));
    if (!version || !parseStandard(version.bundle).templates.some(t => t.id === input.templateId)) {
      throw new Error("Publish the selected standards/template before granting access.");
    }
    const ids = [...new Set(input.documentIds)];
    const documents = await db.select({ id: knowledgeDocumentsTable.id }).from(knowledgeDocumentsTable).where(inArray(knowledgeDocumentsTable.id, ids));
    if (documents.length !== ids.length) throw new Error("Every selected wiki document must exist.");
    const { documentIds: _, ...grant } = input;
    // Optional generated-package credential, bound to this one workspace/user grant.
    // Never print it; store only its hash in Postgres. Regranting rotates/revokes the old token.
    const token = tokenFile ? randomBytes(32).toString("hex") : undefined;
    const tokenHash = token ? createHash("sha256").update(token).digest("hex") : null;
    if (token && tokenFile) await writeFile(tokenFile, token, { mode: 0o600, flag: "wx" });
    await db.transaction(async tx => {
      // Promotion is permanent unless an operator deliberately changes classification in the DB.
      // Revoking or replacing a grant must never publish previously restricted company context.
      await tx.update(knowledgeDocumentsTable).set({ enterpriseRestricted: true })
        .where(inArray(knowledgeDocumentsTable.id, ids));
      await tx.delete(knowledgeQueryCacheTable);
      await tx.insert(enterpriseGrantsTable).values({ ...grant, enabled: true, tokenHash }).onConflictDoUpdate({
        target: [enterpriseGrantsTable.workspaceId, enterpriseGrantsTable.userId], set: { ...grant, enabled: true, tokenHash },
      });
      await tx.delete(enterpriseDocumentGrantsTable).where(and(
        eq(enterpriseDocumentGrantsTable.workspaceId, input.workspaceId), eq(enterpriseDocumentGrantsTable.userId, input.userId),
      ));
      await tx.insert(enterpriseDocumentGrantsTable).values(ids.map(documentId => ({
        workspaceId: input.workspaceId, userId: input.userId, documentId,
      })));
    });
    console.info("Replaced the explicit workspace/user grant.");
  } else if (command === "revoke" && file) {
    const { workspaceId, userId } = JSON.parse(await readFile(file, "utf8"));
    if (typeof workspaceId !== "string" || !workspaceId || typeof userId !== "string" || !userId) throw new Error("workspaceId and userId are required.");
    await db.update(enterpriseGrantsTable).set({ enabled: false }).where(and(
      eq(enterpriseGrantsTable.workspaceId, workspaceId), eq(enterpriseGrantsTable.userId, userId),
    ));
    console.info("Revoked workspace/user enterprise access.");
  } else {
    throw new Error("Usage: enterprise-standards publish [bundle.json] | wiki <document.json> | grant <grant.json> [new-token-file] | revoke <identity.json>");
  }
} finally {
  await pool.end();
}
