import { createHash, randomBytes } from "node:crypto";
import { z } from "zod/v4";
import { approvalIsCurrent, type DiscoveryApproval } from "./mcp-discovery-policy";
import { DiscoveryFailure, oauthExchange } from "./mcp-discovery-client";

const opaque = () => randomBytes(32).toString("base64url");
const token = z.string().min(1).max(16000).regex(/^[\x21-\x7e]+$/);
const tokenReply = z.object({
  access_token: token,
  token_type: z.string().regex(/^Bearer$/i),
  expires_in: z.number().int().positive().max(365 * 86400),
  refresh_token: token.optional(),
  scope: z.string().max(4000).optional(),
});
type Pending = { binding: string; verifier: string; expires: number };
type Credential = {
  binding: string; reference: string; access: string; refresh?: string; expires: number; deadline: number;
};
export type OAuthPost = typeof oauthExchange;

// Process-local, bounded, never serialized. Restart/eviction requires fresh consent.
export class DiscoveryOAuth {
  private pending = new Map<string, Pending>();
  private credentials = new Map<string, Credential>();
  private busy = new Map<string, symbol>();
  constructor(private post: OAuthPost = oauthExchange) {}

  private require(approval: DiscoveryApproval) {
    if (!approval.oauth || !approvalIsCurrent(approval)) throw new DiscoveryFailure("remote-denied");
    return approval.oauth;
  }

  private prune() {
    for (const [state, value] of this.pending) if (value.expires <= Date.now()) this.pending.delete(state);
    // Expired access tokens with refresh tokens remain usable only under a current binding.
    for (const [binding, value] of this.credentials) {
      if (value.deadline <= Date.now() || (value.expires <= Date.now() && !value.refresh)) this.credentials.delete(binding);
    }
  }

  revision(binding: string) { return this.credentials.get(binding)?.reference ?? null; }

  begin(approval: DiscoveryApproval, binding: string) {
    const config = this.require(approval);
    this.prune();
    if (this.pending.size >= 1000) throw new DiscoveryFailure("remote-denied");
    // Only one outstanding authorization for a binding.
    for (const [state, value] of this.pending) if (value.binding === binding) this.pending.delete(state);
    const state = opaque();
    const verifier = opaque();
    const expires = Math.min(Date.now() + 5 * 60000, Date.parse(approval.expiresAt));
    this.pending.set(state, { binding, verifier, expires });
    const url = new URL(config.authorizationEndpoint);
    url.search = new URLSearchParams({
      response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri,
      scope: config.scopes.join(" "), state, code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      resource: approval.endpoint,
    }).toString();
    return { authorizationUrl: url.toString(), expiresAt: new Date(expires).toISOString() };
  }

  async complete(
    approval: DiscoveryApproval, binding: string,
    input: { state: string; code: string; redirectUri: string }, signal: AbortSignal,
  ) {
    const config = this.require(approval);
    this.prune();
    const pending = this.pending.get(input.state);
    if (!pending || pending.binding !== binding || input.redirectUri !== config.redirectUri ||
        this.busy.has(binding)) throw new DiscoveryFailure("remote-denied");
    // Consume before I/O. A failed exchange or replay requires a new authorization.
    this.pending.delete(input.state);
    if (this.credentials.size >= 1000 && !this.credentials.has(binding)) throw new DiscoveryFailure("remote-denied");
    const operation = Symbol();
    this.busy.set(binding, operation);
    const previous = this.credentials.get(binding);
    try {
      const reply = await this.post(config.tokenEndpoint, new URLSearchParams({
        grant_type: "authorization_code", code: input.code, code_verifier: pending.verifier,
        client_id: config.clientId, redirect_uri: config.redirectUri, resource: approval.endpoint,
      }), signal);
      signal.throwIfAborted();
      // Revocation while the exchange is in flight must not resurrect credentials.
      if (this.credentials.get(binding) !== previous || this.busy.get(binding) !== operation) throw new DiscoveryFailure("remote-denied");
      return this.save(approval, binding, reply.body);
    } finally { if (this.busy.get(binding) === operation) this.busy.delete(binding); }
  }

  private save(approval: DiscoveryApproval, binding: string, body: unknown, previous?: Credential) {
    const config = this.require(approval);
    const parsed = tokenReply.safeParse(body);
    if (!parsed.success) throw new DiscoveryFailure("remote-denied");
    const value = parsed.data;
    if (value.scope !== undefined && value.scope.split(" ").some(scope => !config.scopes.includes(scope))) {
      throw new DiscoveryFailure("remote-denied");
    }
    const credential = {
      binding, reference: opaque(), access: value.access_token,
      refresh: value.refresh_token ?? previous?.refresh,
      expires: Math.min(Date.now() + value.expires_in * 1000, Date.parse(approval.expiresAt)),
      deadline: Date.parse(approval.expiresAt),
    };
    this.credentials.set(binding, credential);
    return { credentialReference: credential.reference, expiresAt: new Date(credential.expires).toISOString() };
  }

  access(approval: DiscoveryApproval, binding: string) {
    this.require(approval);
    const credential = this.credentials.get(binding);
    if (!credential || credential.expires <= Date.now() || this.busy.has(binding)) {
      throw new DiscoveryFailure("remote-denied");
    }
    return credential.access;
  }

  async refresh(approval: DiscoveryApproval, binding: string, reference: string, signal: AbortSignal) {
    const config = this.require(approval);
    const credential = this.credentials.get(binding);
    if (!credential?.refresh || credential.reference !== reference || this.busy.has(binding)) {
      throw new DiscoveryFailure("remote-denied");
    }
    const operation = Symbol();
    this.busy.set(binding, operation);
    try {
      const reply = await this.post(config.tokenEndpoint, new URLSearchParams({
        grant_type: "refresh_token", refresh_token: credential.refresh,
        client_id: config.clientId, resource: approval.endpoint,
      }), signal);
      signal.throwIfAborted();
      if (this.credentials.get(binding) !== credential || this.busy.get(binding) !== operation) throw new DiscoveryFailure("remote-denied");
      return this.save(approval, binding, reply.body, credential);
    } catch {
      if (this.busy.get(binding) === operation) this.invalidate(binding);
      throw new DiscoveryFailure("remote-denied");
    } finally { if (this.busy.get(binding) === operation) this.busy.delete(binding); }
  }

  invalidate(binding: string) {
    this.credentials.delete(binding);
    this.busy.delete(binding);
    for (const [state, value] of this.pending) if (value.binding === binding) this.pending.delete(state);
  }

  async revoke(approval: DiscoveryApproval, binding: string, reference: string, signal: AbortSignal) {
    const config = this.require(approval);
    const credential = this.credentials.get(binding);
    if (!credential || credential.reference !== reference) throw new DiscoveryFailure("remote-denied");
    this.invalidate(binding); // Local revocation is immediate, even if the provider is down.
    let remoteRevoked = true;
    // Revoke both; some providers do not cascade refresh-token revocation to access tokens.
    for (const [value, hint] of [[credential.refresh, "refresh_token"], [credential.access, "access_token"]]) {
      if (!value) continue;
      try {
        await this.post(config.revocationEndpoint, new URLSearchParams({
          token: value, token_type_hint: hint!, client_id: config.clientId,
        }), signal);
      } catch { remoteRevoked = false; }
    }
    return { revoked: true as const, remoteRevoked };
  }
}
