import { createHash } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateAgentBody,
  CreateAgentResponse,
  CreateComponentBody,
  CreateComponentResponse,
  CreateKnowledgeBody,
  CreateKnowledgeResponse,
  DownloadComponentPackageQueryParams,
  DeleteAgentParams,
  DeleteComponentParams,
  DeleteKnowledgeParams,
  GetOverviewResponse,
  ListAgentsResponse,
  ListComponentsResponse,
  ListKnowledgeResponse,
  ListRuntimesResponse,
  QueryKnowledgeBody,
  QueryKnowledgeResponse,
  UpdateAgentBody,
  UpdateAgentParams,
  UpdateAgentResponse,
  UpdateComponentBody,
  UpdateComponentParams,
  UpdateComponentResponse,
  UpdateKnowledgeBody,
  UpdateKnowledgeParams,
  UpdateKnowledgeResponse,
} from "@workspace/api-zod";
import {
  agentsTable,
  db,
  knowledgeDocumentsTable,
  knowledgeQueryCacheTable,
  knowledgeQueryHistoryTable,
  mcpComponentsTable,
} from "@workspace/db";
import { runtimeAdapters } from "@workspace/agent-runtime";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateMcpPackage } from "../lib/mcp-packages";
import { publicKnowledgeCondition } from "../lib/knowledge-access";

const router: IRouter = Router();

async function invalidateKnowledgeCache(): Promise<void> {
  await db.delete(knowledgeQueryCacheTable);
}

const runtimes = runtimeAdapters.map((adapter) => ({
  id: adapter.id,
  name: adapter.name,
  status: adapter.isConfigured() ? ("adapter-ready" as const) : ("not-connected" as const),
  description: `${adapter.description} Configure provider access to enable live execution.`,
  features: adapter.features,
}));

router.get("/overview", async (_req, res): Promise<void> => {
  const [
    knowledge,
    agents,
    components,
    queryTotals,
    recentKnowledge,
    recentAgents,
    recentComponents,
    recentQueries,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(knowledgeDocumentsTable).where(publicKnowledgeCondition()),
    db.select({ count: sql<number>`count(*)::int` }).from(agentsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(mcpComponentsTable),
    db
      .select({
        total: sql<number>`count(*)::int`,
        cached: sql<number>`count(*) filter (where ${knowledgeQueryHistoryTable.cached})::int`,
      })
      .from(knowledgeQueryHistoryTable)
      .where(isNull(knowledgeQueryHistoryTable.workspaceId)),
    db
      .select({ id: knowledgeDocumentsTable.id, title: knowledgeDocumentsTable.title, createdAt: knowledgeDocumentsTable.updatedAt })
      .from(knowledgeDocumentsTable)
      .where(publicKnowledgeCondition())
      .orderBy(desc(knowledgeDocumentsTable.updatedAt))
      .limit(5),
    db
      .select({ id: agentsTable.id, title: agentsTable.name, createdAt: agentsTable.updatedAt })
      .from(agentsTable)
      .orderBy(desc(agentsTable.updatedAt))
      .limit(5),
    db
      .select({ id: mcpComponentsTable.id, title: mcpComponentsTable.name, kind: mcpComponentsTable.kind, createdAt: mcpComponentsTable.updatedAt })
      .from(mcpComponentsTable)
      .orderBy(desc(mcpComponentsTable.updatedAt))
      .limit(5),
    db
      .select({ id: knowledgeQueryHistoryTable.id, query: knowledgeQueryHistoryTable.query, createdAt: knowledgeQueryHistoryTable.createdAt })
      .from(knowledgeQueryHistoryTable)
      .where(isNull(knowledgeQueryHistoryTable.workspaceId))
      .orderBy(desc(knowledgeQueryHistoryTable.createdAt))
      .limit(5),
  ]);

  const total = queryTotals[0]?.total ?? 0;
  const cached = queryTotals[0]?.cached ?? 0;
  const activity = [
    ...recentKnowledge.map((item) => ({
      id: `knowledge-${item.id}`,
      label: `Updated wiki: ${item.title}`,
      kind: "knowledge",
      createdAt: item.createdAt,
    })),
    ...recentAgents.map((item) => ({
      id: `agent-${item.id}`,
      label: `Updated agent: ${item.title}`,
      kind: "agent",
      createdAt: item.createdAt,
    })),
    ...recentComponents.map((item) => ({
      id: `component-${item.id}`,
      label: `Updated MCP ${item.kind}: ${item.title}`,
      kind: "component",
      createdAt: item.createdAt,
    })),
    ...recentQueries.map((item) => ({
      id: `query-${item.id}`,
      label: `Asked: ${item.query}`,
      kind: "query",
      createdAt: item.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  res.json(
    GetOverviewResponse.parse({
      knowledgeCount: knowledge[0]?.count ?? 0,
      agentCount: agents[0]?.count ?? 0,
      componentCount: components[0]?.count ?? 0,
      queryCount: total,
      cacheHitRate: total === 0 ? 0 : cached / total,
      runtimes,
      recentActivity: activity,
    }),
  );
});

router.get("/runtimes", (_req, res): void => {
  res.json(ListRuntimesResponse.parse(runtimes));
});

router.get("/knowledge", async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(knowledgeDocumentsTable)
    .where(publicKnowledgeCondition())
    .orderBy(desc(knowledgeDocumentsTable.updatedAt));
  res.json(ListKnowledgeResponse.parse(items));
});

router.post("/knowledge", async (req, res): Promise<void> => {
  const parsed = CreateKnowledgeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db
    .insert(knowledgeDocumentsTable)
    .values({
      ...parsed.data,
      source: parsed.data.source ?? "Workspace wiki",
      tags: parsed.data.tags ?? [],
    })
    .returning();
  await invalidateKnowledgeCache();
  res.status(201).json(CreateKnowledgeResponse.parse(item));
});

router.patch("/knowledge/:id", async (req, res): Promise<void> => {
  const params = UpdateKnowledgeParams.safeParse(req.params);
  const parsed = UpdateKnowledgeBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid document update." });
    return;
  }
  const [item] = await db
    .update(knowledgeDocumentsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(knowledgeDocumentsTable.id, params.data.id), publicKnowledgeCondition()))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Knowledge document not found." });
    return;
  }
  await invalidateKnowledgeCache();
  res.json(UpdateKnowledgeResponse.parse(item));
});

router.delete("/knowledge/:id", async (req, res): Promise<void> => {
  const params = DeleteKnowledgeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(knowledgeDocumentsTable)
    .where(and(eq(knowledgeDocumentsTable.id, params.data.id), publicKnowledgeCondition()))
    .returning({ id: knowledgeDocumentsTable.id });
  if (!item) {
    res.status(404).json({ error: "Knowledge document not found." });
    return;
  }
  await invalidateKnowledgeCache();
  res.sendStatus(204);
});

router.get("/agents", async (_req, res): Promise<void> => {
  const items = await db.select().from(agentsTable).orderBy(desc(agentsTable.updatedAt));
  res.json(ListAgentsResponse.parse(items));
});

router.post("/agents", async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db
    .insert(agentsTable)
    .values({ ...parsed.data, status: "draft" })
    .returning();
  res.status(201).json(CreateAgentResponse.parse(item));
});

router.patch("/agents/:id", async (req, res): Promise<void> => {
  const params = UpdateAgentParams.safeParse(req.params);
  const parsed = UpdateAgentBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid agent update." });
    return;
  }
  const [item] = await db
    .update(agentsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(agentsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Agent not found." });
    return;
  }
  res.json(UpdateAgentResponse.parse(item));
});

router.delete("/agents/:id", async (req, res): Promise<void> => {
  const params = DeleteAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(agentsTable)
    .where(eq(agentsTable.id, params.data.id))
    .returning({ id: agentsTable.id });
  if (!item) {
    res.status(404).json({ error: "Agent not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/components", async (_req, res): Promise<void> => {
  const items = await db
    .select()
    .from(mcpComponentsTable)
    .orderBy(desc(mcpComponentsTable.updatedAt));
  res.json(ListComponentsResponse.parse(items));
});

router.get("/component-packages", async (req, res): Promise<void> => {
  const parsed = DownloadComponentPackageQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Provide a valid component ID and package target." });
    return;
  }

  const [component] = await db
    .select()
    .from(mcpComponentsTable)
    .where(eq(mcpComponentsTable.id, parsed.data.id))
    .limit(1);
  if (!component) {
    res.status(404).json({ error: "MCP component not found." });
    return;
  }
  if (component.kind !== "server" && component.kind !== "app") {
    res.status(422).json({ error: "Only MCP server and app definitions can be generated." });
    return;
  }

  try {
    const archive = generateMcpPackage(
      {
        id: component.id,
        name: component.name,
        description: component.description,
        kind: component.kind,
        transport: component.transport,
        jsonSchema: component.jsonSchema,
      },
      parsed.data.target,
    );
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${archive.filename}"`,
    );
    res.setHeader("Content-Length", archive.buffer.byteLength);
    res.end(archive.buffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "MCP package generation failed.";
    req.log.warn({ componentId: component.id, error: message }, "MCP package generation failed");
    res.status(422).json({ error: message });
  }
});

router.post("/components", async (req, res): Promise<void> => {
  const parsed = CreateComponentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db
    .insert(mcpComponentsTable)
    .values({ ...parsed.data, status: "draft" })
    .returning();
  res.status(201).json(CreateComponentResponse.parse(item));
});

router.patch("/components/:id", async (req, res): Promise<void> => {
  const params = UpdateComponentParams.safeParse(req.params);
  const parsed = UpdateComponentBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid component update." });
    return;
  }
  const [item] = await db
    .update(mcpComponentsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(mcpComponentsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "MCP component not found." });
    return;
  }
  res.json(UpdateComponentResponse.parse(item));
});

router.delete("/components/:id", async (req, res): Promise<void> => {
  const params = DeleteComponentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(mcpComponentsTable)
    .where(eq(mcpComponentsTable.id, params.data.id))
    .returning({ id: mcpComponentsTable.id });
  if (!item) {
    res.status(404).json({ error: "MCP component not found." });
    return;
  }
  res.sendStatus(204);
});

const stopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "how", "in", "is", "it", "of", "on", "or", "that", "the", "this",
  "to", "what", "when", "where", "which", "who", "why", "with",
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_-]{1,}/g)
    ?.filter((word) => !stopWords.has(word)) ?? [];
}

function rankDocuments(
  query: string,
  documents: Array<typeof knowledgeDocumentsTable.$inferSelect>,
) {
  const terms = [...new Set(tokenize(query))];
  const initial = documents
    .map((document) => {
      const title = tokenize(document.title);
      const body = tokenize(document.content);
      const tags = tokenize(document.tags.join(" "));
      const score = terms.reduce((sum, term) => {
        const titleHits = title.filter((word) => word === term).length;
        const bodyHits = body.filter((word) => word === term).length;
        const tagHits = tags.filter((word) => word === term).length;
        return sum + titleHits * 4 + tagHits * 3 + Math.min(bodyHits, 5);
      }, 0);
      return { document, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const queryPhrase = query.toLowerCase().trim();
  return initial
    .map(({ document, score }) => {
      const title = document.title.toLowerCase();
      const content = document.content.toLowerCase();
      const phraseBoost = title.includes(queryPhrase)
        ? 8
        : content.includes(queryPhrase)
          ? 4
          : 0;
      const coverage = terms.length === 0
        ? 0
        : terms.filter((term) => `${title} ${content}`.includes(term)).length / terms.length;
      const rerankScore = score + phraseBoost + coverage * 5;
      return {
        document,
        score: Math.min(0.99, rerankScore / (rerankScore + 12)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

router.post("/knowledge/query", async (req, res): Promise<void> => {
  const parsed = QueryKnowledgeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const query = parsed.data.query.trim();
  res.json(await queryKnowledge(query));
});

// Only trusted server callers supply scope; it is never accepted from the legacy request body.
export async function queryKnowledge(
  query: string,
  scope?: { workspaceId: string; userId: string; documentIds: number[]; standardsDigest: string },
) {
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ");
  const queryHash = createHash("sha256").update(scope
    ? JSON.stringify(["enterprise-v1", scope.workspaceId, scope.userId,
        scope.standardsDigest, [...scope.documentIds].sort((a, b) => a - b), normalizedQuery])
    : normalizedQuery).digest("hex");
  const now = new Date();
  await db
    .delete(knowledgeQueryCacheTable)
    .where(lt(knowledgeQueryCacheTable.expiresAt, now));
  const cachedRows = await db
    .select()
    .from(knowledgeQueryCacheTable)
    .where(
      and(
        eq(knowledgeQueryCacheTable.queryHash, queryHash),
        gt(knowledgeQueryCacheTable.expiresAt, now),
      ),
    )
    .limit(1);
  let cached: typeof knowledgeQueryCacheTable.$inferSelect | undefined = cachedRows[0];

  // Recheck public visibility on cache hits: classification can change after a legacy cache
  // entry was computed, including a query that raced with grant provisioning.
  if (cached && !scope && cached.sources.length) {
    const publicSources = await db.select({ id: knowledgeDocumentsTable.id }).from(knowledgeDocumentsTable)
      .where(and(inArray(knowledgeDocumentsTable.id, cached.sources.map(source => source.id)), publicKnowledgeCondition()));
    const allowed = new Set(publicSources.map(source => source.id));
    if (cached.sources.some(source => !allowed.has(source.id))) {
      await db.delete(knowledgeQueryCacheTable).where(eq(knowledgeQueryCacheTable.id, cached.id));
      cached = undefined;
    }
  }
  const historyScope = scope ? { workspaceId: scope.workspaceId, userId: scope.userId } : {};
  if (cached) {
    await Promise.all([
      db
        .update(knowledgeQueryCacheTable)
        .set({ hitCount: sql`${knowledgeQueryCacheTable.hitCount} + 1` })
        .where(eq(knowledgeQueryCacheTable.id, cached.id)),
      db.insert(knowledgeQueryHistoryTable).values({ query, cached: true, ...historyScope }),
    ]);
    return QueryKnowledgeResponse.parse({
        answer: cached.answer,
        sources: cached.sources,
        cached: true,
        reranked: true,
      });
  }

  const documents = scope
    ? scope.documentIds.length
      ? await db.select().from(knowledgeDocumentsTable).where(inArray(knowledgeDocumentsTable.id, scope.documentIds))
      : []
    : await db.select().from(knowledgeDocumentsTable).where(publicKnowledgeCondition());
  const ranked = rankDocuments(query, documents);
  const sources = ranked.map(({ document, score }) => ({
    id: document.id,
    title: document.title,
    excerpt:
      document.content.length > 360
        ? `${document.content.slice(0, 357).trimEnd()}...`
        : document.content,
    score,
  }));

  const context = ranked
    .map(
      ({ document }, index) =>
        `[${index + 1}] ${document.title}\n${document.content.slice(0, 6000)}`,
    )
    .join("\n\n");
  const completion = await openai.chat.completions.create({
    model: "gpt-5.6-terra",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content:
          "Answer the user's question using only the workspace wiki excerpts below. Cite claims with the source number in square brackets, such as [1]. If the sources do not contain the answer, say so plainly. Do not invent policies or facts.",
      },
      {
        role: "user",
        content: `Question: ${query}\n\nWorkspace wiki excerpts:\n${context || "(No knowledge documents have been added yet.)"}`,
      },
    ],
  });
  const answer =
    completion.choices[0]?.message.content?.trim() ||
    "The model returned an empty answer. Please try the query again.";

  await Promise.all([
    db
      .insert(knowledgeQueryCacheTable)
      .values({
        queryHash,
        normalizedQuery,
        answer,
        sources,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })
      .onConflictDoUpdate({
        target: knowledgeQueryCacheTable.queryHash,
        set: {
          normalizedQuery,
          answer,
          sources,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      }),
    db.insert(knowledgeQueryHistoryTable).values({ query, cached: false, ...historyScope }),
  ]);

  return QueryKnowledgeResponse.parse({
      answer,
      sources,
      cached: false,
      reranked: true,
    });
}

export default router;
