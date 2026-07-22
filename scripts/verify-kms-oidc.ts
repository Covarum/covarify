import { timingSafeEqual } from "node:crypto";
import { AwsKmsKeyEncryptionService } from "../lib/plaid/production/aws-kms.ts";

if (process.env.KMS_OIDC_CANARY !== "true") {
  console.log("AWS KMS OIDC canary skipped.");
  process.exit(0);
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the AWS KMS OIDC canary.`);
  return value;
}

const kms = new AwsKmsKeyEncryptionService({
  region: required("AWS_REGION"),
  keyId: required("PLAID_KMS_KEY_ID"),
  roleArn: required("AWS_ROLE_ARN"),
});

const generated = await kms.generateDataKey();
const generatedKey = Buffer.from(generated.plaintextKey);
const decryptedKey = Buffer.from(await kms.unwrapDataKey(generated.wrappedKey));

try {
  if (generatedKey.length !== decryptedKey.length || !timingSafeEqual(generatedKey, decryptedKey)) {
    throw new Error("AWS KMS OIDC canary decrypted a different data key.");
  }
  console.log("AWS KMS OIDC canary passed.");
} finally {
  generatedKey.fill(0);
  decryptedKey.fill(0);
}
