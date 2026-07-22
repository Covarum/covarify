if (process.env.CRON_LIVE_CANARY !== "true") {
  console.log("Cron live canary skipped.");
  process.exit(0);
}

const secret = process.env.CRON_SECRET?.trim();
if (!secret) throw new Error("CRON_SECRET is unavailable in the Production environment.");
if (process.env.PLAID_PRODUCTION_CONNECTIONS_ENABLED !== "true") throw new Error("PLAID_PRODUCTION_CONNECTIONS_ENABLED must be enabled for the approved founder-only connection phase.");

const workerEnabled = process.env.PLAID_SYNC_WORKER_ENABLED === "true";
if (!workerEnabled && process.env.PLAID_SYNC_WORKER_ENABLED !== "false") {
  throw new Error("PLAID_SYNC_WORKER_ENABLED must be explicitly true or false.");
}

if (workerEnabled) {
  console.log("Authenticated cron verification deferred until the enabled deployment is serving Production.");
  process.exit(0);
}

const endpoint = "https://www.covarify.com/api/cron/plaid-transactions-sync";
const response = await fetch(endpoint, { headers: { authorization: `Bearer ${secret}` } });
const body = await response.json().catch(() => null);
console.log(JSON.stringify({ status: response.status, body }));
if (response.status !== 503 || body?.outcome !== "disabled") {
  throw new Error("Authenticated cron verification did not fail closed as disabled.");
}
