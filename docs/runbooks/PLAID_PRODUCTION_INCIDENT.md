# Plaid Production Incident Runbook

1. Disable new connections with `PLAID_PRODUCTION_CONNECTIONS_ENABLED=false` and redeploy.
2. Classify scope: credential, token, webhook, authorization, sync integrity, deletion, or vendor outage.
3. Preserve redacted logs/audit evidence; never copy secrets or financial payloads into tickets/chat.
4. Stop or quarantine affected sync jobs.
5. Rotate affected Plaid secrets, access tokens, or encryption keys using approved procedures.
6. Remove affected Items when required and verify billing termination.
7. Notify the founder/security owner, Plaid, hosting/auth/database vendors, counsel, and users according to the approved severity and notification plan.
8. Validate ownership, data integrity, deletion, and recovery before re-enabling.
9. Record root cause, affected records/time window, remediation, and prevention actions.
