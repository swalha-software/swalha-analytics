// Talking to SWALHA Auth: OIDC discovery, JWKS, webhook signature
// verification and the client_credentials token for the pull API. Reuses the
// SSO client registration (SWALHA_SSO_*) — the sync is the same application.

import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const SSO_PROVIDER_ID = "swalha";
export const SYNC_SCOPE = "sync:read";

export type Discovery = {
  issuer: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint: string;
  jwks_uri: string;
};

export function syncConfig() {
  const clientId = process.env.SWALHA_SSO_CLIENT_ID;
  const clientSecret = process.env.SWALHA_SSO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    discoveryUrl: process.env.SWALHA_SSO_DISCOVERY_URL ?? "https://auth.swalha.com/.well-known/openid-configuration",
  };
}

export const orgSyncEnabled = () => syncConfig() !== null;

let discovery: Promise<Discovery> | null = null;
let jwks: JWTVerifyGetKey | null = null;

export async function getDiscovery(): Promise<Discovery> {
  const cfg = syncConfig();
  if (!cfg) throw new Error("SWALHA_SSO_CLIENT_ID/SECRET not set");
  if (!discovery) {
    discovery = fetch(cfg.discoveryUrl)
      .then(async res => {
        if (!res.ok) throw new Error(`discovery ${cfg.discoveryUrl}: HTTP ${res.status}`);
        return (await res.json()) as Discovery;
      })
      .catch(e => {
        discovery = null; // retry next time
        throw e;
      });
  }
  return discovery;
}

async function getJwks(): Promise<JWTVerifyGetKey> {
  if (!jwks) {
    const d = await getDiscovery();
    jwks = createRemoteJWKSet(new URL(d.jwks_uri));
  }
  return jwks;
}

/** Test seam: use a local key set instead of the remote JWKS. */
export function setKeySetForTests(keySet: JWTVerifyGetKey | null, issuer?: string) {
  jwks = keySet;
  discovery = issuer
    ? Promise.resolve({
        issuer,
        token_endpoint: `${issuer}/api/auth/oauth2/token`,
        userinfo_endpoint: `${issuer}/api/auth/oauth2/userinfo`,
        end_session_endpoint: `${issuer}/api/auth/oauth2/end-session`,
        jwks_uri: `${issuer}/api/auth/jwks`,
      })
    : null;
}

export const bodyHash = (rawBody: Buffer | string) => createHash("sha256").update(rawBody).digest("base64url");

/**
 * Verifies `X-Swalha-Signature`: an RS256 JWT from the provider's JWKS whose
 * `sha256` is the base64url hash of the raw request body. Returns the payload
 * (jti = delivery id, event = event id) or throws.
 */
export async function verifyWebhookSignature(signature: string, rawBody: Buffer | string) {
  const d = await getDiscovery();
  const { payload } = await jwtVerify(signature, await getJwks(), { issuer: d.issuer, algorithms: ["RS256"] });
  if (typeof payload.sha256 !== "string" || payload.sha256 !== bodyHash(rawBody)) {
    throw new Error("signature body hash mismatch");
  }
  return payload as { jti?: string; event?: string; sha256: string };
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** client_credentials token for the pull API (scope sync:read, JWT audience <issuer>/api/sync). */
export async function getSyncToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const cfg = syncConfig();
  if (!cfg) throw new Error("SWALHA_SSO_CLIENT_ID/SECRET not set");
  const d = await getDiscovery();
  const res = await fetch(d.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: SYNC_SCOPE,
      resource: `${d.issuer}/api/sync`,
    }),
  });
  if (!res.ok) throw new Error(`token endpoint: HTTP ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 300) * 1000 };
  return body.access_token;
}

export async function syncGet<T>(path: string): Promise<T> {
  const d = await getDiscovery();
  const res = await fetch(`${d.issuer}/api/sync${path}`, {
    headers: { authorization: `Bearer ${await getSyncToken()}` },
  });
  if (!res.ok) throw new Error(`GET /api/sync${path}: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}
