// Bundled and launched only by the disposable infrastructure rehearsal.
import express from "express";
import { createServer } from "node:http";
import { pool } from "@workspace/db";
import { createMcpDiscoveryRouter } from "../../routes/mcp-discovery";
import { createDiscoveryCoordinator } from "../mcp-discovery-coordination";

if (!process.send || !process.env.MCP_DISCOVERY_INFRA_REHEARSAL) throw new Error("Rehearsal IPC required");
// A real server stop breaks idle sockets. Do not let pg's idle-client error
// event terminate the API replica; subsequent queries must reconnect.
pool.on("error", () => {});
pool.options.connectionTimeoutMillis = 1500;
const coordinator = createDiscoveryCoordinator();
let release: (() => void) | undefined;
let calls = 0;
const app = express();
app.use(express.json());
app.use(createMcpDiscoveryRouter(async () => {
  calls++;
  process.send!({ event: "discovery-started", calls });
  await new Promise<void>(resolve => { release = resolve; });
  return { serverInfo: { name: "fixture-only", version: "1" }, protocolVersion: "2025-03-26",
    tools: [], resources: [], prompts: [] };
}, coordinator));
const server = createServer(app);
server.listen(0, "127.0.0.1", () => {
  process.send!({ event: "ready", port: (server.address() as { port: number }).port });
});
process.on("message", async (message: { id: number; action: string; user?: string; scope?: string; lease?: { id: string; revision: string } }) => {
  try {
    let result: unknown;
    if (message.action === "acquire") result = await coordinator.acquire(message.user!, message.scope);
    else if (message.action === "finish") result = await coordinator.finish(message.lease!);
    else if (message.action === "revision") result = await coordinator.revision();
    else if (message.action === "release") { release?.(); release = undefined; result = calls; }
    else if (message.action === "calls") result = calls;
    else throw new Error("Unknown rehearsal action");
    process.send!({ id: message.id, result });
  } catch {
    process.send!({ id: message.id, error: "unavailable" });
  }
});
process.on("disconnect", () => process.exit(0));
