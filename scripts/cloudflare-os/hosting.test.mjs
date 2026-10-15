import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { hostingReport, assertPreviewAllowed } from './hosting-policy.mjs';
import { createStatusServer } from './status-server.mjs';

test('preview requires an explicit unsafe opt-in and refuses production', () => {
  assert.equal(assertPreviewAllowed([], 'development'), false);
  assert.equal(assertPreviewAllowed([], 'production'), false);
  assert.equal(assertPreviewAllowed(['--unsafe-trusted-preview'], 'development'), true);
  assert.throws(() => assertPreviewAllowed(['--unsafe-trusted-preview'], 'production'));
  assert.equal(hostingReport().productionReady, false);
  assert.equal(hostingReport().executionEnabled, false);
});

test('production preflight fails without launching a runtime', () => {
  const result = spawnSync(process.execPath, [new URL('./production-check.mjs', import.meta.url).pathname], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).blockers.length, 4);
});

test('status server distinguishes liveness from readiness and blocks all execution', async t => {
  const server = createStatusServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.close(); server.closeAllConnections(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [path, code] of [['livez', 200], ['status', 200], ['healthz', 503]]) {
    const response = await fetch(`${origin}/cloudflare-os/${path}`);
    assert.equal(response.status, code);
    const body = await response.json();
    assert.equal(body.executionEnabled, false);
    assert.equal(body.productionReady, false);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const page = await fetch(`${origin}/cloudflare-os/`);
  assert.equal(page.status, 503);
  assert.match(await page.text(), /Execution is disabled/);
  for (const path of ['/cloudflare-os/api', '/cloudflare-os/api/signup', '/api', '/cloudflare-os/%2e%2e/api']) {
    const response = await fetch(`${origin}${path}`, { method: 'POST', body: '{}' });
    assert.equal(response.status, 503);
  }
  const request = http.request(`${origin}/cloudflare-os/api`, {
    headers: { Connection: 'Upgrade', Upgrade: 'websocket' },
  });
  request.end();
  const [response] = await once(request, 'response');
  assert.equal(response.statusCode, 503);
  response.resume();
});
