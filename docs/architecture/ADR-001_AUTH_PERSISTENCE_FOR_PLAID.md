# ADR-001: Authentication and Persistence for Plaid Production

**Status:** Approved
**Decision date:** 2026-07-17

## Context

Plaid Items, encrypted tokens, accounts, transactions, cursors, consent receipts, webhook events, audit events, and deletion jobs require authenticated ownership and transactional persistence. The repository currently has neither an auth nor database vendor.

## Options

| Option | Advantages | Risks/tradeoffs |
|---|---|---|
| Supabase Auth + managed Postgres | One platform for identity, Postgres, row-level security, migrations, backups, and server integration; smallest vendor surface for current stage. | RLS and service-role use require disciplined tests; admin MFA/roles and KMS remain separate design work. |
| Clerk + managed Postgres | Strong consumer auth UX and session tooling; database remains independently selectable. | Two critical vendors and an identity-to-tenancy synchronization boundary. |
| Auth.js + managed Postgres | High control and portability. | Larger security/operations burden for sessions, recovery, MFA, adapters, and upgrades at the current team size. |

## Recommendation

Approve **Supabase Auth + managed Postgres** for the first controlled beta, subject to a short security review. Use immutable Supabase user IDs as Covarify user ownership keys, a separate Profile/Household model, server-side authorization helpers, RLS defense in depth, and migrations for all canonical records. Do not place Plaid access-token encryption keys in Postgres; use an approved KMS/key service.

## Approval required before implementation

- Data region and residency.
- Consumer authentication methods and account recovery.
- Admin identity, MFA, and privileged-role design.
- Backup/restore plan and retention.
- KMS choice: recommended Vercel-managed secret bootstrap plus AWS KMS or Google Cloud KMS envelope encryption; select the cloud aligned with deployment operations.
- Queue/worker vendor for webhook-triggered sync.

## Decision

The founder approved Supabase Auth and Supabase-managed Postgres, owned by Covarum with Covarify as the product project. The first rollout is a controlled founder beta. Immutable Supabase user UUIDs are the authorization and ownership keys; email addresses are not.

KMS, queue/worker, retention, deletion, and privileged admin-role design remain open decisions and are not approved by this ADR. Plaid Production remains disabled until those blockers and the production-readiness checklist are resolved.
