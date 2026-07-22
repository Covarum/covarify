# Founder Pilot Readiness

**Track A:** Founder Pilot  
**Current state:** blocked only on the four controls below and later explicit flag approvals

Track A permits exactly one founder, one immutable Supabase UUID, and no more than one connected financial institution. Public Launch requirements are maintained separately and do not block this pilot.

## A1. Immutable consent v2

- Review `docs/product/PLAID_CONNECTION_CONSENT_V2_PROPOSED.md`.
- Founder records approval of the exact identifier and copy.
- Engineering then archives v1 unchanged, enforces v2 at Link-token creation and public-token exchange, persists v2 with consent receipts, runs validation, and deploys while both safety flags remain false.

## A2. Phishing-resistant MFA verification

Record PASS/FAIL and the verification date for each control plane. Never record recovery codes, credentials, device serial numbers, or secrets.

| Control plane | Founder Pilot requirement | Evidence to record |
|---|---|---|
| AWS root | Two hardware-backed passkeys or security keys; no root access keys | date verified and device count |
| AWS privileged/recovery identity | Phishing-resistant MFA required before sensitive console access | identity name, method class, date |
| Supabase organization | MFA enabled for the founder account; recovery method stored separately | account email, method class, date |
| Vercel team | MFA enabled for the founder/owner account | account email, method class, date |
| Covarify founder account | Strong unique password now; enable application MFA when implemented | immutable UUID and date reviewed |

For Track A, full public-workforce RBAC, two-person staffing, and automated privileged-session governance remain Track B work. Any missing MFA on AWS, Supabase, or Vercel is a Track A blocker.

## A3. Manual external deletion register

For the one-founder pilot, maintain a company-controlled secure email thread outside Supabase and outside the Covarify Git repository. The email thread is the master deletion register and the manual restore gate. Name the thread exactly:

`Covarify Founder Pilot Deletion Register`

Record each future deletion request by replying within the same thread using the approved record fields below. The mailbox account must use MFA, access must remain restricted to the founder, and the thread must be retained independently of the production database.

Record only:

- immutable Supabase user UUID
- request status: `NONE`, `REQUESTED`, or `COMPLETED`
- request timestamp, if any
- completion timestamp, if any
- restore block: `YES` whenever status is `REQUESTED` or `COMPLETED`
- last review timestamp
- reviewer name

Do not record Plaid tokens, Item IDs, bank names, account details, transaction data, credentials, or recovery codes. Before the first connection, create the master email with the founder UUID, `status=NONE`, and `restore block=NO`.

This email control is temporary and satisfies Track A only. Track B requires the automated rollback-independent deletion ledger in the Public Launch backlog.

## A4. Restore-review checklist

Every Supabase restore is a security event. Before starting a restore:

1. Set both Plaid flags to false and confirm the authenticated sync cron returns `503` with outcome `disabled`.
2. Record the restore owner, reason, selected backup time, and expected data-loss window.
3. Read the complete secure email deletion-register thread. If any relevant status is `REQUESTED` or `COMPLETED`, set and retain `restore block=YES`.

After restoration and before restoring user access or synchronization:

1. Confirm both Plaid flags are still false.
2. Reapply every external deletion record to Supabase: keep the profile closed, keep authentication banned, remove any restored Plaid Item/token rows, remove jobs and synchronization state, and preserve the deletion request/audit evidence.
3. Verify a restored encrypted token cannot be submitted to a Plaid endpoint; `/item/remove` makes the original Plaid token permanently invalid.
4. Run the secured account-deletion cron and verify no due request or retention cleanup failed.
5. Verify RLS, founder allowlisting, KMS/OIDC, webhook authentication, and cron authentication.
6. Reply to the master email thread with the reconciliation result, review timestamp, and reviewer.
7. Only after every check passes may the founder separately approve re-enabling the worker and connection flag.

If the external register is unavailable or reconciliation cannot be proven, keep authentication and both Plaid flags disabled.

## Flag approval boundary

After A1-A4 are complete, present two separate prompts in this order:

1. approval to set `PLAID_SYNC_WORKER_ENABLED=true`
2. approval to set `PLAID_PRODUCTION_CONNECTIONS_ENABLED=true` for the founder UUID only

Neither approval may be inferred. After both approvals, guide exactly one founder institution connection and stop additional connections.
