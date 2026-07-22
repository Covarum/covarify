# Plaid Production Retention and Deletion Policy

**Status:** Founder-approved for Production
**Approval date:** 2026-07-21

## Disconnecting an institution

Covarify immediately revokes the Plaid Item, permanently destroys the encrypted Plaid access token, cancels pending synchronization work, and prevents future synchronization. No disconnected institution retains an active access token. Disconnecting does not delete historical financial data; transactions and derived history may remain so the user's Money Picture, Financial Memory, and Decision Studio remain accurate until full account deletion is requested.

## Full account deletion

A verified request immediately disables the account, revokes every connected Plaid Item, destroys every encrypted access token, and prevents future institution access. Within 30 days, Covarify removes connected account information, transaction history, financial history, connection metadata, Money Picture data, Financial Memory, decision history, and synchronization state.

Only consent version and timestamp, the deletion request, security events, and records required by applicable law may remain. These records are retained for seven years and cannot reconnect an institution or rebuild the user's financial profile. Financial transaction payloads are never retained solely for audit.

## Backups and restoration

Encrypted backups expire within a maximum of 35 days. A restored backup must preserve the disabled state and deletion request. It must never reactivate an account, token, Item, or synchronization job. Deletion requests take precedence over restoration.

## Operational retention

- verified webhook metadata and hashes: 90 days for troubleshooting, replay detection, and operational diagnostics
- transaction synchronization jobs: 30 days
- consent, deletion-request, and security/compliance audit evidence: 7 years

Raw financial transaction payloads are not retained as audit evidence.

## Legal holds

Only records specifically covered by a valid legal hold are retained beyond the normal schedule. Unrelated data continues through normal deletion. A legal hold cannot be used to retain active Plaid credentials.

## User communication and confirmation

Covarify sends “We've received your account deletion request.” immediately after the request and “Your account deletion has been completed.” after completion. Before final confirmation, the product explains the immediate actions, the 30-day deletion window, limited retained records, backup expiration, the need to request an export first, and that deletion is permanent.

The required final checkbox is: “I understand that deleting my Covarify account permanently disconnects all financial institutions and cannot be undone.”
