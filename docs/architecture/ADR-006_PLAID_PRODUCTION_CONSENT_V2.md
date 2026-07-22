# ADR-006: Plaid Production Consent v2

**Status:** Accepted for the Founder Pilot
**Decision date:** 2026-07-22
**Immutable version:** `plaid-production-consent-v2-2026-07-22`

The founder approved the exact copy in `docs/product/PLAID_CONNECTION_CONSENT_V2_PROPOSED.md`. V2 is the active consent for future Plaid Link-token creation and public-token exchange and is persisted with every new consent record.

V1 remains unchanged in `docs/product/PLAID_CONNECTION_CONSENT.md` for historical audit. Users who have not initiated or completed a Plaid connection are not separately re-prompted; the current consent appears only when they choose to start a future connection.

This decision does not authorize setting `PLAID_SYNC_WORKER_ENABLED=true`, setting `PLAID_PRODUCTION_CONNECTIONS_ENABLED=true`, or connecting a financial institution.
