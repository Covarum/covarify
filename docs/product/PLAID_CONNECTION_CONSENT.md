# Plaid Connection Consent (Draft)

**Status:** Product/legal approval required before Production use  
**Version:** draft-2026-07-20

Covarify uses Plaid to securely connect the financial accounts you choose. Covarify requests account identity, balance, and transaction data only for the enabled products shown during connection. The data builds and refreshes your Money Picture and supports explainable financial decisions.

You enter institution credentials in Plaid's interface. Covarify does not receive or store your bank username or password. Covarify stores a revocable Plaid access token in encrypted form so approved server processes can refresh connected accounts.

You can disconnect an institution. Disconnecting revokes the Plaid Item and destroys Covarify's stored token. Historical records follow the separately approved retention and deletion policy; disconnecting must not be described as full deletion until that workflow is implemented and verified. Account deletion and backup expiry also follow that policy.

Consent records contain the version, requested products, stated purposes, owner, and time. IP addresses should not be retained by default; if abuse prevention requires evidence, store only a salted, rotating hash for a founder/legal-approved duration.

Open approvals: final wording, product names, retention periods, disconnect-versus-delete explanation, backup handling, IP minimization, support contact, and jurisdiction-specific disclosures.
