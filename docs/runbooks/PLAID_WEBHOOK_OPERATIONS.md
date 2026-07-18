# Plaid Webhook Operations Runbook

- Endpoint: `https://www.covarify.com/api/plaid/production/webhook`
- Verify `Plaid-Verification` JWT with Plaid's JWK endpoint, require ES256/P-256, enforce five-minute freshness, and compare the raw-body SHA-256 in constant time.
- Persist only safe type/code/Item reference, received time, hash, and processing status.
- Deduplicate by body hash/event record and enqueue work idempotently.
- Return quickly; Transactions retrieval runs in a worker using the stored cursor.
- Handle Transactions update signals plus Item ERROR, pending disconnect/expiration, permission revoked, and login-required states.
- Never log the raw body, access token, secret, account/transaction payload, or bank credentials.
- On verification failures, return 401 and alert on sustained failures; do not process the body.
