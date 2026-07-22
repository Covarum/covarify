# Plaid Production Gap Analysis

> Status refreshed 2026-07-20. The global Production connection flag remains disabled.

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
| Authentication | **Verified:** Supabase Auth, secure cookie sessions, recovery routes, and stable user/profile IDs are live. | Preserve the verified boundary and regression tests. |
| Admin separation | No approved admin identity/role implementation. | Privileged role boundary and MFA policy. |
| Persistence | **Verified foundation:** Supabase migrations, repository adapter, ownership constraints, and RLS are deployed. | Add job/attempt migrations; retain restore evidence and migration validation. |
| Encrypted token storage | AES-256-GCM abstraction exists; no approved KMS/key provider. | KMS-backed key-ring adapter, rotation procedure, ciphertext-only persistence tests. |
| Item/user ownership | **Verified foundation:** authenticated owner lookups, foreign keys, grants, and RLS exist. | Add cross-user OAuth-attempt and worker tests. |
| Webhook verification | ES256/JWK/raw-body verifier exists; operational key caching and persisted adapter are not configured. | Persistence/queue adapters, replay/dedup evidence, production endpoint test. |
| Update mode | Owner-only route contract exists but default auth/repository adapters reject. | Approved adapters, UI, Item health mapping, recovery tests. |
| OAuth | Redirect config is validated; no authenticated Link UI or resume-state store. | `/connect/oauth`, Link-token/session binding, HTTPS registered URI, cross-user-state tests. |
| Disconnect/deletion | Owner-only route contract calls Item Remove and clears token, but adapters/policy are absent. | Approved retention/deletion policy, repository transaction, audit event, backup deletion process. |
| Sync cursor | Schema and sync loop exist; no durable cursor repository or worker. | Database adapter, queue/worker, retry and concurrency control. |
| Institution/error health | Item status fields exist; webhook-to-health transitions and UI are absent. | State machine for error, pending expiration/disconnect, revoked permission, login required. |
| Consent | Version `plaid-production-consent-v1-2026-07-22` remains immutable and enforced. The later-approved retention policy cannot be substituted into v1 without creating and approving a new immutable consent version. | Approve a v2 consent containing the finalized retention disclosure before the first connection. |
| Product approvals | Plaid Dashboard was not accessible from this task. | Founder verifies every product in the Product Matrix; configuration must match approvals. |

## Exact blockers before the first real connection

1. **Closed:** ADR-001 is approved; Supabase Auth/Postgres, founder bootstrap, ownership boundaries, migrations, and RLS verification are implemented.
2. **Partially closed:** authenticated adapters are live; approve the separate privileged-admin/MFA boundary in ADR-004.
3. **Closed for the existing schema:** migrations and the production repository are live; validate each new job/attempt migration before deployment.
4. Approve a KMS provider and cloud ownership model; configure the envelope-encryption adapter, least-privilege identity, and rotation/restore procedure. No environment-held production wrapping key is acceptable.
5. Approve and provision the durable worker execution model; webhook persistence and sync logic alone are not sufficient without an independently scheduled consumer.
6. Complete authenticated `/connect` and `/connect/oauth` state-bound Link flow.
7. **Closed:** founder-approved immutable consent version `plaid-production-consent-v1-2026-07-22` is enforced before Link-token creation and public-token exchange and persisted with consent records.
8. Complete Item health/update-mode UX.
9. **Closed:** founder-approved retention, disconnect, 30-day account deletion, 35-day backup expiration, legal-hold, audit, webhook, and synchronization-job policy is documented and implemented.
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
