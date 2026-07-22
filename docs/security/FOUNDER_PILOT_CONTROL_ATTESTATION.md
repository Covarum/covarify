# Founder Pilot Control Attestation

**Track:** A — Founder Pilot
**Attestation date:** 2026-07-22

## External deletion register

The founder attests that:

- the master secure email thread exists outside Supabase and Git;
- mailbox access is founder-restricted and protected by MFA;
- the thread contains no financial data, Plaid tokens, credentials, transaction details, or recovery codes;
- the current register status is `NONE` and the restore block is `NO`; and
- the complete thread must be reviewed and reconciled before a restored Supabase database is returned to service.

The founder UUID is intentionally excluded from this repository.

## Production KMS configuration

`PLAID_KMS_KEY_ID` is the canonical server-only production variable. Runtime encryption and deployment validation both consume this variable. `AWS_KMS_KEY_ALIAS` is not required and must not be introduced as a second configuration source unless a demonstrated implementation defect requires a migration.
