import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OfficialMcpSnapshot } from "./official-mcp-sdks";
import { createHash } from "node:crypto";

let cached: Promise<{ root: string; snapshot: OfficialMcpSnapshot }> | undefined;
export async function loadOfficialMcpSources() {
  cached ??= (async () => {
    let directory = process.cwd();
    while (true) {
      const root = join(directory, "vendor/mcp-official");
      try {
        await access(join(root, "sources.json"));
        const snapshot = JSON.parse(await readFile(join(root, "sources.json"), "utf8")) as OfficialMcpSnapshot;
        if (!/^[a-f0-9]{40}$/.test(snapshot.specificationRevision) || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.protocolVersion)
          || !snapshot.sdks.every((sdk) => /^[a-f0-9]{40}$/.test(sdk.sourceRevision) && /^[a-z]+-sdk$/.test(sdk.repo))) {
          throw new Error("Invalid official source provenance.");
        }
        return { root, snapshot };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        if (directory === dirname(directory)) throw new Error("Official MCP source snapshot missing; run mcp:official-import.");
        directory = dirname(directory);
      }
    }
  })();
  try { return await cached; } catch (error) { cached = undefined; throw error; }
}

export async function readPinnedMcpFile(root: string, snapshot: OfficialMcpSnapshot, path: string) {
  const expected = snapshot.assetHashes?.[path];
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) throw new Error(`Pinned source checksum is missing: ${path}. Re-import official sources.`);
  const content = await readFile(join(root, path), "utf8");
  if (createHash("sha256").update(content).digest("hex") !== expected) {
    throw new Error(`Official source integrity check failed: ${path}. Re-import and restart before generating.`);
  }
  return content;
}
