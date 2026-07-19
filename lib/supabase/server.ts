import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicSupabaseConfig } from "./config";
export async function createSupabaseServerClient() {
  const { url, key } = readPublicSupabaseConfig(); const store = await cookies();
  return createServerClient(url, key, { cookies: { getAll: () => store.getAll(), setAll(values) { try { values.forEach(({ name, value, options }) => store.set(name, value, options)); } catch {} } } });
}
