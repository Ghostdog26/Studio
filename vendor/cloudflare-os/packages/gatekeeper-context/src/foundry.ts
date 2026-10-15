/**
 * Server-only enterprise knowledge capability. Identity is captured by Workshop from its
 * authenticated turn, never accepted from generated code or model tool arguments.
 * No wiki listing, writes, ambient access, or transport credential is exposed to the model.
 */
export interface FoundryBridgeEnv {
  FOUNDRY_API_URL?: string;
  FOUNDRY_BRIDGE_KEY?: string;
  FOUNDRY_API_TOKEN?: string;
}
export function createFoundryCapability(
  env: FoundryBridgeEnv, workspaceId: string, userId: string,
) {
  if (!env.FOUNDRY_API_URL || (!env.FOUNDRY_BRIDGE_KEY && !env.FOUNDRY_API_TOKEN)) {
    throw new Error("Agent Foundry knowledge bridge is not configured.");
  }
  const endpoint = new URL(env.FOUNDRY_API_URL);
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost" && endpoint.hostname !== "127.0.0.1") {
    throw new Error("Agent Foundry bridge requires HTTPS.");
  }
  const url = endpoint.toString();
  const key = env.FOUNDRY_BRIDGE_KEY;
  const token = env.FOUNDRY_API_TOKEN;
  return {
    async call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
      if (!["foundry.generation.context", "foundry.knowledge.query", "foundry.generation.validate"].includes(name)) {
        throw new Error("Unsupported enterprise capability.");
      }
      const body = JSON.stringify({
        workspaceId, userId, timestamp: Date.now(),
        rpc: { jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/call", params: { name, arguments: args } },
      });
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (token) {
        headers.authorization = `Bearer ${token}`;
      } else {
        const signingKey = await crypto.subtle.importKey(
          "raw", new TextEncoder().encode(key!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
        );
        headers["x-foundry-signature"] = Array.from(new Uint8Array(await crypto.subtle.sign(
          "HMAC", signingKey, new TextEncoder().encode(body),
        )), byte => byte.toString(16).padStart(2, "0")).join("");
      }
      const response = await fetch(url, {
        method: "POST", headers,
        body, redirect: "error", signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`Agent Foundry denied or failed this scoped request (HTTP ${response.status}).`);
      const result = await response.json() as {
        result?: { structuredContent?: Record<string, unknown> }; error?: unknown;
      };
      if (result.error || !result.result?.structuredContent) throw new Error("Invalid Foundry MCP response.");
      return result.result.structuredContent;
    },
  };
}
