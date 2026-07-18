if (typeof window !== "undefined") throw new Error("Plaid production modules are server-only.");
import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import type { JWKPublicKey, PlaidApi } from "plaid";

type JwtHeader = { alg?: string; kid?: string };
type JwtPayload = { iat?: number; request_body_sha256?: string };
const decode = <T>(value: string): T => JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;

export async function verifyPlaidWebhook(input: { verificationHeader: string | null; rawBody: string; client: PlaidApi; nowSeconds?: number }) {
  if (!input.verificationHeader) return false;
  const parts = input.verificationHeader.split(".");
  if (parts.length !== 3) return false;
  const header = decode<JwtHeader>(parts[0]);
  if (header.alg !== "ES256" || !header.kid) return false;
  const keyResponse = await input.client.webhookVerificationKeyGet({ key_id: header.kid });
  const jwk = keyResponse.data.key as JWKPublicKey;
  if (jwk.alg !== "ES256" || jwk.kty !== "EC" || jwk.crv !== "P-256") return false;
  const key = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
  const signatureValid = verify("sha256", Buffer.from(`${parts[0]}.${parts[1]}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(parts[2], "base64url"));
  if (!signatureValid) return false;
  const payload = decode<JwtPayload>(parts[1]);
  const current = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!payload.iat || Math.abs(current - payload.iat) > 300 || !payload.request_body_sha256) return false;
  const actual = Buffer.from(createHash("sha256").update(input.rawBody).digest("hex"));
  const expected = Buffer.from(payload.request_body_sha256);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
