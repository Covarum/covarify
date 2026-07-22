# Plaid Production Connection Consent

**Status:** Approved for the controlled founder rollout
**Immutable version:** `plaid-production-consent-v1-2026-07-22`
**Founder approval recorded:** 2026-07-21

This approval fixes the text and identifier below as the immutable consent version for the controlled founder rollout. It does not authorize enabling `PLAID_PRODUCTION_CONNECTIONS_ENABLED` or `PLAID_SYNC_WORKER_ENABLED`, and it does not authorize connecting a financial institution. The policy decisions listed at the end of this document remain pending.

## Connect your financial accounts

Covarify securely connects the financial accounts you choose through Plaid so we can build your Money Picture and help you make better financial decisions.

You enter your bank username and password directly with Plaid. Covarify never receives or stores your banking credentials.

For this connection, Covarify requests access to the Plaid Transactions product. This allows Covarify to receive information about your connected accounts, balances, and transaction history.

Covarify uses this information to build your Money Picture, keep it up to date, and provide personalized financial insights and decision support. Covarify does not move money or initiate financial transactions through this connection.

After a successful connection, Plaid provides Covarify with a secure access token. That token is encrypted before it is stored, remains on Covarify’s servers, and is never exposed to your browser.

You can disconnect a financial institution at any time. Disconnecting immediately stops future account updates and removes the stored Plaid access token used to access that institution.

Disconnecting an institution is separate from deleting your Covarify account. Historical information already received may remain until it is removed through Covarify’s account-deletion process and applicable backup-expiration procedures.

The exact retention periods, deletion timelines, and backup policies are currently being finalized. Until those policies are approved, Covarify will not describe disconnecting an institution as immediate or complete deletion.

If you continue, Covarify records:

- the consent version
- the approved Plaid products
- the purposes for which data is used
- your account identifier
- the date and time you provided consent

If you have questions about your connection or your data, contact `contact@covarify.com`.

## Controls

Checkbox: “I understand and consent to Covarify connecting my selected financial accounts through Plaid and using Transactions data to build and refresh my Money Picture and provide financial insights and decision support. I understand that disconnecting an institution stops future access but is separate from full account deletion.”

Primary CTA: “Continue securely with Plaid”

Secondary CTA: “Not now - Return to my account”

## Pending founder policy decisions

- exact retention periods
- exact deletion timelines
- backup expiration policy
- legal hold behavior
- deletion confirmation process
- jurisdiction-specific privacy language
- audit-record retention
- webhook and synchronization record retention
