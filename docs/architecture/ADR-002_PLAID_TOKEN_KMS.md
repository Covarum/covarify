# ADR-002: Plaid Token Envelope Encryption and KMS

**Status:** Proposed - founder decision required  
**Date:** 2026-07-20

## Decision context

Plaid access tokens must remain server-only and use envelope encryption. A Production wrapping key must not live in Vercel environment variables, source control, logs, database rows, or browser bundles. Rotation must not require reconnecting an Item.

## Options

1. **AWS KMS with a workload identity or tightly scoped credentials.** Mature key policies, audit history, aliases, rotation controls, and Node support. It adds an AWS account, region, IAM policy, and operational owner.
2. **Google Cloud KMS with Workload Identity Federation.** Comparable controls and preferable if Covarify standardizes on GCP.
3. **Environment-held AES key/keyring.** Rejected: a runtime compromise exposes ciphertext and its wrapping key; recovery and rotation are weak.
4. **Secret vault as raw key storage.** Better than a plain environment value, but it does not provide a KMS data-key boundary.

## Recommendation

Adopt **AWS KMS envelope encryption** unless the founder chooses GCP as Covarify's primary cloud. Generate a random 256-bit data-encryption key for each token, encrypt locally with AES-256-GCM, discard plaintext key material, and persist a versioned envelope containing ciphertext, nonce, authentication tag, and the KMS-encrypted data key. Store the KMS key identifier/version separately. Decryption asks KMS only to unwrap the data key.

Production fails closed when KMS configuration or permission is unavailable. It never falls back to an environment-held raw key. An in-memory adapter is permitted only in unit tests and must throw in `NODE_ENV=production`.

## Rotation and recovery

- New writes use the active KMS alias/key version; old versions remain decrypt-only during migration.
- Rewrap only the encrypted data key under the new KMS key; Plaid tokens are not reissued and institutions are not reconnected.
- Rollback selects the prior alias while both versions remain enabled.
- Schedule key deletion only after database and backup retention windows and a verified rewrap inventory of zero.
- Audit identifiers and outcomes only, never tokens, data keys, ciphertext, or secrets.

## Founder decision required

Choose AWS or GCP, owning account/project, region, billing owner, break-glass owner, rotation cadence, and recovery approvers. This ADR does not authorize paid infrastructure or credential provisioning.
