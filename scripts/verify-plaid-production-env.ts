import { createClient } from "@supabase/supabase-js";

if (process.env.PLAID_PRODUCTION_ENV_AUDIT !== "true") {
  console.log("Plaid Production environment audit skipped.");
  process.exit(0);
}

const results: Array<{ name: string; pass: boolean; issue?: string }> = [];
const exact = (name: string, expected: string) => {
  const actual = process.env[name];
  results.push({ name, pass: actual === expected, issue: actual === undefined ? "missing" : actual === expected ? undefined : "malformed or unexpected value" });
};
const present = (name: string) => {
  const pass = Boolean(process.env[name]?.trim());
  results.push({ name, pass, issue: pass ? undefined : "missing or empty" });
};
const absent = (name: string) => {
  const pass = !process.env[name]?.trim();
  results.push({ name, pass, issue: pass ? undefined : "must not be configured" });
};

exact("PLAID_PRODUCTS", "transactions");
exact("PLAID_WEBHOOK_URL", "https://www.covarify.com/api/plaid/production/webhook");
exact("PLAID_REDIRECT_URI", "https://www.covarify.com/connect/oauth");
exact("PLAID_ENV", "production");
exact("PLAID_SYNC_WORKER_ENABLED", "false");
exact("PLAID_PRODUCTION_CONNECTIONS_ENABLED", "false");
exact("PLAID_KMS_PROVIDER", "aws");
exact("AWS_REGION", "us-east-1");
present("PLAID_KMS_KEY_ID");
present("AWS_ROLE_ARN");
present("CRON_SECRET");
absent("AWS_ACCESS_KEY_ID");
absent("AWS_SECRET_ACCESS_KEY");
absent("AWS_SESSION_TOKEN");
absent("PLAID_SECRET");

const productionSecret = process.env.PLAID_PRODUCTION_SECRET;
results.push({ name: "PLAID_PRODUCTION_SECRET", pass: Boolean(productionSecret?.trim()), issue: productionSecret?.trim() ? undefined : "missing or empty" });

const allowlist = (process.env.PLAID_PRODUCTION_ALLOWED_USER_IDS || "").split(",").map((value) => value.trim()).filter(Boolean);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let allowlistPass = allowlist.length === 1 && uuidPattern.test(allowlist[0]);
let allowlistIssue = allowlistPass ? undefined : "must contain exactly one valid Supabase UUID";

if (allowlistPass) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const founderEmails = new Set((process.env.COVARIFY_ADMIN_EMAILS || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  if (!url || !serviceKey || founderEmails.size === 0) {
    allowlistPass = false;
    allowlistIssue = "founder identity could not be verified from server configuration";
  } else {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.auth.admin.getUserById(allowlist[0]);
    const email = data.user?.email?.toLowerCase();
    if (error || !email || !founderEmails.has(email)) {
      allowlistPass = false;
      allowlistIssue = "UUID does not resolve to the configured founder administrator";
    }
  }
}
results.push({ name: "PLAID_PRODUCTION_ALLOWED_USER_IDS", pass: allowlistPass, issue: allowlistIssue });

console.log(`PLAID_PRODUCTION_ALLOWED_USER_IDS_ENTRY_COUNT: ${allowlist.length}`);
console.log(`PLAID_PRODUCTION_ALLOWED_USER_IDS_UUID_FORMAT_VALID: ${allowlist.length === 1 && uuidPattern.test(allowlist[0]) ? "YES" : "NO"}`);
console.log(`PLAID_PRODUCTION_ALLOWED_USER_IDS_MATCHES_FOUNDER: ${allowlistPass ? "YES" : "NO"}`);

for (const result of results) console.log(`${result.name}: ${result.pass ? "PASS" : `FAIL (${result.issue})`}`);
if (results.some((result) => !result.pass)) process.exit(1);
