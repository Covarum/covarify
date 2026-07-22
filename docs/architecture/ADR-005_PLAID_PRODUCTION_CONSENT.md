# ADR-005: Plaid Production Consent v1

**Status:** Accepted for the controlled founder rollout
**Decision date:** 2026-07-21
**Approved immutable version:** `plaid-production-consent-v1-2026-07-22`

## Decision

The founder approves the exact user-facing consent, checkbox text, and actions recorded in `docs/product/PLAID_CONNECTION_CONSENT.md` as Plaid Production consent version `plaid-production-consent-v1-2026-07-22`.

The application must require this exact version when creating a Plaid Link token and when exchanging a public token. A successful exchange must persist the immutable version with the consent record.

## Scope and safety boundaries

This decision approves consent wording and versioning only for the controlled founder rollout. It does not authorize:

- setting `PLAID_PRODUCTION_CONNECTIONS_ENABLED=true`
- setting `PLAID_SYNC_WORKER_ENABLED=true`
- connecting a financial institution

Those actions require separate, explicit founder approval after the remaining production-readiness blockers are closed.

## Related approved policy

The founder approved the Production retention and deletion policy on 2026-07-21. `docs/product/PLAID_RETENTION_AND_DELETION_DECISION.md` governs disconnect, deletion, backup expiration, legal holds, user notices, and operational retention. This does not authorize either Plaid safety flag.
