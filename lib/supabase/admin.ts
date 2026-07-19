import "server-only";
import { createClient } from "@supabase/supabase-js";
import { readPublicSupabaseConfig, readServiceRoleKey } from "./config";
export function createSupabaseAdminClient() { const { url } = readPublicSupabaseConfig(); return createClient(url, readServiceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); }
