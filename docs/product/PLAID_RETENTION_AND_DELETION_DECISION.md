# Plaid Retention and Deletion Decision Package

**Status:** Founder/legal decisions required

## Proposed defaults

- Active connection: retain normalized account and transaction history needed for the Money Picture while consent remains active.
- Disconnect: call Plaid Item Remove, destroy the encrypted token envelope, stop jobs, mark the Item disconnected, and retain normalized history only for an approved user-visible grace period.
- Full account deletion: remove active tokens first, then delete or irreversibly anonymize user-owned financial records, consent receipts, and derived recommendations; retain only minimum legally required security/audit evidence.
- Backups: define an expiry window and prevent restoration from silently reactivating deleted tokens or jobs.
- Failed connection attempts and OAuth state: use a short TTL followed by automatic deletion.
- Webhooks: never persist raw bodies; retain only verified safe metadata and hashes for bounded troubleshooting and deduplication.

## Decisions required

Approve exact durations for active history, disconnected history, webhook metadata, failed jobs, audit events, deleted-account tombstones, and backups. Decide whether a grace period is needed, which legal holds can pause deletion, who approves them, and what deletion evidence users receive. Until approved and implemented, Covarify may promise token revocation on disconnect but not immediate deletion of every historical or backup record.
