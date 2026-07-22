# Plaid Sync Operations

The webhook endpoint must verify the Plaid signature, persist a deduplicated safe event/job, and return promptly. A separate authenticated worker claims due jobs with per-Item exclusion.

Monitor queued age, running duration, retries, failed jobs, cursor freshness, and Item health. Retry only classified transient failures with exponential backoff and jitter. Exhausted work remains failed until an audited manual retry. Never reset a cursor merely to clear an error. When replaying, preserve the idempotency key and ensure added, modified, removed, and pending-to-posted transitions remain unique.

During an incident, pause worker claims without deleting jobs, keep the connection flag false, and preserve cursor/job evidence. Logs may include internal job/Item IDs, safe Plaid error codes, attempt counts, and timings; exclude tokens, keys, webhook bodies, account details, balances, and transaction descriptions.

## Vercel Cron controls

- Route: `GET /api/cron/plaid-transactions-sync`; schedule: every five minutes on a non-Hobby Vercel plan; maximum one claimed job per invocation.
- Authentication: Vercel-managed `CRON_SECRET` sent as a Bearer token. A missing or incorrect value returns 401 before configuration or database access.
- Kill switch: set `PLAID_SYNC_WORKER_ENABLED=false`; disabled invocations return 503 and claim nothing.
- Lease: ten minutes. A crashed job becomes claimable after the lease; the old invocation cannot complete or retry it after a new lease is issued.
- Webhooks received during an active Item job set a durable coalescing flag; completion immediately queues one more pass instead of losing the signal.
- Retry: up to five total attempts with exponential backoff, jitter, and a one-hour cap. Non-retryable Plaid responses and exhausted work become `failed`.
- A pagination failure leaves the durable cursor unchanged. Already-applied pages are safe to replay because transaction writes use the Plaid transaction ID conflict key.

Before enabling, apply `20260720200000_plaid_sync_worker_claim.sql`, configure `CRON_SECRET` and all Production Plaid/KMS variables, verify the Vercel plan limits, run a non-sensitive canary, and inspect the job, sync-state, transaction, and CloudTrail evidence. Keep `PLAID_PRODUCTION_CONNECTIONS_ENABLED=false` until the complete Production-readiness review approves rollout.
