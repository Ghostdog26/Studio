import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { z } from "zod/v4";
import { approvedUrl, isPublicAddress, type DiscoveryApproval } from "./mcp-discovery-policy";

export class DiscoveryFailure extends Error {
  constructor(public readonly reason: "remote-denied" | "network-policy" | "discovery-failed" | "incomplete-discovery") {
    super(reason);
  }
}
type Reply = { status: number; body: unknown; session?: string };
export type Exchange = (body: Record<string, unknown>, session?: string) => Promise<Reply>;

// No proxy environment, redirects, cookies, credential forwarding or caller-controlled headers.
export function networkExchange(
  approval: DiscoveryApproval, credential: string, signal: AbortSignal,
  transport = { resolve: resolveAll, send: request },
): Exchange {
  const url = approvedUrl(approval.endpoint);
  let totalBytes = 0;
  return async (body, session) => {
    signal.throwIfAborted();
    const addresses = await new Promise<Awaited<ReturnType<typeof resolveAll>>>((resolve, reject) => {
      const abort = () => reject(new DiscoveryFailure("discovery-failed"));
      signal.addEventListener("abort", abort, { once: true });
      transport.resolve(url.hostname).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
    signal.throwIfAborted();
    if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) {
      throw new DiscoveryFailure("network-policy");
    }
    const pinned = addresses[0]!;
    return new Promise<Reply>((resolve, reject) => {
      const req = transport.send(url, {
        method: "POST", agent: false, family: pinned.family, signal, maxHeaderSize: 16 * 1024,
        // Pin the validated DNS result for this connection; TLS still verifies the original host.
        lookup: (_host, _options, callback) => callback(null, pinned.address, pinned.family),
        headers: {
          Authorization: `Bearer ${credential}`, "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": approval.protocolVersion,
          ...(session ? { "Mcp-Session-Id": session } : {}),
        },
      }, response => {
        const status = response.statusCode ?? 0;
        if (status === 401 || status === 403) {
          response.destroy(); reject(new DiscoveryFailure("remote-denied")); return;
        }
        if (status < 200 || status >= 300 || response.headers["content-encoding"]) {
          response.destroy(); reject(new DiscoveryFailure("discovery-failed")); return;
        }
        const sessionHeader = response.headers["mcp-session-id"];
        if (sessionHeader && (typeof sessionHeader !== "string" || !/^[\x21-\x7e]{1,256}$/.test(sessionHeader))) {
          response.destroy(); reject(new DiscoveryFailure("discovery-failed")); return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length; totalBytes += chunk.length;
          if (bytes > 256 * 1024 || totalBytes > 1024 * 1024) {
            response.destroy(new DiscoveryFailure("incomplete-discovery")); return;
          }
          chunks.push(chunk);
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            if (!("id" in body) && (status === 202 || status === 204 || bytes === 0)) {
              resolve({ status, body: null, session: sessionHeader }); return;
            }
            const contentType = response.headers["content-type"] ?? "";
            // JSON responses are the supported Streamable HTTP response mode.
            // SSE-only deployments fail explicitly, never yield a verified empty inventory.
            if (!contentType.startsWith("application/json")) throw new DiscoveryFailure("incomplete-discovery");
            resolve({ status, body: JSON.parse(Buffer.concat(chunks).toString("utf8")), session: sessionHeader });
          } catch (error) { reject(error instanceof DiscoveryFailure ? error : new DiscoveryFailure("discovery-failed")); }
        });
      });
      req.on("error", reject);
      req.end(JSON.stringify(body));
    });
  };
}

function resolveAll(host: string) { return lookup(host, { all: true, verbatim: true }); }
const item = z.object({ name: z.string().min(1).max(500), description: z.string().max(20000).optional() });
const jsonSchema = z.object({ type: z.literal("object") }).catchall(z.unknown());
const tool = item.extend({ inputSchema: jsonSchema, outputSchema: jsonSchema.optional() });
const resource = z.object({
  uri: z.string().min(1).max(2000), name: z.string().max(500).optional(),
  description: z.string().max(20000).optional(),
});
export type DiscoveryInventory = {
  serverInfo: { name: string; version: string };
  protocolVersion: string;
  tools: z.infer<typeof tool>[];
  resources: z.infer<typeof resource>[];
  prompts: z.infer<typeof item>[];
};

// An intentionally closed method set. Never accepts arbitrary RPC, tool names, arguments or code.
export async function discoverMcp(approval: DiscoveryApproval, exchange: Exchange): Promise<DiscoveryInventory> {
  let id = 0;
  let session: string | undefined;
  const rpc = async (method: string, params?: Record<string, unknown>) => {
    const requestId = ++id;
    if (id > 11) throw new DiscoveryFailure("incomplete-discovery");
    const reply = await exchange({ jsonrpc: "2.0", id: requestId, method, ...(params ? { params } : {}) }, session);
    if (reply.status < 200 || reply.status >= 300) throw new DiscoveryFailure("discovery-failed");
    const parsed = z.object({
      jsonrpc: z.literal("2.0"), id: z.literal(requestId),
      result: z.record(z.string(), z.unknown()),
    }).safeParse(reply.body);
    if (!parsed.success || (reply.body as Record<string, unknown>).error) throw new DiscoveryFailure("discovery-failed");
    if (method === "initialize") session = reply.session;
    return parsed.data.result;
  };
  const initialized = z.object({
    protocolVersion: z.literal(approval.protocolVersion),
    serverInfo: z.object({ name: z.string().min(1).max(500), version: z.literal(approval.deployedVersion) }),
    capabilities: z.object({
      tools: z.object({}).optional(), resources: z.object({}).optional(), prompts: z.object({}).optional(),
    }),
  }).parse(await rpc("initialize", {
    protocolVersion: approval.protocolVersion, capabilities: {},
    clientInfo: { name: "foundry-discovery-only", version: "1.0.0" },
  }));
  const notification = await exchange({ jsonrpc: "2.0", method: "notifications/initialized" }, session);
  if (![200, 202, 204].includes(notification.status)) throw new DiscoveryFailure("discovery-failed");
  async function list<T>(kind: "tools" | "resources" | "prompts", schema: z.ZodType<T>): Promise<T[]> {
    if (!initialized.capabilities[kind]) return [];
    const entries: T[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    for (let page = 0; page < 3; page++) {
      const result = await rpc(`${kind}/list`, cursor ? { cursor } : undefined);
      const values = z.array(schema).max(200).parse(result[kind]);
      entries.push(...values);
      if (entries.length > 200) throw new DiscoveryFailure("incomplete-discovery");
      if (result.nextCursor === undefined) return entries;
      cursor = z.string().min(1).max(2000).parse(result.nextCursor);
      if (seen.has(cursor)) throw new DiscoveryFailure("incomplete-discovery");
      seen.add(cursor);
    }
    throw new DiscoveryFailure("incomplete-discovery");
  }
  const tools = await list("tools", tool);
  const resources = await list("resources", resource);
  const prompts = await list("prompts", item);
  return { serverInfo: initialized.serverInfo, protocolVersion: initialized.protocolVersion, tools, resources, prompts };
}
