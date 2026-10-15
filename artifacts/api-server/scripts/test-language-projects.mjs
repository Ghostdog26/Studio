import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../../../generated-artifacts/language-tests/", import.meta.url));
await mkdir(output, { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL("../tests/language-projects.test.mjs", import.meta.url))],
  outfile: `${output}test.mjs`, bundle: true, platform: "node", format: "esm",
});
const result = spawnSync(process.execPath, ["--test", `${output}test.mjs`], { stdio: "inherit" });
process.exit(result.status ?? 1);
