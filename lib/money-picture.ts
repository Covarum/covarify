export type MoneyTransaction = { id: string; plaidAccountId: string; name: string; amount: number; currency: string; date: string; pending: boolean; pendingTransactionId: string | null; category: string; detailedCategory: string | null };
export type TransactionFilters = { accountId?: string; category?: string; dateRange?: "30" | "90" | "all"; search?: string };

const categoryLabel = (value: string) => value === "Uncategorized" ? value : value.toLowerCase().split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export function classifyTransaction(transaction: MoneyTransaction) {
  const primary = transaction.category.toUpperCase();
  if (transaction.pending) return "pending" as const;
  if (primary.startsWith("TRANSFER_")) return "transfer" as const;
  if (transaction.amount < 0 && primary !== "INCOME") return "refund" as const;
  if (transaction.amount < 0) return "inflow" as const;
  if (transaction.amount > 0) return "outflow" as const;
  return "neutral" as const;
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
