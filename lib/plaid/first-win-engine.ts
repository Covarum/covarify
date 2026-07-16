import "server-only";

export type AnalysisTransaction = { id: string; name: string; amount: number; date: string; category: string };
type Classification = "Essential" | "Flexible" | "Debt / Credit Payments" | "Income" | "Unknown / Other";
type SpendGroup = { name: string; amount: number; transaction_count: number };
type SavingsLever = { category: string; current_30_day_spend: number; suggested_reduction: string; estimated_savings: number; reasoning: string };

const flexibleTerms = ["restaurant", "dining", "coffee", "fast food", "entertainment", "shopping", "travel", "recreation", "personal care", "subscription"];
const essentialTerms = ["grocery", "groceries", "utility", "utilities", "rent", "mortgage", "insurance", "medical", "pharmacy", "gas", "transit", "childcare", "phone", "internet"];
const debtTerms = ["credit card payment", "loan payment", "finance charge", "minimum payment", "debt payment"];
const label = (value: string) => value.toLowerCase().replaceAll("_", " ");
const title = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const dollars = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

function classify(transaction: AnalysisTransaction): Classification {
  const text = `${label(transaction.category)} ${transaction.name.toLowerCase()}`;
  if (debtTerms.some((term) => text.includes(term)) || text.includes("loan") || text.includes("debt payment")) return "Debt / Credit Payments";
  if (transaction.amount < 0 || label(transaction.category).includes("income")) return "Income";
  if (essentialTerms.some((term) => text.includes(term))) return "Essential";
  if (flexibleTerms.some((term) => text.includes(term)) || ["food and drink", "entertainment", "travel", "recreation", "personal care", "general merchandise"].some((term) => label(transaction.category).includes(term))) return "Flexible";
  return "Unknown / Other";
}

function grouped(items: AnalysisTransaction[], nameOf: (item: AnalysisTransaction) => string): SpendGroup[] {
  const map = new Map<string, SpendGroup>();
  for (const item of items) { const name = nameOf(item); const current = map.get(name) || { name, amount: 0, transaction_count: 0 }; current.amount += item.amount; current.transaction_count += 1; map.set(name, current); }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function savingsLevers(groups: SpendGroup[]): SavingsLever[] {
  return groups.filter((group) => group.amount >= 40).slice(0, 3).map((group) => {
    const rate = group.amount > 300 ? .25 : group.amount >= 100 ? .18 : .12;
    return { category: group.name, current_30_day_spend: group.amount, suggested_reduction: `${Math.round(rate * 100)}%`, estimated_savings: Math.round(group.amount * rate * 100) / 100, reasoning: `${group.name} is one of the largest flexible areas in the available sandbox history.` };
  });
}

export function buildFirstWinAnalysis(transactions: AnalysisTransaction[]) {
  if (transactions.length === 0) return emptyAnalysis();
  const valid = transactions.filter((item) => !Number.isNaN(Date.parse(item.date)));
  if (valid.length === 0) return emptyAnalysis();
  const anchor = new Date(Math.max(...valid.map((item) => Date.parse(item.date))));
  const start = new Date(anchor); start.setUTCDate(start.getUTCDate() - 29);
  const windowTransactions = valid.filter((item) => { const date = new Date(item.date); return date >= start && date <= anchor; });
  const earliest = new Date(Math.min(...windowTransactions.map((item) => Date.parse(item.date))));
  const coversThirtyDays = (anchor.getTime() - earliest.getTime()) / 86400000 >= 28;
  const analysisWindowLabel = coversThirtyDays ? `Trailing 30 days ending ${anchor.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : "Available sandbox history";
  const classified = windowTransactions.map((transaction) => ({ transaction, classification: classify(transaction) }));
  const totalInflows = Math.abs(classified.filter((item) => item.classification === "Income").reduce((sum, item) => sum + Math.min(0, item.transaction.amount), 0));
  const outflows = classified.filter((item) => item.transaction.amount > 0);
  const totalOutflows = outflows.reduce((sum, item) => sum + item.transaction.amount, 0);
  const netCashFlow = totalInflows - totalOutflows;
  const spend = (kind: Classification) => classified.filter((item) => item.classification === kind && item.transaction.amount > 0).reduce((sum, item) => sum + item.transaction.amount, 0);
  const flexible = classified.filter((item) => item.classification === "Flexible" && item.transaction.amount > 0).map((item) => item.transaction);
  const flexibleGroups = grouped(flexible, (item) => title(item.category));
  const merchantGroups = grouped(outflows.map((item) => item.transaction), (item) => item.name || "Unknown merchant").slice(0, 5);
  const largestOutflows = outflows.map((item) => ({ merchant: item.transaction.name || "Unknown merchant", amount: item.transaction.amount, category: title(item.transaction.category), date: item.transaction.date })).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const levers = savingsLevers(flexibleGroups);
  const estimatedSavings = levers.reduce((sum, lever) => sum + lever.estimated_savings, 0);
  const cashGap = Math.max(0, -netCashFlow);
  const weeklyImprovement = cashGap / 4;
  const topNames = flexibleGroups.slice(0, 3).map((group) => group.name).join(", ") || "flexible spending";
  const confidence = windowTransactions.length >= 50 && classified.filter((item) => item.classification !== "Unknown / Other").length / windowTransactions.length >= .7 ? "High" : windowTransactions.length >= 15 ? "Medium" : "Low";
  const gapCovered = estimatedSavings >= cashGap;
  const headline = cashGap > 0 ? "Close the cash-flow gap before making extra debt payments." : "Turn the available cash-flow margin into one focused win.";
  const diagnosis = cashGap > 0 ? `Based on the available sandbox history, outflows exceeded inflows by ${dollars(cashGap)}.` : `Based on the available sandbox history, inflows exceeded outflows by ${dollars(netCashFlow)}.`;
  return {
    cash_flow_summary: { total_inflows: totalInflows, total_outflows: totalOutflows, net_cash_flow: netCashFlow, cash_gap: cashGap, analysis_window_label: analysisWindowLabel, transaction_count_used: windowTransactions.length },
    spending_classification: { essential_spend: spend("Essential"), flexible_spend: spend("Flexible"), debt_payment_spend: spend("Debt / Credit Payments"), unknown_spend: spend("Unknown / Other"), top_flexible_categories: flexibleGroups.slice(0, 5).map(({ name, amount, transaction_count }) => ({ category: name, amount, transaction_count })), top_merchants: merchantGroups.map(({ name, amount, transaction_count }) => ({ merchant: name, amount, transaction_count })), largest_outflows: largestOutflows },
    savings_levers: levers,
    deficit_repair: cashGap > 0 ? { cash_gap: cashGap, weekly_improvement_needed: weeklyImprovement, flexible_spend_available: spend("Flexible"), estimated_savings_from_levers: estimatedSavings, flexible_spending_can_close_gap: gapCovered, summary: `You are ${dollars(cashGap)} behind in the ${analysisWindowLabel.toLowerCase()}. Covarify would look for about ${dollars(weeklyImprovement)} per week in improvement.`, comparison: `${topNames} are the largest flexible areas. The suggested reductions could free approximately ${dollars(estimatedSavings)} over 30 days.`, fallback: gapCovered ? null : "Flexible spending alone may not fully close the gap. Covarify would next look at bill timing, minimum payment strategy, and income timing." } : null,
    recommendation: { headline, diagnosis, why_this_matters: cashGap > 0 ? "Extra debt payments can help over time, but negative cash flow may create more immediate pressure." : "A positive margin is most useful when it is assigned deliberately instead of absorbed by scattered spending.", suggested_next_action: levers[0] ? `Your first win may be to reduce ${levers[0].category} by about ${dollars(levers[0].estimated_savings)} over the next 30 days.` : "Your first win may be to review the largest flexible transactions and choose one category to cap this week.", estimated_impact: estimatedSavings > 0 ? `The three calculated savings levers could free approximately ${dollars(estimatedSavings)} over the next 30 days.` : "More categorized transaction history would improve the estimated impact.", next_7_days: ["Review the top five flexible transactions.", "Choose one flexible category to cap this week.", "Protect cash for essential bills first.", "Keep required debt minimums current while cash flow stabilizes."], watch_out: "Covarify would not look to cut essential bills, insurance, required debt minimums, or medical spending.", confidence_level: confidence, disclaimer: "Sandbox demonstration only. Not individualized financial advice." },
  };
}

function emptyAnalysis() {
  return { cash_flow_summary: { total_inflows: 0, total_outflows: 0, net_cash_flow: 0, cash_gap: 0, analysis_window_label: "Available sandbox history", transaction_count_used: 0 }, spending_classification: { essential_spend: 0, flexible_spend: 0, debt_payment_spend: 0, unknown_spend: 0, top_flexible_categories: [], top_merchants: [], largest_outflows: [] }, savings_levers: [], deficit_repair: null, recommendation: { headline: "Your account connection is working.", diagnosis: "Transaction history is not available yet.", why_this_matters: "Covarify needs transaction history to explain where cash-flow pressure is coming from.", suggested_next_action: "Reconnect with the transaction-rich sandbox user after Plaid finishes preparing history.", estimated_impact: "More transaction history is needed to estimate an impact.", next_7_days: ["Wait for transaction history to finish processing.", "Reconnect with user_transactions_dynamic.", "Review connected account balances."], watch_out: "Do not make decisions from incomplete sandbox history.", confidence_level: "Low", disclaimer: "Sandbox demonstration only. Not individualized financial advice." } };
}
