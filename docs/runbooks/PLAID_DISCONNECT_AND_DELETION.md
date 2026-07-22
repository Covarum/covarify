# Plaid Disconnect and Deletion Runbook

## Disconnect

An authenticated owner request calls Plaid `/item/remove`, marks the internal Item disconnected, prevents new sync, destroys the encrypted token, and records an audit event. Plaid removal invalidates the access token and ends subscription billing for Item-based products.

## Local history

Disconnect does not delete historical transactions or derived financial history. Retain them for the Money Picture, Financial Memory, and Decision Studio until the user submits a verified full-account-deletion request.

## Full account deletion

The verified route immediately closes the profile, bans authentication, revokes every Plaid Item, destroys token envelopes, cancels synchronization work, records the request, and sends the receipt notice. The daily secured deletion cron removes financial, connection, and synchronization records no later than 30 days and sends the completion notice. Retry any request marked `action_required` immediately; never wait for the 30-day purge if a Plaid Item or token remains active.

Retain only consent version/timestamp, deletion requests, security events, and legally required records for seven years. Never retain transaction payloads solely for audit. Apply a legal hold only to specifically covered records.

## Backups

Encrypted backups expire within 35 days. After any restore, run the deletion cron before restoring user access or synchronization. Reapply every open/completed deletion request, keep affected profiles closed, and never restore access tokens or jobs for a deleted account.

## Scheduled retention cleanup

`/api/cron/account-deletions` requires `Authorization: Bearer $CRON_SECRET`, runs daily, completes due deletions, purges completed/failed sync jobs after 30 days, webhook metadata after 90 days, and eligible audit/consent/deletion evidence after seven years. An unauthenticated request must return 401.
