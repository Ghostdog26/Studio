import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod/v4";

export const enterpriseRpcSchema = z.strictObject({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]),
  method: z.enum(["initialize", "tools/list", "tools/call"]),
  params: z.record(z.string(), z.unknown()).optional(),
});
export const bridgeEnvelopeSchema = z.strictObject({
  workspaceId: z.string().min(1).max(200),
  userId: z.string().min(1).max(200),
  timestamp: z.number().int(),
  rpc: enterpriseRpcSchema,
});

// Domain separation means the worker never receives the application's session signing secret.
export function bridgeKey(secret: string) {
  return createHmac("sha256", secret).update("foundry-cloudflare-knowledge-v1").digest("hex");
}

export function verifyBridge(body: unknown, signature: string | undefined, secret: string, now = Date.now()) {
  const parsed = bridgeEnvelopeSchema.safeParse(body);
  if (!parsed.success || !signature || !/^[a-f0-9]{64}$/.test(signature) ||
      Math.abs(now - parsed.data.timestamp) > 60_000) return null;
  const expected = createHmac("sha256", bridgeKey(secret)).update(JSON.stringify(body)).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex")) ? parsed.data : null;
}
