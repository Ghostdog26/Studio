import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = `${root}generated-artifacts/openmetadata`;
await mkdir(output, { recursive: true });
await build({
  stdin: {
    contents: `import { importOpenMetadataReferences } from "./src/lib/openmetadata-import";
      import { pool } from "@workspace/db";
      try { console.info(JSON.stringify(await importOpenMetadataReferences())); } finally { await pool.end(); }`,
    resolveDir: `${root}artifacts/api-server`, loader: "ts",
  },
  outfile: `${output}/import.mjs`, bundle: true, platform: "node", format: "esm",
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});
await import(pathToFileURL(`${output}/import.mjs`).href);
