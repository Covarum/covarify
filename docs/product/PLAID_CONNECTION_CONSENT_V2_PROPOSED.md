# Plaid Production Connection Consent v2

**Status:** Founder-approved and immutable
**Immutable version:** `plaid-production-consent-v2-2026-07-22`
**Release track:** Founder Pilot
**Founder approval recorded:** 2026-07-22

This approved version does not modify the immutable v1 historical record. It is the active consent for all future Plaid connection attempts. This approval does not authorize enabling either Plaid safety flag or connecting a financial institution.

## Connect your financial accounts

Covarify securely connects the financial accounts you choose through Plaid so we can build your Money Picture and help you make more informed financial decisions.

You enter your bank username and password directly with Plaid. Covarify never receives or stores your banking credentials.

For this connection, Covarify requests access to the Plaid Transactions product. This allows Covarify to receive information about your connected accounts, balances, and transaction history.

Covarify uses this information to build your Money Picture, keep it up to date, and provide financial insights and decision support. Covarify does not move money or initiate financial transactions through this connection.

After a successful connection, Plaid provides Covarify with a secure access token. That token is encrypted before it is stored, remains on Covarify's secure servers, and is never exposed to your browser.

You can disconnect a financial institution at any time. Disconnecting immediately stops future account updates and permanently removes the encrypted Plaid access token used to access that institution.

Disconnecting a financial institution is separate from deleting your Covarify account. Historical information already received may remain so your Money Picture, Financial Memory, and Decision Studio remain accurate until you request complete account deletion.

When you submit and verify a request to permanently delete your account, Covarify immediately disables your account, disconnects every Plaid institution, permanently destroys the encrypted Plaid access tokens, and stops future synchronization. Connected account information, transaction history, your Money Picture, Financial Memory, decision history, connection metadata, and synchronization records are removed within 30 days.

Encrypted backups may temporarily contain earlier copies of deleted information. Covarify's production backups expire within a maximum of seven days. Before any backup is restored, Covarify performs a security review to ensure deleted accounts cannot be reactivated and removed financial institutions cannot regain access.

To meet security, legal, and compliance obligations, Covarify may retain limited records such as your consent history, deletion requests, security audit events, and records required by applicable law for up to seven years. These retained records cannot reconnect your financial institutions or rebuild your financial profile. Covarify does not retain financial transaction data solely for audit purposes.

If you continue, Covarify records:

- The consent version
- The approved Plaid products
- The purposes for which data is used
- Your account identifier
- The date and time you provided consent

If you have questions about your connection or your data, contact `contact@covarify.com`.

## Controls

Checkbox: “I understand and consent to Covarify connecting my selected financial accounts through Plaid and using Transactions data to build and refresh my Money Picture and provide financial insights and decision support. I understand that disconnecting a financial institution stops future access but is separate from permanently deleting my Covarify account.”

Primary CTA: “Continue securely with Plaid”

Secondary CTA: “Not now — Return to my account”

## Approval scope

This exact identifier and copy are immutable. Future wording changes require a new version. Users who have not started or completed a Plaid connection are not separately prompted; this consent is presented when they choose to begin a future connection.
