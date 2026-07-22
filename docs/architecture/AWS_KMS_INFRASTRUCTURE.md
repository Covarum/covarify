# AWS KMS production infrastructure

## Approved topology

- Dedicated AWS account: **Covarify Production Security**. Do not place the key in a founder's personal account or a development account.
- Region: **`us-east-1` (N. Virginia)**, matching the intended primary US deployment and minimizing cross-region dependency. KMS ciphertext is Region-bound.
- Key: one single-Region, customer-managed, symmetric encrypt/decrypt key; key spec `SYMMETRIC_DEFAULT`, origin `AWS_KMS`.
- Alias: **`alias/covarify-production-plaid-tokens`**.
- Encryption context required on every cryptographic call: `application=covarify` and `purpose=plaid-access-token`. These values are identifiers, not secrets, and appear in CloudTrail.
- Application operations: only `kms:GenerateDataKey` and `kms:Decrypt`. The adapter does not call `Encrypt`, `ReEncrypt`, grants, administration, or deletion APIs.

The application requests an AES-256 data key, encrypts one Plaid token locally with AES-256-GCM, erases the plaintext data key buffer, and stores only the authenticated envelope and KMS-wrapped data key. `Decrypt` omits a key identifier because the KMS ciphertext blob identifies its key; this preserves old envelopes after a future alias change.

## Identities and separation of duties

| Identity | Purpose | Cryptographic access | Administration |
| --- | --- | --- | --- |
| IAM Identity Center `FounderAdministrator` | Human setup and billing | None during routine work | Initial account setup; avoid routine root use |
| IAM role `CovarifyKmsAdministrator` | Key policy, rotation, enable/disable | No decrypt or data-key generation | KMS administration only |
| IAM role `CovarifyPlaidKmsRuntime` | Vercel Production workload via OIDC | Generate data key and decrypt only | None |
| IAM role `CovarifyKmsRecovery` | Break-glass recovery | Describe/enable/cancel deletion; no plaintext decrypt by default | MFA-controlled, separately held |

Vercel assumes the runtime role with short-lived credentials. The trust policy is limited to provider `oidc.vercel.com/covarum`, audience `https://vercel.com/covarum`, and subject `owner:covarum:project:covarify:environment:production`. Do not create an IAM runtime user or static AWS access keys.

## Runtime least-privilege policy

Attach this only to the runtime role. The KMS key policy must also permit that principal.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "UseOnlyCovarifyPlaidKey",
    "Effect": "Allow",
    "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
    "Resource": "arn:aws:kms:us-east-1:386324384243:key/529d1208-1369-4fae-a436-8142fcca8db5",
    "Condition": {
      "StringEquals": {
        "kms:EncryptionContext:application": "covarify",
        "kms:EncryptionContext:purpose": "plaid-access-token"
      },
      "ForAllValues:StringEquals": {
        "kms:EncryptionContextKeys": ["application", "purpose"]
      }
    }
  }]
}
```

The key administrator policy may allow `DescribeKey`, alias management, policy management, tagging, and rotation management on this key, but must explicitly omit `kms:Decrypt`, `kms:GenerateDataKey`, `kms:ScheduleKeyDeletion`, and `kms:PutKeyPolicy` unless policy changes follow reviewed break-glass procedure. Key deletion requires two-person review outside this initial setup.

## Configuration and observability

Required server-only Vercel Production variables: `PLAID_KMS_PROVIDER=aws`, `PLAID_KMS_KEY_ID=arn:aws:kms:us-east-1:386324384243:key/529d1208-1369-4fae-a436-8142fcca8db5`, `AWS_REGION=us-east-1`, and `AWS_ROLE_ARN=arn:aws:iam::386324384243:role/CovarifyPlaidKmsRuntime`. Vercel supplies the OIDC token and the application exchanges it for temporary credentials. Do not configure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_SESSION_TOKEN`.

CloudTrail Event history records KMS management and cryptographic events. Alert on key disablement, deletion scheduling, key-policy changes, and runtime access from an unexpected principal. Never log token plaintext, data keys, wrapped keys, ciphertext, or AWS secrets.

## Rotation, recovery, and cost

Enable automatic rotation every **365 days**. Automatic rotation retains the key ID and old material, so existing ciphertext continues to decrypt. Do not manually repoint the alias as the routine rotation mechanism.

Recovery order: keep Production connections disabled; verify Region, key state, runtime principal, environment variables, and policy; restore a removed permission or re-enable the same key with the recovery role; validate a non-sensitive canary; then resume. A database backup alone cannot recover a deleted KMS key. Never schedule deletion during normal operations. If ever approved, use the maximum 30-day waiting period only after two-person approval, retained encrypted backups have expired, and an inventory proves no envelope depends on the key. Permanent key loss requires affected users to reconnect Plaid.

Estimated early-stage cost is **$1/month** before rotations and normally $0 request cost under the 20,000-request monthly free tier. Standard symmetric requests above that are $0.03 per 10,000. The first and second automatic rotations each add $1/month for retained key material, so budget about **$2/month after year one and $3/month after year two**, plus optional CloudTrail or alerting charges.

## Deployment gate

The key, OIDC provider, runtime role, deployment, and live generate/decrypt canary are complete. Keep `PLAID_PRODUCTION_CONNECTIONS_ENABLED=false` and `PLAID_SYNC_WORKER_ENABLED=false` until `CRON_SECRET` is configured, the secured cron is tested with that secret, CloudTrail is reviewed, and the broader Plaid readiness checklist is complete.
