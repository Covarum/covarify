import { createClient } from "@supabase/supabase-js";

if (process.env.WAITLIST_READ_CANARY !== "true") {
  console.log("Waitlist read canary skipped.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("Waitlist read canary requires Supabase server configuration.");

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const { error } = await client.from("beta_applications").select("id", { count: "exact", head: true });
if (error) {
  throw new Error(`Waitlist read canary failed: code=${error.code || "UNKNOWN"}; message=${error.message}; hint=${error.hint || ""}`);
}
console.log("Waitlist read canary passed.");
