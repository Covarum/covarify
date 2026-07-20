# Plaid Sync Operations

The webhook endpoint must verify the Plaid signature, persist a deduplicated safe event/job, and return promptly. A separate authenticated worker claims due jobs with per-Item exclusion.

Monitor queued age, running duration, retries, failed jobs, cursor freshness, and Item health. Retry only classified transient failures with exponential backoff and jitter. Exhausted work remains failed until an audited manual retry. Never reset a cursor merely to clear an error. When replaying, preserve the idempotency key and ensure added, modified, removed, and pending-to-posted transitions remain unique.

During an incident, pause worker claims without deleting jobs, keep the connection flag false, and preserve cursor/job evidence. Logs may include internal job/Item IDs, safe Plaid error codes, attempt counts, and timings; exclude tokens, keys, webhook bodies, account details, balances, and transaction descriptions.
