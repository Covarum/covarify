if (process.env.CRON_LIVE_CANARY !== "true") {
  console.log("Cron live canary skipped.");
  process.exit(0);
}

const secret = process.env.CRON_SECRET?.trim();
if (!secret) throw new Error("CRON_SECRET is unavailable in the Production environment.");
if (process.env.PLAID_SYNC_WORKER_ENABLED !== "false") throw new Error("PLAID_SYNC_WORKER_ENABLED must remain false.");
if (process.env.PLAID_PRODUCTION_CONNECTIONS_ENABLED !== "false") throw new Error("PLAID_PRODUCTION_CONNECTIONS_ENABLED must remain false.");

const endpoint = "https://www.covarify.com/api/cron/plaid-transactions-sync";
const response = await fetch(endpoint, { headers: { authorization: `Bearer ${secret}` } });
const body = await response.json().catch(() => null);
console.log(JSON.stringify({ status: response.status, body }));
if (response.status !== 503 || body?.outcome !== "disabled") {
  throw new Error("Authenticated cron verification did not fail closed as disabled.");
}
