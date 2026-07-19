-- This function is invoked only by the auth.users trigger. It must not be
-- callable through PostgREST as a public SECURITY DEFINER RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
