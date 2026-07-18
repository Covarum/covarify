if (typeof window !== "undefined") throw new Error("Plaid production modules are server-only.");
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedToken = { ciphertext: string; keyVersion: string };
export interface PlaidTokenCipher { encrypt(plaintext: string): EncryptedToken; decrypt(value: EncryptedToken): string }

export class AesGcmPlaidTokenCipher implements PlaidTokenCipher {
  private readonly activeVersion: string;
  private readonly keys: ReadonlyMap<string, Buffer>;
  constructor(activeVersion: string, keys: ReadonlyMap<string, Buffer>) {
    this.activeVersion = activeVersion;
    this.keys = keys;
    const active = keys.get(activeVersion);
    if (!active || active.length !== 32) throw new Error("The active Plaid token key must be exactly 32 bytes.");
  }

  encrypt(plaintext: string): EncryptedToken {
    if (!plaintext) throw new Error("Cannot encrypt an empty Plaid access token.");
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.keys.get(this.activeVersion)!, nonce);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext: Buffer.concat([nonce, tag, encrypted]).toString("base64"), keyVersion: this.activeVersion };
  }

  decrypt(value: EncryptedToken): string {
    const key = this.keys.get(value.keyVersion);
    if (!key) throw new Error("Plaid token key version is unavailable.");
    const payload = Buffer.from(value.ciphertext, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
  }
}

export function readTokenCipher(environment: NodeJS.ProcessEnv = process.env): PlaidTokenCipher {
  const activeVersion = (environment.PLAID_TOKEN_KEY_VERSION || "").trim();
  const raw = environment.PLAID_TOKEN_KEYRING_JSON || "";
  if (!activeVersion || !raw) throw new Error("Plaid token encryption is not configured.");
  const parsed = JSON.parse(raw) as Record<string, string>;
  return new AesGcmPlaidTokenCipher(activeVersion, new Map(Object.entries(parsed).map(([version, value]) => [version, Buffer.from(value, "base64")])));
}
