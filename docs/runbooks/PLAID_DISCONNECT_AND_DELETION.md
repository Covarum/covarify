# Plaid Disconnect and Deletion Runbook

## Disconnect

An authenticated owner request calls Plaid `/item/remove`, marks the internal Item disconnected, prevents new sync, destroys the encrypted token, and records an audit event. Plaid removal invalidates the access token and ends subscription billing for Item-based products.

## Local history

The exact retained-history period is **not approved**. Until it is, do not claim that disconnect deletes locally stored transaction history. The product must state the approved behavior before first connection.

## Full account deletion

The operational workflow must remove or legally de-identify profile data, Item/token data, accounts, transactions, consent/context, recommendations, and files; terminate applicable Plaid products; and track completion. Minimal security/audit evidence may be retained only under an approved policy.

## Backups

Document backup retention, access, expiry, and restoration behavior after the database vendor is approved. Do not claim immediate backup deletion if backups age out on a controlled schedule.
