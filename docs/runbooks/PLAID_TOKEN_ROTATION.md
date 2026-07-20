# Plaid Token Encryption Key Rotation

1. Inventory envelopes by KMS key identifier and confirm the new KMS key policy permits only the Production runtime and designated recovery role.
2. Point the active alias to the new key for new writes; keep the old key decrypt-enabled.
3. Rewrap encrypted data keys in bounded, idempotent batches. Do not decrypt or reissue Plaid tokens and do not log envelope contents.
4. Compare the database inventory with successful audit outcomes. Retry failures without disabling the old key.
5. Exercise one read through each supported envelope version in the controlled environment.
6. After the inventory reaches zero for the old version and backup retention has elapsed, schedule (do not immediately perform) old-key deletion through the approved two-person process.

Rollback: restore the prior alias and pause rewrap jobs. Never delete a key while any live row or retained backup depends on it.
