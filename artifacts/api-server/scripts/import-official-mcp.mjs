import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createHash } from "node:crypto";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const vendor = `${root}vendor/mcp-official`;
const output = `${root}generated-artifacts/official-mcp`;
const repos = ["typescript-sdk", "python-sdk", "go-sdk", "csharp-sdk", "rust-sdk", "ruby-sdk", "java-sdk", "swift-sdk", "php-sdk", "kotlin-sdk"];

async function revision(repo) {
  const { stdout } = await exec("git", ["ls-remote", `https://github.com/modelcontextprotocol/${repo}`, "HEAD"], { timeout: 30000 });
  const sha = stdout.split(/\s/)[0];
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error(`Cannot pin official repository: ${repo}`);
  return sha;
}
async function download(repo, sha, path, allowMissing = false) {
  const response = await fetch(`https://raw.githubusercontent.com/modelcontextprotocol/${repo}/${sha}/${path}`, { signal: AbortSignal.timeout(30000) });
  if (allowMissing && response.status === 404) return null;
  if (!response.ok) throw new Error(`Official source fetch failed: ${repo}/${path} HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error(`Official source too large: ${repo}/${path}`);
  return text;
}
async function snapshotRepo(repo, destination) {
  const sha = await revision(repo);
  const [readme, licenseFirst] = await Promise.all([
    download(repo, sha, "README.md"),
    download(repo, sha, "LICENSE", true),
  ]);
  const license = licenseFirst ?? await download(repo, sha, "LICENSE.md", true) ?? await download(repo, sha, "LICENSE.txt");
  await mkdir(destination, { recursive: true });
  await writeFile(`${destination}/README.md`, readme);
  await writeFile(`${destination}/LICENSE`, license);
  return { repo, sourceRevision: sha, readme };
}
await mkdir(output, { recursive: true });
const spec = await snapshotRepo("modelcontextprotocol", `${vendor}/specification`);
const protocolVersion = /schema\/(\d{4}-\d{2}-\d{2})\/schema\.(?:json|ts)/.exec(spec.readme)?.[1];
if (!protocolVersion) throw new Error("Cannot identify the official protocol schema revision.");
const schema = await download("modelcontextprotocol", spec.sourceRevision, `schema/${protocolVersion}/schema.json`);
JSON.parse(schema);
await writeFile(`${vendor}/specification/schema.json`, schema);
const specificationDocuments = [
  ["architecture", "architecture/index.mdx"],
  ["transports", "basic/transports/index.mdx"],
  ["stdio", "basic/transports/stdio.mdx"],
  ["streamable-http", "basic/transports/streamable-http.mdx"],
  ["authorization", "basic/authorization/index.mdx"],
  ["client-registration", "basic/authorization/client-registration.mdx"],
  ["authorization-security", "basic/authorization/security-considerations.mdx"],
  ["tools", "server/tools.mdx"],
  ["resources", "server/resources.mdx"],
  ["prompts", "server/prompts.mdx"],
];
const specificationTexts = {};
for (let offset = 0; offset < specificationDocuments.length; offset += 3) {
  await Promise.all(specificationDocuments.slice(offset, offset + 3).map(async ([name, path]) => {
    const content = await download("modelcontextprotocol", spec.sourceRevision, `docs/specification/${protocolVersion}/${path}`);
    await writeFile(`${vendor}/specification/${name}.mdx`, content);
    specificationTexts[name] = content;
  }));
}
const sources = [];
// Bound concurrency and retain original licenses alongside source README snapshots.
for (let offset = 0; offset < repos.length; offset += 3) {
  sources.push(...await Promise.all(repos.slice(offset, offset + 3).map((repo) => snapshotRepo(repo, `${vendor}/sdks/${repo}`))));
}
const sourceFiles = [
  "specification/README.md", "specification/LICENSE", "specification/schema.json",
  ...specificationDocuments.map(([name]) => `specification/${name}.mdx`),
  ...repos.flatMap((repo) => [`sdks/${repo}/README.md`, `sdks/${repo}/LICENSE`]),
];
const assetHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async (path) => [
  path, createHash("sha256").update(await readFile(`${vendor}/${path}`)).digest("hex"),
])));
const metadata = {
  organization: "https://github.com/modelcontextprotocol", specificationRevision: spec.sourceRevision, protocolVersion,
  sdks: sources.map(({ repo, sourceRevision }) => ({ repo, sourceRevision })),
  assetHashes,
  content: "Pinned official specification schema plus README/license SDK source snapshots. Full SDK implementations are obtained through their declared package managers, not vendored here.",
};
await writeFile(`${vendor}/sources.json`, JSON.stringify(metadata, null, 2) + "\n");
await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/import-official-mcp.ts", import.meta.url))],
  outfile: `${output}/import.mjs`, platform: "node", format: "esm", bundle: true,
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});
const { importOfficialMcpKnowledge } = await import(`${output}/import.mjs`);
try {
  console.info(JSON.stringify(await importOfficialMcpKnowledge(metadata, spec.readme,
    Object.fromEntries(sources.map(({ repo, readme }) => [repo, readme])), specificationTexts), null, 2));
  process.exit(0);
} catch (error) { console.error("Official source import failed:", error.message); process.exit(1); }
