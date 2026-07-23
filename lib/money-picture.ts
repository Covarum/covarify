export type MoneyTransaction = { id: string; plaidAccountId: string; accountLabel: string; name: string; amount: number; currency: string; date: string; pending: boolean; pendingTransactionId: string | null; category: string; detailedCategory: string | null; direction: "inflow" | "outflow" | "neutral"; transferRelationship: "internal" | "external" | null };
export type TransactionFilters = { accountId?: string; category?: string; dateRange?: "30" | "90" | "all"; search?: string };

const categoryLabel = (value: string) => value === "Uncategorized" ? value : value.toLowerCase().split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const isTransfer = (transaction: MoneyTransaction) => transaction.category.toUpperCase().startsWith("TRANSFER_") || /\b(online\s+)?xfer\b|\btransfer\b/i.test(transaction.name);
const isRefund = (transaction: MoneyTransaction) => /\brefund\b|\breversal\b|\breturned\b/i.test(transaction.name);

export function classifyTransaction(transaction: MoneyTransaction) {
  if (transaction.pending) return "pending" as const;
  if (isTransfer(transaction) && transaction.transferRelationship === "internal") return "internal_transfer" as const;
  if (isTransfer(transaction)) return "transfer" as const;
  if (transaction.amount < 0 && isRefund(transaction)) return "refund" as const;
  if (transaction.amount < 0) return "inflow" as const;
  if (transaction.amount > 0) return "outflow" as const;
  return "neutral" as const;
}

export function annotateInternalTransfers(transactions: MoneyTransaction[]) {
  const transferRows = transactions.filter((transaction) => !transaction.pending && isTransfer(transaction)); const internal = new Set<string>();
  for (const outgoing of transferRows.filter((transaction) => transaction.amount > 0)) { const outgoingDate = new Date(`${outgoing.date}T00:00:00Z`).getTime(); const match = transferRows.find((candidate) => candidate.amount < 0 && candidate.plaidAccountId !== outgoing.plaidAccountId && Math.abs(Math.abs(candidate.amount) - outgoing.amount) < .01 && Math.abs(new Date(`${candidate.date}T00:00:00Z`).getTime() - outgoingDate) <= 3 * 86400000); if (match) { internal.add(outgoing.id); internal.add(match.id); } }
  return transactions.map((transaction) => ({ ...transaction, transferRelationship: internal.has(transaction.id) ? "internal" as const : isTransfer(transaction) ? "external" as const : null }));
}

export function filterTransactions(transactions: MoneyTransaction[], filters: TransactionFilters, now = new Date()) {
  const cutoff = filters.dateRange && filters.dateRange !== "all" ? new Date(now.getTime() - Number(filters.dateRange) * 86400000) : null;
  const search = filters.search?.trim().toLowerCase();
  return transactions.filter((transaction) => (!filters.accountId || transaction.plaidAccountId === filters.accountId) && (!filters.category || transaction.category === filters.category) && (!cutoff || new Date(`${transaction.date}T00:00:00Z`) >= cutoff) && (!search || transaction.name.toLowerCase().includes(search)));
}

export function buildMoneyPicture(transactions: MoneyTransaction[], now = new Date()) {
  const complete = transactions.filter((transaction) => classifyTransaction(transaction) !== "pending");
  const start30 = new Date(now.getTime() - 30 * 86400000);
  const start60 = new Date(now.getTime() - 60 * 86400000);
  const recent = complete.filter((transaction) => new Date(`${transaction.date}T00:00:00Z`) >= start30);
  const previous = complete.filter((transaction) => { const date = new Date(`${transaction.date}T00:00:00Z`); return date >= start60 && date < start30; });
  const outflows = recent.filter((transaction) => classifyTransaction(transaction) === "outflow");
  const inflows = recent.filter((transaction) => classifyTransaction(transaction) === "inflow");
  const spending = outflows.reduce((sum, transaction) => sum + transaction.amount, 0);
  const income = inflows.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const categories = new Map<string, number>();
  for (const transaction of outflows) categories.set(transaction.category || "Uncategorized", (categories.get(transaction.category || "Uncategorized") || 0) + transaction.amount);
  const spendingByCategory = [...categories].map(([category, amount]) => ({ category: categoryLabel(category), amount, percentage: spending ? amount / spending * 100 : 0 })).sort((a, b) => b.amount - a.amount);
  const currentMonth = monthKey(now);
  const current = complete.filter((transaction) => monthKey(new Date(`${transaction.date}T00:00:00Z`)) === currentMonth);
  const currentIn = current.filter((transaction) => classifyTransaction(transaction) === "inflow").reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const currentOut = current.filter((transaction) => classifyTransaction(transaction) === "outflow").reduce((sum, transaction) => sum + transaction.amount, 0);
  const months = Array.from({ length: 4 }, (_, index) => { const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (3 - index), 1)); const key = monthKey(date); const rows = complete.filter((transaction) => monthKey(new Date(`${transaction.date}T00:00:00Z`)) === key); const moneyIn = rows.filter((transaction) => classifyTransaction(transaction) === "inflow").reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0); const moneyOut = rows.filter((transaction) => classifyTransaction(transaction) === "outflow").reduce((sum, transaction) => sum + transaction.amount, 0); return { label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date), inflow: moneyIn, outflow: moneyOut, net: moneyIn - moneyOut }; });
  const priorSpending = previous.filter((transaction) => classifyTransaction(transaction) === "outflow").reduce((sum, transaction) => sum + transaction.amount, 0);
  const insights = [] as Array<{ title: string; body: string; range: string; support: string; question: string }>;
  if (spending || priorSpending) { const change = priorSpending ? (spending - priorSpending) / priorSpending * 100 : null; insights.push({ title: "Spending pattern", body: change === null ? "This is your first complete comparison period." : `Estimated spending ${change >= 0 ? "increased" : "decreased"} ${Math.abs(change).toFixed(0)}% compared with the previous 30 days.`, range: "Last 30 days vs. previous 30 days", support: `${spendingByCategory[0]?.category || "Uncategorized"} is the largest category in this period.`, question: "What changed in my recent spending?" }); }
  if (currentOut > currentIn) insights.push({ title: "Monthly cash flow", body: "Identified outflow is currently higher than identified inflow this month.", range: "This month", support: `Difference: ${Math.abs(currentIn - currentOut).toLocaleString("en-US", { style: "currency", currency: "USD" })}.`, question: "Which expenses are affecting this month’s cash flow?" });
  return { spendingByCategory, spending, income, net: income - spending, currentMonth: { inflow: currentIn, outflow: currentOut, net: currentIn - currentOut }, largestExpenses: outflows.slice().sort((a, b) => b.amount - a.amount).slice(0, 5), trend: months, insights, categories: [...new Set(transactions.map((transaction) => transaction.category))].sort() };
}

export function buildAccountAnalytics(transactions: MoneyTransaction[]) {
  const totalSpending = transactions.filter((transaction) => classifyTransaction(transaction) === "outflow").reduce((sum, transaction) => sum + transaction.amount, 0); const totalDeposits = transactions.filter((transaction) => classifyTransaction(transaction) === "inflow").reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  return [...new Set(transactions.map((transaction) => transaction.plaidAccountId))].map((accountId) => { const rows = transactions.filter((transaction) => transaction.plaidAccountId === accountId); const inflows = rows.filter((transaction) => classifyTransaction(transaction) === "inflow"); const outflows = rows.filter((transaction) => classifyTransaction(transaction) === "outflow"); const transfersIn = rows.filter((transaction) => ["transfer", "internal_transfer"].includes(classifyTransaction(transaction)) && transaction.amount < 0); const transfersOut = rows.filter((transaction) => ["transfer", "internal_transfer"].includes(classifyTransaction(transaction)) && transaction.amount > 0); const moneyIn = inflows.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0); const moneyOut = outflows.reduce((sum, transaction) => sum + transaction.amount, 0); const categories = new Map<string, number>(); outflows.forEach((transaction) => categories.set(transaction.category, (categories.get(transaction.category) || 0) + transaction.amount)); return { accountId, accountLabel: rows[0]?.accountLabel || "Connected account", transactionCount: rows.length, identifiedInflows: moneyIn, identifiedOutflows: moneyOut, netCashFlow: moneyIn - moneyOut, transfersIn: transfersIn.length, transfersOut: transfersOut.length, largestExpenses: outflows.slice().sort((a, b) => b.amount - a.amount).slice(0, 3), commonCategories: [...categories].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category]) => categoryLabel(category)), spendingShare: totalSpending ? moneyOut / totalSpending * 100 : 0, depositShare: totalDeposits ? moneyIn / totalDeposits * 100 : 0, lastActivityDate: rows[0]?.date || null, recurringPayments: null, recurringDeposits: null }; });
}

export function buildAccountObservations(analytics: ReturnType<typeof buildAccountAnalytics>) { const observations = [] as Array<{ title: string; body: string; question: string }>; const income = analytics.slice().sort((a, b) => b.depositShare - a.depositShare)[0]; if (income && income.depositShare >= 65) observations.push({ title: `${income.accountLabel} receives most identified income`, body: `${income.depositShare.toFixed(0)}% of identified deposits flowed into this account over the available history. Based on connected account activity, it appears to be the primary destination for identified inflow.`, question: "Would aligning recurring bills with identified income make my cash flow easier to follow?" }); const transferHeavy = analytics.find((account) => account.transactionCount >= 5 && (account.transfersIn + account.transfersOut) / account.transactionCount >= .5); if (transferHeavy) observations.push({ title: `${transferHeavy.accountLabel} is primarily used for transfers`, body: `${transferHeavy.transfersIn + transferHeavy.transfersOut} of ${transferHeavy.transactionCount} transactions are identified transfers over the available history. This pattern may be worth reviewing.`, question: "What role does this account play in my overall cash flow?" }); if (analytics.length > 1 && analytics.every((account) => account.spendingShare >= 25)) observations.push({ title: "Spending is spread across connected accounts", body: analytics.map((account) => `${account.accountLabel}: ${account.spendingShare.toFixed(0)}%`).join(" · ") + ". Based on available transaction history.", question: "Would seeing fixed and flexible spending by account improve my financial clarity?" }); return observations; }
