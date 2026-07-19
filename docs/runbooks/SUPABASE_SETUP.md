# Supabase Setup

## Supabase

From Project Settings > API, copy the Project URL, browser-safe anon/publishable key, and service-role key. The service-role key is server-only. Configure Auth URL settings with site URL `https://www.covarify.com` and redirects `https://www.covarify.com/auth/callback` and `http://localhost:3000/auth/callback`. Enable email confirmation and the email/password provider. Password resets return through `/auth/callback?next=/reset-password`.

Apply reviewed migrations with the Supabase CLI: `supabase link`, `supabase db push --dry-run`, then `supabase db push`. Confirm every listed table has RLS enabled and run `supabase/tests/rls_verification.sql` with two test identities. Rotate compromised keys in Project Settings > API, replace the Vercel values, and redeploy immediately.

## Vercel

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and `COVARIFY_PUBLIC_SIGNUPS_ENABLED`. Set the URL, browser key, and site URL for Production/Preview/Development as appropriate; the service-role key is sensitive and server-only. Keep public signups false for controlled beta. Redeploy after changes.

## Local development

Copy placeholders from `.env.example` to untracked `.env.local`. Use local Supabase values, run `supabase db reset`, then `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. Never commit `.env.local`.
