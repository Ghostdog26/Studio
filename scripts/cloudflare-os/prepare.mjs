import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const root = fileURLToPath(new URL('../../vendor/cloudflare-os/', import.meta.url));
const env = {
  ...process.env,
  npm_config_manage_package_manager_versions: 'false',
  npm_config_package_manager_strict: 'false',
  VITE_APP_BASE_PATH: '/cloudflare-os/',
  VP_RUN_CONCURRENCY_LIMIT: '2',
};
if (!existsSync(`${root}/package.json`)) {
  throw new Error('The vendored Cloudflare OS source is missing.');
}
execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: root, env, stdio: 'inherit' });
// TS7's Node execve wrapper aborts with EBUSY in this environment. The same
// pinned native compiler runs correctly when spawned directly.
const resolveFromTypescript = createRequire(realpathSync(join(root, 'node_modules/typescript/package.json')));
const nativeCompiler = join(dirname(resolveFromTypescript.resolve('@typescript/typescript-linux-x64/package.json')), 'lib/tsc');
execFileSync(nativeCompiler, [], {
  cwd: join(root, 'packages/typed-storage'), env, stdio: 'inherit',
});
execFileSync('pnpm', ['--filter', '@gadgets/workshop-frontend', 'exec', 'vite', 'build'], {
  cwd: root, env, stdio: 'inherit',
});
