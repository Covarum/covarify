export type AccountClass = "cash" | "credit" | "loan" | "investment" | "other";
export type FreshnessState = "current" | "aging" | "stale" | "unknown";

export type ConnectionHealthAccount = {
  plaid_item_id: string;
  type: string | null;
  subtype: string | null;
  updated_at: string | null;
};

export type ConnectionHealthItem = {
  id: string;
  institution_name: string | null;
  status: string;
  last_successful_sync_at: string | null;
  error_code: string | null;
  needs_update_mode: boolean;
};

export type ConnectionHealthSync = {
  plaid_item_id: string;
  sync_status: string;
  last_sync_started_at: string | null;
  last_sync_completed_at: string | null;
  last_error: string | null;
};

export type InstitutionConnectionHealth = {
  itemId: string;
  institutionName: string;
  accountCount: number;
  accountClasses: AccountClass[];
  lastTransactionSyncAt: string | null;
  lastBalanceUpdateAt: string | null;
  lastInvestmentUpdateAt: string | null;
  lastRefreshAttemptAt: string | null;
  syncState: string;
  state: "current" | "aging" | "stale" | "syncing" | "action_required" | "unavailable" | "unknown";
  freshness: FreshnessState;
  refreshEligible: boolean;
  retryAt: string | null;
  reconnectRequired: boolean;
  safeMessage: string;
};

export const MANUAL_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;

const POLICY_HOURS: Record<AccountClass, { current: number; stale: number }> = {
  cash: { current: 24, stale: 48 },
  credit: { current: 24, stale: 48 },
  loan: { current: 48, stale: 96 },
  investment: { current: 72, stale: 120 },
  other: { current: 48, stale: 96 },
};

export function accountClass(type: string | null, subtype: string | null): AccountClass {
  const normalizedType = (type || "").toLowerCase();
  const normalizedSubtype = (subtype || "").toLowerCase();
  if (normalizedType === "investment" || normalizedType === "brokerage" || normalizedSubtype.includes("investment")) return "investment";
  if (normalizedType === "credit" || normalizedSubtype.includes("credit card")) return "credit";
  if (normalizedType === "loan" || ["mortgage", "student", "auto"].some((value) => normalizedSubtype.includes(value))) return "loan";
  if (normalizedType === "depository" || ["checking", "savings", "cash management", "money market"].some((value) => normalizedSubtype.includes(value))) return "cash";
  return "other";
}

function newest(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) || null;
}

export function freshnessFor(accountClasses: AccountClass[], timestamp: string | null, now = new Date()): FreshnessState {
  if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) return "unknown";
  const ageHours = Math.max(0, now.getTime() - new Date(timestamp).getTime()) / 3_600_000;
  const policies = (accountClasses.length ? accountClasses : ["other" as const]).map((value) => POLICY_HOURS[value]);
  const currentHours = Math.min(...policies.map((value) => value.current));
  const staleHours = Math.min(...policies.map((value) => value.stale));
  return ageHours <= currentHours ? "current" : ageHours <= staleHours ? "aging" : "stale";
}

export function buildConnectionHealth(items: ConnectionHealthItem[], accounts: ConnectionHealthAccount[], syncStates: ConnectionHealthSync[], now = new Date()): InstitutionConnectionHealth[] {
  const syncByItem = new Map(syncStates.map((state) => [state.plaid_item_id, state]));
  return items.map((item) => {
    const ownedAccounts = accounts.filter((account) => account.plaid_item_id === item.id);
    const classes = [...new Set(ownedAccounts.map((account) => accountClass(account.type, account.subtype)))];
    const sync = syncByItem.get(item.id);
    const lastTransactionSyncAt = newest([item.last_successful_sync_at, sync?.last_sync_completed_at]);
    const nonInvestment = ownedAccounts.filter((account) => accountClass(account.type, account.subtype) !== "investment");
    const investments = ownedAccounts.filter((account) => accountClass(account.type, account.subtype) === "investment");
    const lastBalanceUpdateAt = newest(nonInvestment.map((account) => account.updated_at));
    const lastInvestmentUpdateAt = newest(investments.map((account) => account.updated_at));
    const freshnessTimestamp = classes.length === 1 && classes[0] === "investment" ? lastInvestmentUpdateAt : lastTransactionSyncAt;
    const freshness = freshnessFor(classes, freshnessTimestamp, now);
    const reconnectRequired = Boolean(item.needs_update_mode || item.status === "needs_update");
    const activeSync = ["queued", "running", "retry"].includes(sync?.sync_status || "");
    const lastRefreshAttemptAt = sync?.last_sync_started_at || null;
    const retryAtDate = lastRefreshAttemptAt ? new Date(new Date(lastRefreshAttemptAt).getTime() + MANUAL_REFRESH_COOLDOWN_MS) : null;
    const coolingDown = Boolean(retryAtDate && retryAtDate.getTime() > now.getTime());
    let state: InstitutionConnectionHealth["state"] = freshness;
    let safeMessage = freshness === "current" ? "Current" : freshness === "aging" ? "Update is taking longer than usual" : freshness === "stale" ? "Needs refresh" : "Waiting for the first update";
    if (reconnectRequired) { state = "action_required"; safeMessage = "Reconnection required"; }
    else if (item.status === "disconnected") { state = "unavailable"; safeMessage = "Disconnected"; }
    else if (activeSync) { state = "syncing"; safeMessage = sync?.sync_status === "retry" ? "Still waiting for the institution" : "Updating"; }
    else if (item.status === "error" || sync?.sync_status === "failed") { state = "unavailable"; safeMessage = "Temporarily unavailable"; }
    const hasRefreshableClass = classes.some((value) => value !== "investment");
    const refreshEligible = hasRefreshableClass && item.status === "active" && !reconnectRequired && !activeSync && !coolingDown && (freshness === "aging" || freshness === "stale");
    return {
      itemId: item.id,
      institutionName: item.institution_name || "Connected institution",
      accountCount: ownedAccounts.length,
      accountClasses: classes,
      lastTransactionSyncAt,
      lastBalanceUpdateAt,
      lastInvestmentUpdateAt,
      lastRefreshAttemptAt,
      syncState: sync?.sync_status || "idle",
      state,
      freshness,
      refreshEligible,
      retryAt: coolingDown && retryAtDate ? retryAtDate.toISOString() : null,
      reconnectRequired,
      safeMessage,
    };
  });
}
