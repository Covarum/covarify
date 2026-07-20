# Plaid Token Encryption Recovery

If KMS becomes unavailable, keep Production connections disabled and stop exchange, sync, update-mode, and disconnect operations that require token decryption. Do not fall back to a raw environment key.

Confirm provider status, runtime identity, region, key state, and policy changes using KMS audit metadata. Restore the least-privilege permission or prior alias through the approved recovery role. Validate decryption with a non-sensitive canary envelope, then resume bounded workers. If a key is permanently unavailable, affected Items require explicit user reconnection; never fabricate or copy token material from logs or backups.
