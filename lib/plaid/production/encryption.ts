if (typeof window !== "undefined") throw new Error("Plaid production modules are server-only.");
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AwsKmsKeyEncryptionService } from "./aws-kms.ts";

type TokenEnvelope = { v: 1; alg: "A256GCM"; nonce: string; tag: string; data: string; wrappedKey: string };
export type EncryptedToken = { ciphertext: string; keyVersion: string };

export interface PlaidKeyEncryptionService {
  readonly keyVersion: string;
  generateDataKey(): Promise<{ plaintextKey: Uint8Array; wrappedKey: string; keyVersion?: string }>;
  unwrapDataKey(wrappedKey: string, keyVersion: string): Promise<Uint8Array>;
}

export interface PlaidTokenCipher {
  encrypt(plaintext: string): Promise<EncryptedToken>;
  decrypt(value: EncryptedToken): Promise<string>;
}

export class KmsEnvelopePlaidTokenCipher implements PlaidTokenCipher {
  private readonly kms: PlaidKeyEncryptionService;
  constructor(kms: PlaidKeyEncryptionService) { this.kms = kms; }

  async encrypt(plaintext: string): Promise<EncryptedToken> {
    if (!plaintext) throw new Error("Cannot encrypt an empty Plaid access token.");
    const { plaintextKey, wrappedKey, keyVersion } = await this.kms.generateDataKey();
    const key = Buffer.from(plaintextKey);
    if (key.length !== 32) throw new Error("KMS returned an invalid Plaid data key.");
    try {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce);
      const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const envelope: TokenEnvelope = { v: 1, alg: "A256GCM", nonce: nonce.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64"), wrappedKey };
      return { ciphertext: Buffer.from(JSON.stringify(envelope)).toString("base64"), keyVersion: keyVersion ?? this.kms.keyVersion };
    } finally { key.fill(0); }
  }

  async decrypt(value: EncryptedToken): Promise<string> {
    const envelope = JSON.parse(Buffer.from(value.ciphertext, "base64").toString("utf8")) as TokenEnvelope;
    if (envelope.v !== 1 || envelope.alg !== "A256GCM" || !envelope.wrappedKey) throw new Error("Unsupported Plaid token envelope.");
    const key = Buffer.from(await this.kms.unwrapDataKey(envelope.wrappedKey, value.keyVersion));
    if (key.length !== 32) throw new Error("KMS returned an invalid Plaid data key.");
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64"));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]).toString("utf8");
    } finally { key.fill(0); }
  }
}

export function readTokenCipher(): PlaidTokenCipher {
  if (process.env.PLAID_KMS_PROVIDER !== "aws") throw new Error("Production Plaid KMS is not configured. Set PLAID_KMS_PROVIDER=aws.");
  const region = process.env.AWS_REGION?.trim();
  const keyId = process.env.PLAID_KMS_KEY_ID?.trim();
  const roleArn = process.env.AWS_ROLE_ARN?.trim();
  if (!region || !keyId || !roleArn) throw new Error("AWS KMS requires AWS_REGION, PLAID_KMS_KEY_ID, and AWS_ROLE_ARN.");
  return new KmsEnvelopePlaidTokenCipher(new AwsKmsKeyEncryptionService({ region, keyId, roleArn }));
}

export class UnitTestKeyEncryptionService implements PlaidKeyEncryptionService {
  readonly keyVersion: string;
  private readonly wrappingKey: Buffer;
  constructor(keyVersion = "test-v1", wrappingKey = randomBytes(32), runtime = process.env.NODE_ENV) {
    if (runtime === "production") throw new Error("The Plaid unit-test key adapter cannot run in Production.");
    this.keyVersion = keyVersion;
    this.wrappingKey = wrappingKey;
  }
  async generateDataKey() {
    const plaintextKey = randomBytes(32);
    return { plaintextKey, wrappedKey: this.wrap(plaintextKey) };
  }
  async unwrapDataKey(wrappedKey: string) { return this.unwrap(wrappedKey); }
  private wrap(value: Uint8Array) {
    const nonce = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", this.wrappingKey, nonce);
    const data = Buffer.concat([cipher.update(value), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), data]).toString("base64");
  }
  private unwrap(value: string) {
    const payload = Buffer.from(value, "base64"); const decipher = createDecipheriv("aes-256-gcm", this.wrappingKey, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28)); return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]);
  }
}
