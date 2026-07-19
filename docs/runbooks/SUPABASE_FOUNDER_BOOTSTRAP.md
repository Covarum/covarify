# Supabase Founder Bootstrap

1. In Supabase Authentication > Users, create the founder account or complete `/signup` only during a deliberately enabled controlled enrollment window. Confirm the email.
2. Copy the immutable user UUID from the user record. Never use email as an authorization key.
3. Apply migrations, then run `update public.profiles set is_internal=true where id='<UUID>';` in the SQL editor. Verify exactly one row changed.
4. In Vercel, set `PLAID_PRODUCTION_ALLOWED_USER_IDS` to the UUID (comma-separated for future internal users). Keep `PLAID_PRODUCTION_CONNECTIONS_ENABLED=false`.
5. Redeploy and confirm `/account` authenticates. Test RLS using a second test user/JWT and the queries in `supabase/tests/rls_verification.sql`.

To remove access, remove the UUID from Vercel, redeploy, and set `is_internal=false`. Do not delete audit records. Dashboard steps are user creation, UUID lookup, and the reviewed SQL update. Vercel steps are environment-variable changes and redeployment. Never share or commit JWTs, passwords, service-role keys, database credentials, Plaid secrets/tokens, or encryption keys.
