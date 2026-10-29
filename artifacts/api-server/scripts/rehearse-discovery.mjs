// Explicit opt-in only. Never accepts DATABASE_URL or a caller-supplied cluster.
import { build } from "esbuild";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

if (process.argv.slice(2).join(" ") !== "--disposable-local-postgres") {
  console.error("Opt in with: pnpm --filter @workspace/api-server discovery:rehearse --disposable-local-postgres");
  process.exit(1);
}
const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = await mkdtemp(join(tmpdir(), "mcp-infra-rehearsal-"));
const data = join(dir, "pgdata");
// No inherited enterprise credentials, policies, endpoints or database configuration.
const env = Object.fromEntries(["PATH", "HOME", "USER", "LANG", "LD_LIBRARY_PATH"]
  .filter(key => process.env[key]).map(key => [key, process.env[key]]));
function run(command, args, extra = {}) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: "inherit", timeout: 120_000, ...extra });
  if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status})`, { cause: result.error });
}
const reservation = createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const databaseUrl = `postgresql://rehearsal@127.0.0.1:${port}/postgres`;
let child;
const terminate = () => { if (child?.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch {} } };
process.once("SIGINT", terminate);
process.once("SIGTERM", terminate);
let watchdog;
try {
  run("initdb", ["-D", data, "-U", "rehearsal", "-A", "trust", "--no-locale"]);
  run("pg_ctl", ["-D", data, "-l", join(dir, "postgres.log"), "-o",
    `-h 127.0.0.1 -p ${port} -k ${dir}`, "-w", "start"]);
  const testEnv = { ...env, DATABASE_URL: databaseUrl };
  run("pnpm", ["--filter", "@workspace/db", "push-force"], { env: testEnv });
  const options = {
    bundle: true, platform: "node", format: "esm", external: ["pg-native"],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  };
  await build({ ...options, entryPoints: [join(root, "scripts/src/discovery-coordination-setup.ts")],
    outfile: join(dir, "setup.mjs") });
  run(process.execPath, [join(dir, "setup.mjs")], { env: testEnv });
  await build({ ...options, entryPoints: [join(root, "artifacts/api-server/src/lib/mcp-discovery.integration.test.ts")],
    outfile: join(dir, "integration.mjs") });
  await build({ ...options, entryPoints: [join(root, "artifacts/api-server/src/lib/fixtures/discovery-rehearsal-worker.ts")],
    outfile: join(dir, "worker.mjs") });
  child = spawn(process.execPath, ["--test", join(dir, "integration.mjs")], {
    env: { ...testEnv, MCP_DISCOVERY_INFRA_REHEARSAL: dir }, stdio: "inherit", detached: true,
  });
  watchdog = setTimeout(terminate, 180_000);
  const status = await new Promise(resolve => child.once("exit", (code, signal) => resolve(signal ? 1 : code ?? 1)));
  if (status !== 0) {
    process.exitCode = status;
    console.error((await readFile(join(dir, "postgres.log"), "utf8")).slice(-6000));
  }
} finally {
  clearTimeout(watchdog);
  terminate();
  process.removeListener("SIGINT", terminate);
  process.removeListener("SIGTERM", terminate);
  // Only the freshly created directory above is ever stopped or deleted.
  spawnSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { env, stdio: "ignore", timeout: 15_000 });
  await rm(dir, { recursive: true, force: true });
}
