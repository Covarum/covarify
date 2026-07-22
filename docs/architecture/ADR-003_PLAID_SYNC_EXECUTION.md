# ADR-003: Durable Plaid Sync Execution

**Status:** Accepted - Vercel Cron approved as the initial worker
**Date:** 2026-07-20

## Decision

Use Supabase Postgres as the durable job ledger and a separately invoked server worker as the consumer. Webhooks verify authenticity, persist a deduplicated event and job, and return promptly. They never synchronize transactions inline.

The worker claims jobs atomically with per-Item exclusion, records attempts, follows `transactions/sync` through every `has_more` page, applies added/modified/removed deltas idempotently, and advances the cursor after committed work. Retriable failures use exponential backoff with jitter and a bounded attempt count; exhausted jobs enter `failed` for audited manual retry. Pending-to-posted replacement uses Plaid IDs and `pending_transaction_id` without a duplicate visible transaction.

## Options

- **Supabase ledger plus Vercel Cron/secured worker route (recommended initially):** the smallest operational surface and no queue vendor. Suitability depends on plan schedule and duration limits.
- **Managed queue/worker:** stronger delivery controls at scale, but adds a paid vendor and credential boundary.
- **Webhook-inline or browser-triggered sync:** rejected because correctness would depend on request lifetime or an open session.

The worker endpoint requires a dedicated server-only identity and is unavailable to browser sessions. Logs exclude tokens, keys, request bodies, account numbers, balances, and transaction descriptions.

## Deployment boundary

Vercel Cron invokes `GET /api/cron/plaid-transactions-sync` every five minutes. Each invocation claims at most one job and has a 60-second ceiling. Postgres uses `FOR UPDATE SKIP LOCKED` plus a unique lease token; a stale ten-minute lease may be reclaimed, while completion and retry require the current lease.

The worker remains unavailable unless `PLAID_SYNC_WORKER_ENABLED=true` and Vercel supplies `Authorization: Bearer $CRON_SECRET`. Implementation does not authorize creating a deployment or enabling the flag. The five-minute schedule requires a non-Hobby Vercel team; Hobby schedules are limited to once daily. Confirm the selected plan supports the schedule and 60-second duration before deployment.
