# Plaid Production Setup Runbook

Do not perform these steps until code review, ADR approval, security tests, and persistence adapters are complete.

## Exact Plaid Dashboard values

- Allowed redirect URI: `https://www.covarify.com/connect/oauth`
- Production webhook URL: `https://www.covarify.com/api/plaid/production/webhook`

## Vercel variables

Set for the Production environment only unless explicitly testing Sandbox in Preview:

- `PLAID_CLIENT_ID` — Sensitive
- `PLAID_PRODUCTION_SECRET` — Sensitive, Production only
- `PLAID_SANDBOX_SECRET` — Sensitive, Preview/Development only; do not set to the Production value
- `PLAID_ENV=production` — Production only
- `PLAID_PRODUCTS` — exact verified approved products
- `PLAID_COUNTRY_CODES=US`
- `PLAID_CLIENT_NAME=Covarify`
- `PLAID_WEBHOOK_URL=https://www.covarify.com/api/plaid/production/webhook`
- `PLAID_REDIRECT_URI=https://www.covarify.com/connect/oauth`
- `PLAID_PRODUCTION_CONNECTIONS_ENABLED=false`
- `PLAID_PRODUCTION_ALLOWED_USER_IDS=` — immutable internal user IDs, never emails
- KMS/key adapter variables defined after KMS approval — Sensitive
- Auth/database/queue variables defined after ADR approval — Sensitive where credentials are involved

Never paste secret values into source control, issues, chat, logs, or client-visible variables.

## Redeployment

1. Add/verify variables without enabling connections.
2. Redeploy Production from the reviewed commit.
3. Run health/config checks that reveal only booleans and environment names, never secret lengths or values publicly.
4. Verify webhook endpoint rejects missing/invalid signatures.
5. Verify anonymous and non-allowlisted Link requests fail.

## First controlled connection

1. Confirm all completion gates and founder approval.
2. Add only the founder's immutable authenticated user ID to `PLAID_PRODUCTION_ALLOWED_USER_IDS`.
3. Keep `PLAID_PRODUCTION_CONNECTIONS_ENABLED=false` until the production-readiness review explicitly approves KMS, queue/worker, consent, retention, deletion, applied migrations, and verified RLS. Enable it only in a separately approved implementation phase.
4. Record explicit consent through `/connect`.
5. Connect one founder-owned institution; monitor Link, Item persistence, account persistence, initial sync, webhook verification, cursor, freshness, and logs.
6. Exercise update mode in a controlled test where possible.
7. Disconnect the Item; verify Plaid removal, token destruction, stopped sync, audit, retained-history behavior, and deletion workflow.
8. Set the flag back to `false` until review approves another connection.

## Rollback

1. Set `PLAID_PRODUCTION_CONNECTIONS_ENABLED=false` and redeploy.
2. Stop sync workers from accepting new work while preserving evidence.
3. For affected Items, follow the incident and disconnect runbooks.
4. Rotate a suspected secret/token/key using Plaid/KMS-supported procedures.
5. Do not delete audit evidence outside the approved incident/retention policy.
