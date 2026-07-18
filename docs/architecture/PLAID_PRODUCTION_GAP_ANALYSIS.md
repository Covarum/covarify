# Plaid Production Gap Analysis

**Date:** July 17, 2026  
**Authority:** Master Playbook v1.0 Sections 06, 07, 10, TDR-001, and TDR-002  
**Status:** Production connections blocked

## Current architecture

The existing `/plaid-sandbox` flow remains an unlisted, `noindex` development demo. It creates a Sandbox Link token for a fixed test identity, exchanges the public token on the server, reads accounts and one page of Transactions Sync data, produces a First Win response, and discards the access token. The browser never receives the access token. The sandbox webhook records a safe metadata subset but does not verify or process the event.

## What currently works

- Plaid Node SDK configuration and safe error normalization for Sandbox.
- Server-created Sandbox Link tokens and server-side public-token exchange.
- Immediate Sandbox account and transaction retrieval.
- Sanitized browser response with no access token.
- Sandbox page is unlisted and has `noindex`, `nofollow`, and `nocache` metadata.
- New vendor-neutral Production configuration, auth contract, persistence contracts, domain records, token cipher, Link/exchange orchestration, sync algorithm, webhook verifier, update-mode contract, disconnect contract, feature flag, and allowlist.

## Sandbox-only behavior

- Existing `/api/plaid/create-link-token`, `/api/plaid/exchange-public-token`, `/api/plaid/webhook`, and `/plaid-sandbox` are demo-only.
- The demo uses a fixed `covarify-sandbox-user`, synchronous request-scoped reads, and no durable Item.
- Existing First Win output is generated from current Sandbox response data and prototype rules.
- The Sandbox flow must never share credentials, records, Items, cursors, or tokens with Production.

## Unsafe or incomplete for real users

| Gap | Current state | Required before first connection |
|---|---|---|
| Authentication | No approved provider or adapter. Production routes fail closed. | Approve provider; authenticated stable user/profile IDs; recovery; secure sessions. |
| Admin separation | No approved admin identity/role implementation. | Privileged role boundary and MFA policy. |
| Persistence | Strict interfaces only; no database adapter or migrations. | Approved database, transactional repository, tenancy constraints, backups, restore test. |
| Encrypted token storage | AES-256-GCM abstraction exists; no approved KMS/key provider. | KMS-backed key-ring adapter, rotation procedure, ciphertext-only persistence tests. |
| Item/user ownership | Domain and repository contracts exist; no durable enforcement. | Unique ownership constraints and cross-user denial tests. |
| Webhook verification | ES256/JWK/raw-body verifier exists; operational key caching and persisted adapter are not configured. | Persistence/queue adapters, replay/dedup evidence, production endpoint test. |
| Update mode | Owner-only route contract exists but default auth/repository adapters reject. | Approved adapters, UI, Item health mapping, recovery tests. |
| OAuth | Redirect config is validated; no authenticated Link UI or resume-state store. | `/connect/oauth`, Link-token/session binding, HTTPS registered URI, cross-user-state tests. |
| Disconnect/deletion | Owner-only route contract calls Item Remove and clears token, but adapters/policy are absent. | Approved retention/deletion policy, repository transaction, audit event, backup deletion process. |
| Sync cursor | Schema and sync loop exist; no durable cursor repository or worker. | Database adapter, queue/worker, retry and concurrency control. |
| Institution/error health | Item status fields exist; webhook-to-health transitions and UI are absent. | State machine for error, pending expiration/disconnect, revoked permission, login required. |
| Consent | Consent schema and exchange contract exist; no approved copy/version or durable receipt. | Founder/legal-approved consent version, persistence, revoke behavior, IP minimization decision. |
| Product approvals | Plaid Dashboard was not accessible from this task. | Founder verifies every product in the Product Matrix; configuration must match approvals. |

## Exact blockers before the first real connection

1. Approve and implement the authentication/persistence ADR.
2. Add authenticated and admin adapters; require MFA for privileged access.
3. Add database migrations and production repository with tenancy/uniqueness constraints.
4. Approve a KMS provider; add key-ring adapter and rotation/restore procedure.
5. Implement queue/worker execution for Transactions Sync and webhook-driven jobs.
6. Complete authenticated `/connect` and `/connect/oauth` state-bound Link flow.
7. Persist consent version and approved purposes before Link.
8. Complete Item health/update-mode UX.
9. Approve retention, disconnect, account-deletion, and backup-deletion behavior.
10. Verify Plaid Dashboard products, webhook URL, redirect URI, and Production secret in Vercel.
11. Pass authentication, ownership, encryption, webhook, sync, deletion, logging, build, and secret-scan gates.
12. Keep `PLAID_PRODUCTION_CONNECTIONS_ENABLED=false` until completion review; then allowlist only the founder's immutable internal user ID.

## Readiness conclusion

The architecture is now materially safer to complete, but it is **not safe for a real connection**. Production routes are intentionally unavailable with the default adapters. This is the correct state until vendor and policy decisions are approved.

## Official implementation references

- Plaid API environments: https://plaid.com/docs/api/
- Link and OAuth: https://plaid.com/docs/link/ and https://plaid.com/docs/link/oauth/
- Webhook verification: https://plaid.com/docs/api/webhooks/webhook-verification/
- Transactions Sync: https://plaid.com/docs/api/products/transactions/ and https://plaid.com/docs/transactions/
- Link update mode: https://plaid.com/docs/link/update-mode/
- Item status and removal: https://plaid.com/docs/api/items/
