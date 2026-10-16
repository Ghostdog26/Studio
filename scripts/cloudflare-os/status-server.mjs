import http from 'node:http';
import { hostingReport } from './hosting-policy.mjs';

const prefix = '/cloudflare-os';
const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Cloudflare OS — hosting blocked</title>
<style>body{font:17px/1.6 system-ui;max-width:760px;margin:8vh auto;padding:24px;color:#172033;background:#f5f7fa}h1{line-height:1.2}li{margin:12px 0}code{font-size:14px}</style></head>
<body><h1>Cloudflare OS is not production-ready on this host</h1>
<p>Execution is disabled. The development runner is not a persistent enterprise service.</p>
<ul>${hostingReport().blockers.map(b => `<li>${b.detail}</li>`).join('')}</ul>
<p>Control Plane’s PostgreSQL data is unchanged. No generated code runs through this endpoint.</p>
<p>See <code>docs/cloudflare-os-replit.md</code> in the project for the evidence and requirements.</p></body></html>`;

export function createStatusServer() {
  return http.createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const headers = {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'",
    };
    if (path === `${prefix}/livez` || path === `${prefix}/status` || path === `${prefix}/healthz`) {
      const live = path.endsWith('/livez');
      res.writeHead(path.endsWith('/healthz') ? 503 : 200, { ...headers, 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...hostingReport(), status: live ? 'alive' : 'blocked' }));
    } else if (path === prefix || path === `${prefix}/`) {
      res.writeHead(503, { ...headers, 'content-type': 'text/html; charset=utf-8' });
      res.end(page);
    } else {
      res.writeHead(503, { ...headers, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Cloudflare OS execution is disabled.', productionReady: false }));
    }
  }).on('upgrade', (_req, socket) => {
    socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  });
}

export function startStatusServer(port) {
  const server = createStatusServer();
  server.listen(port, '0.0.0.0', () => {
    console.info(`Cloudflare OS status listening on ${port}${prefix}/; execution disabled.`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close();
      server.closeAllConnections();
    });
  }
  return server;
}
