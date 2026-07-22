if (typeof window !== "undefined") throw new Error("AWS KMS modules are server-only.");
import { DecryptCommand, GenerateDataKeyCommand, KMSClient, type KMSClientConfig } from "@aws-sdk/client-kms";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import type { PlaidKeyEncryptionService } from "./encryption.ts";

const ENCRYPTION_CONTEXT = { application: "covarify", purpose: "plaid-access-token" } as const;
type KmsClient = Pick<KMSClient, "send">;

export class AwsKmsKeyEncryptionService implements PlaidKeyEncryptionService {
  readonly keyVersion: string;
  private readonly client: KmsClient;
  constructor(input: { region: string; keyId: string; roleArn?: string; client?: KmsClient; clientConfig?: Omit<KMSClientConfig, "region" | "credentials"> }) {
    if (!input.region.trim()) throw new Error("AWS KMS region is required.");
    if (!input.keyId.trim()) throw new Error("AWS KMS key ID or alias is required.");
    if (!input.client && !input.roleArn?.trim()) throw new Error("AWS_ROLE_ARN is required for Vercel OIDC authentication.");
    this.keyVersion = input.keyId;
    this.client = input.client ?? new KMSClient({
      ...input.clientConfig,
      region: input.region,
      credentials: awsCredentialsProvider({ roleArn: input.roleArn! }),
    });
  }
  async generateDataKey() {
    const output = await this.client.send(new GenerateDataKeyCommand({ KeyId: this.keyVersion, KeySpec: "AES_256", EncryptionContext: ENCRYPTION_CONTEXT }));
    if (!output.Plaintext || output.Plaintext.byteLength !== 32 || !output.CiphertextBlob) throw new Error("AWS KMS returned an incomplete AES-256 data key.");
    return { plaintextKey: output.Plaintext, wrappedKey: Buffer.from(output.CiphertextBlob).toString("base64"), keyVersion: output.KeyId ?? this.keyVersion };
  }
  async unwrapDataKey(wrappedKey: string) {
    if (!wrappedKey) throw new Error("AWS KMS wrapped data key is required.");
    const output = await this.client.send(new DecryptCommand({ CiphertextBlob: Buffer.from(wrappedKey, "base64"), EncryptionContext: ENCRYPTION_CONTEXT }));
    if (!output.Plaintext || output.Plaintext.byteLength !== 32) throw new Error("AWS KMS returned an invalid AES-256 data key.");
    return output.Plaintext;
  }
}
