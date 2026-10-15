// Development hosting adapter for the actual upstream Cloudflare OS stack.
// This is not a production workerd deployment or an OpenShell replacement.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import source from './source.json' with { type: 'json' };
import { assertPreviewAllowed } from './hosting-policy.mjs';
import { startStatusServer } from './status-server.mjs';

const root = fileURLToPath(new URL('../../vendor/cloudflare-os/', import.meta.url));
const prefix = '/cloudflare-os';
const port = Number(process.env.PORT);
const upstreamPort = 8787;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('A valid PORT is required.');
if (!assertPreviewAllowed(process.argv.slice(2), process.env.NODE_ENV)) {
  startStatusServer(port);
} else {
console.warn('UNSAFE TRUSTED PREVIEW ONLY: ephemeral data, no enterprise isolation or identity guarantees.');
if (!existsSync(`${root}/packages/workshop-frontend/dist/index.html`)) {
  throw new Error('Run node scripts/cloudflare-os/prepare.mjs before starting Cloudflare OS.');
}

// Only a workspace preview origin; production hosting needs its own configuration.
const previewOrigin = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}${prefix}`
  : `http://localhost:${port}${prefix}`;
const child = spawn(process.execPath, ['scripts/run-dev-server.ts', '--serve-frontend-assets', '--port', String(upstreamPort)], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    npm_config_manage_package_manager_versions: 'false',
    npm_config_package_manager_strict: 'false',
    VITE_APP_BASE_PATH: `${prefix}/`,
    PUBLIC_BASE_URL: previewOrigin,
    VP_RUN_CONCURRENCY_LIMIT: '2',
    CLOUDFLARE_OS_NO_BUILD_CACHE: 'true',
    CLOUDFLARE_OS_REPLIT_PREVIEW: 'true',
    WRANGLER_SEND_METRICS: 'false',
  },
});
let stopping = false;
child.on('error', (error) => {
  console.error('Cloudflare OS could not start:', error.message);
  process.exit(1);
});
child.on('exit', (code, signal) => {
  if (!stopping) {
    console.error(`Cloudflare OS exited (${signal || code}).`);
    process.exit(code || 1);
  }
});

function upstreamPath(url = '/') {
  if (url === prefix || url.startsWith(`${prefix}?`)) return url.slice(prefix.length) || '/';
  if (!url.startsWith(`${prefix}/`)) return null;
  return url.slice(prefix.length);
}
function options(req, path) {
  return {
    hostname: '127.0.0.1', port: upstreamPort, path, method: req.method,
    headers: { ...req.headers, 'x-forwarded-prefix': prefix },
  };
}
const server = http.createServer(async (req, res) => {
  const path = upstreamPath(req.url);
  if (path === null) {
    res.writeHead(404).end('Not found');
    return;
  }
  if (req.url === prefix) {
    res.writeHead(308, { location: `${prefix}/` }).end();
    return;
  }
  if (path === '/healthz') {
    try {
      const response = await fetch(`http://127.0.0.1:${upstreamPort}/`, { signal: AbortSignal.timeout(3000) });
      const body = await response.text();
      if (!response.ok || !body.includes('id="root"')) throw new Error('Upstream is not ready');
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({
        status: 'running', runtime: 'cloudflare-os', engine: 'workerd',
        sourceRevision: source.revision, mode: source.mode,
        productionReady: false, agentFoundryExecutionConnected: false,
      }));
    } catch {
      res.writeHead(503, { 'content-type': 'application/json', 'retry-after': '5' })
        .end(JSON.stringify({ status: 'starting-or-unavailable', productionReady: false }));
    }
    return;
  }
  const upstream = http.request(options(req, path), (reply) => {
    const headers = { ...reply.headers };
    if (typeof headers.location === 'string' && headers.location.startsWith('/') && !headers.location.startsWith('//')) {
      headers.location = `${prefix}${headers.location}`;
    }
    res.writeHead(reply.statusCode || 502, headers);
    reply.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(503, { 'content-type': 'text/plain', 'retry-after': '5' });
    res.end('Cloudflare OS is starting or unavailable. Check its workflow logs.');
  });
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
});

server.on('upgrade', (req, socket, head) => {
  const path = upstreamPath(req.url);
  if (!path) { socket.destroy(); return; }
  const upstream = http.request(options(req, path));
  upstream.on('upgrade', (reply, peer, upstreamHead) => {
    socket.write(`HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}\r\n`);
    for (const [key, value] of Object.entries(reply.headers)) {
      if (value !== undefined) socket.write(`${key}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`);
    }
    socket.write('\r\n');
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) peer.write(head);
    socket.pipe(peer).pipe(socket);
    peer.on('error', () => socket.destroy());
    socket.on('error', () => peer.destroy());
    socket.on('close', () => peer.destroy());
    peer.on('close', () => socket.destroy());
  });
  upstream.on('response', () => socket.destroy());
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  upstream.end();
});
server.listen(port, '0.0.0.0', () => {
  console.info(`Cloudflare OS preview adapter listening on ${port}${prefix}/. Upstream startup continues.`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close();
    child.kill(signal);
    const deadline = setTimeout(() => process.exit(1), 12000);
    child.once('exit', () => { clearTimeout(deadline); process.exit(0); });
  });
}
}
