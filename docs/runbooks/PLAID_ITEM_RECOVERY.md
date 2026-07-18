# Plaid Item Recovery Runbook

1. Identify the owned internal Item without exposing the Plaid Item ID to the user.
2. Map `ITEM_LOGIN_REQUIRED`, permission expiration, `PENDING_DISCONNECT`/`PENDING_EXPIRATION`, and revoked-permission events to a calm `needs_update` state.
3. Stop decision refreshes that depend on stale data and show the last successful sync time.
4. Offer owner-authenticated Link update mode using the existing encrypted token.
5. For OAuth Items, use the registered redirect URI and preserve authenticated resume state.
6. After Link succeeds, refresh Item status and enqueue Transactions Sync.
7. Ask the user to disconnect/reconnect only when update mode cannot recover the Item.
8. Record recovery attempts and outcomes without logging tokens or raw financial data.
