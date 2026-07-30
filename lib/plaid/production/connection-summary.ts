export type ConnectionSummaryItem = {
  id: string;
  institution_id: string | null;
  institution_name: string | null;
  environment: string;
  status: string;
  last_successful_sync_at: string | null;
};

export type ConnectionSummaryAccount = {
  plaid_item_id: string;
  active_status: string;
};

export type ConnectionSummarySyncState = {
  plaid_item_id: string;
  last_sync_completed_at: string | null;
};

export type ConnectedInstitution = {
  id: string;
  itemIds: string[];
  name: string;
  accountCount: number;
  status: "connected" | "syncing";
  lastSyncedAt: string | null;
};

const latestTimestamp = (values: Array<string | null>) => values
  .filter((value): value is string => Boolean(value))
  .sort()
  .at(-1) || null;

export function buildConnectionSummary(
  items: ConnectionSummaryItem[],
  accounts: ConnectionSummaryAccount[],
  syncStates: ConnectionSummarySyncState[] = [],
) {
  const connectedItems = items.filter((item) =>
    item.environment === "production" && (item.status === "active" || item.status === "pending"));
  const connectedItemIds = new Set(connectedItems.map((item) => item.id));
  const accountCountByItem = new Map<string, number>();
  for (const account of accounts) {
    if (account.active_status !== "active" || !connectedItemIds.has(account.plaid_item_id)) continue;
    accountCountByItem.set(account.plaid_item_id, (accountCountByItem.get(account.plaid_item_id) || 0) + 1);
  }
  const syncByItem = new Map(syncStates.map((state) => [state.plaid_item_id, state.last_sync_completed_at]));
  const institutions = new Map<string, ConnectedInstitution>();
  for (const item of connectedItems) {
    const key = item.institution_id ? `institution:${item.institution_id}` : `item:${item.id}`;
    const existing = institutions.get(key);
    const itemLastSyncedAt = latestTimestamp([item.last_successful_sync_at, syncByItem.get(item.id) || null]);
    if (!existing) {
      institutions.set(key, {
        id: key,
        itemIds: [item.id],
        name: item.institution_name || "Connected institution",
        accountCount: accountCountByItem.get(item.id) || 0,
        status: item.status === "active" ? "connected" : "syncing",
        lastSyncedAt: itemLastSyncedAt,
      });
      continue;
    }
    existing.itemIds.push(item.id);
    existing.accountCount += accountCountByItem.get(item.id) || 0;
    if (item.status !== "active") existing.status = "syncing";
    existing.lastSyncedAt = latestTimestamp([existing.lastSyncedAt, itemLastSyncedAt]);
  }
  const connectedInstitutions = [...institutions.values()];
  return {
    connectedInstitutions,
    institutionCount: connectedInstitutions.length,
    accountCount: connectedInstitutions.reduce((total, institution) => total + institution.accountCount, 0),
  };
}
