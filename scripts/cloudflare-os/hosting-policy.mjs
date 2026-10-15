// These are verified blockers, not operator attestations or feature flags.
export function hostingReport() {
  return {
    runtime: 'cloudflare-os',
    mode: 'blocked-self-hosting',
    productionReady: false,
    executionEnabled: false,
    agentFoundryExecutionConnected: false,
    blockers: [
      { id: 'storage', detail: 'Local Durable Object SQLite, KV and R2 state has no verified durable Replit deployment volume or compatible remote backend and restore path.' },
      { id: 'identity', detail: 'Enterprise identity, tenant membership, administrator assignment and session revocation are not configured or verified for this OS instance.' },
      { id: 'isolation', detail: 'workerd alone is not a hardened sandbox; no separate Replit execution boundary for untrusted gadgets has been verified.' },
      { id: 'runtime', detail: 'Upstream standalone workerd production tooling is still coming soon; the Wrangler runner is development-only.' },
    ],
    documentation: 'docs/cloudflare-os-replit.md',
  };
}

export function assertPreviewAllowed(args, environment) {
  if (!args.includes('--unsafe-trusted-preview')) return false;
  if (environment === 'production') {
    throw new Error('The Wrangler preview cannot run with NODE_ENV=production. See docs/cloudflare-os-replit.md.');
  }
  return true;
}
