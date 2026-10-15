import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = `${root}generated-artifacts/mcp-catalogue`;
const metadata = JSON.parse(await readFile(new URL("../mcp-catalogue-source.json", import.meta.url), "utf8"));
const revisionFlag = process.argv.find((value) => value.startsWith("--revision="));
const revision = revisionFlag?.slice("--revision=".length) || metadata.revision;
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Invalid upstream revision.");
const urls = ["README.md", "LICENSE"].map((path) =>
  `https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/${revision}/${path}`);
const [markdown, license] = await Promise.all(urls.map(async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Directory fetch failed: HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 8_000_000) throw new Error("Upstream document exceeds the import size limit.");
  return text;
}));
await mkdir(output, { recursive: true });
await writeFile(`${output}/README.md`, markdown);
await writeFile(`${output}/LICENSE`, license);
const notes = await readFile(`${root}attached_assets/Pasted--Core-Architecture-Roles-The-standard-establishes-an-ar_1792028358163.txt`, "utf8");
await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/catalogue-import.ts", import.meta.url))],
  outfile: `${output}/import.mjs`, platform: "node", format: "esm", bundle: true,
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});
const { importMcpCatalogue } = await import(`${output}/import.mjs`);
try {
  const result = await importMcpCatalogue(markdown, revision, notes);
  console.info(JSON.stringify(result, null, 2));
  await writeFile(`${output}/import-result.json`, JSON.stringify(result, null, 2));
  process.exit(0);
} catch (error) {
  console.error("Catalogue import failed:", error.message);
  process.exit(1);
}
