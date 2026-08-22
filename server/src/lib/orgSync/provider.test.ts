import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bodyHash, setKeySetForTests, verifyWebhookSignature } from "./provider.js";

const ISSUER = "https://auth.test.local";

let privateKey: CryptoKey;
let otherKey: CryptoKey;

async function sign(payload: Record<string, unknown>, key = privateKey, issuer = ISSUER, expiresIn = "10m") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

beforeAll(async () => {
  process.env.SWALHA_SSO_CLIENT_ID = "test-client";
  process.env.SWALHA_SSO_CLIENT_SECRET = "test-secret";
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey as CryptoKey;
  otherKey = (await generateKeyPair("RS256")).privateKey as CryptoKey;
  const jwk = await exportJWK(pair.publicKey);
  setKeySetForTests(createLocalJWKSet({ keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" }] }), ISSUER);
});

afterAll(() => setKeySetForTests(null));

describe("verifyWebhookSignature", () => {
  const body = Buffer.from(JSON.stringify({ id: "evt_1", version: 3, organization: { id: "org" } }));

  it("accepts a provider-signed JWT whose sha256 matches the raw body", async () => {
    const token = await sign({ jti: "d1", event: "evt_1", sha256: bodyHash(body) });
    await expect(verifyWebhookSignature(token, body)).resolves.toMatchObject({ jti: "d1", event: "evt_1" });
  });

  it("rejects a body that does not match the signed hash", async () => {
    const token = await sign({ jti: "d1", event: "evt_1", sha256: bodyHash(body) });
    await expect(verifyWebhookSignature(token, Buffer.from(body.toString() + " "))).rejects.toThrow(/hash mismatch/);
  });

  it("rejects a missing hash claim, a foreign key, a wrong issuer and an expired token", async () => {
    await expect(verifyWebhookSignature(await sign({ jti: "d1" }), body)).rejects.toThrow();
    await expect(verifyWebhookSignature(await sign({ sha256: bodyHash(body) }, otherKey), body)).rejects.toThrow();
    await expect(
      verifyWebhookSignature(await sign({ sha256: bodyHash(body) }, privateKey, "https://evil.test"), body)
    ).rejects.toThrow();
    await expect(
      verifyWebhookSignature(await sign({ sha256: bodyHash(body) }, privateKey, ISSUER, "-1m"), body)
    ).rejects.toThrow();
  });

  it("rejects garbage", async () => {
    await expect(verifyWebhookSignature("not-a-jwt", body)).rejects.toThrow();
  });
});
