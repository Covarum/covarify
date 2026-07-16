import { NextResponse } from "next/server";
import { getPlaidConfig, logSafePlaidError, normalizePlaidError, type SafePlaidError } from "@/lib/plaid/server";

type SanitizedAccount = { id: string; name: string; officialName: string | null; type: string; subtype: string | null; mask: string | null; currentBalance: number | null; availableBalance: number | null; currency: string };
type SanitizedTransaction = { id: string; accountId: string; name: string; amount: number; date: string; category: string; pending: boolean; currency: string };

const accountSummary = (accounts: SanitizedAccount[]) => ({
  totalCash: accounts.filter((account) => account.type === "depository").reduce((sum, account) => sum + (account.currentBalance || 0), 0),
  totalDebt: accounts.filter((account) => account.type === "credit" || account.type === "loan").reduce((sum, account) => sum + (account.currentBalance || 0), 0),
});

function firstWinRecommendation(accounts: SanitizedAccount[], transactions: SanitizedTransaction[], netCashFlow: number, spending: number) {
  const balances = accountSummary(accounts);
  if (transactions.length === 0) return { headline: "Your account connection is working.", explanation: "Covarify needs transaction history before it can confidently prioritize your first win.", action: "Wait for Plaid to finish preparing transaction history, then reconnect with the transaction-rich test user.", disclaimer: "Sandbox demonstration only. Not individualized financial advice." };
  if (netCashFlow < 0) return { headline: "Protect cash flow before making extra debt payments.", explanation: "Recent outflows are higher than inflows in the available sandbox history, so preserving near-term flexibility comes first.", action: "Pause optional extra payments and identify the next essential bills your available cash needs to cover.", disclaimer: "Sandbox demonstration only. Not individualized financial advice." };
  const flexibleCategories = new Set(["FOOD_AND_DRINK", "ENTERTAINMENT", "TRAVEL"]);
  const flexibleSpending = transactions.filter((item) => item.amount > 0 && flexibleCategories.has(item.category)).reduce((sum, item) => sum + item.amount, 0);
  if (flexibleSpending > 500 || (spending > 0 && flexibleSpending / spending >= 0.25)) return { headline: "Choose one flexible category to tighten first.", explanation: "Food, entertainment, and travel represent a meaningful share of recent sandbox spending. One focused adjustment is easier to sustain than cutting everywhere.", action: "Pick the largest flexible category and set a simple limit for the next seven days.", disclaimer: "Sandbox demonstration only. Not individualized financial advice." };
  if (balances.totalDebt > 0 && balances.totalCash < Math.max(1000, balances.totalDebt * 0.25)) return { headline: "Preserve minimum payments and avoid new charges.", explanation: "Credit debt is present while available cash is limited, making stability more useful than an aggressive payoff right now.", action: "Protect required minimum payments and avoid adding new credit charges before increasing payoff amounts.", disclaimer: "Sandbox demonstration only. Not individualized financial advice." };
  return { headline: "Direct your positive margin toward one priority.", explanation: "Available sandbox history shows positive cash flow without an immediate pressure signal.", action: "Choose one priority—cash reserves or highest-cost debt—and assign a specific amount to it.", disclaimer: "Sandbox demonstration only. Not individualized financial advice." };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const publicToken = typeof body?.public_token === "string" ? body.public_token.trim() : "";
    if (!publicToken) {
      const diagnostic: SafePlaidError = { error_type: "INVALID_REQUEST", error_code: "MISSING_PUBLIC_TOKEN", error_message: "A public_token is required.", display_message: "Complete Plaid Link before loading sandbox data.", request_id: null, status: 400 };
      return NextResponse.json(diagnostic, { status: diagnostic.status });
    }

    const { client } = getPlaidConfig();
    const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchange.data.access_token;

    // This sandbox token is used only for immediate reads and is never logged,
    // returned, or stored. TODO: Add persistent encrypted access token storage,
    // user authentication, production Plaid environment support, and token management.
    const accountsResponse = await client.accountsGet({ access_token: accessToken });
    const accounts: SanitizedAccount[] = accountsResponse.data.accounts.map((account) => ({ id: account.account_id, name: account.name, officialName: account.official_name, type: account.type, subtype: account.subtype, mask: account.mask, currentBalance: account.balances.current, availableBalance: account.balances.available, currency: account.balances.iso_currency_code || "USD" }));
    const balances = accountSummary(accounts);

    try {
      // TODO: Move transaction sync to a background job with webhook-driven refresh.
      const syncResponse = await client.transactionsSync({ access_token: accessToken, count: 100 });
      const transactions: SanitizedTransaction[] = syncResponse.data.added.map((transaction) => ({ id: transaction.transaction_id, accountId: transaction.account_id, name: transaction.merchant_name || transaction.name, amount: transaction.amount, date: transaction.date, category: transaction.personal_finance_category?.primary || transaction.category?.[0] || "Other", pending: transaction.pending, currency: transaction.iso_currency_code || "USD" }));
      const spending = transactions.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
      const inflow = Math.abs(transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
      return NextResponse.json({ connected: true, transactions_status: "ready", message: "Account connected and sandbox transactions loaded.", accounts, transactions, summary: { ...balances, recentSpending: spending, recentInflow: inflow, netCashFlow: inflow - spending, accountCount: accounts.length, transactionCount: transactions.length }, first_win: firstWinRecommendation(accounts, transactions, inflow - spending, spending) });
    } catch (transactionError) {
      const diagnostic = normalizePlaidError(transactionError, "Unable to load sandbox transactions.");
      if (diagnostic.error_code === "PRODUCT_NOT_READY") {
        return NextResponse.json({ connected: true, transactions_status: "processing", message: "Account connected. Transactions are still processing in Plaid sandbox. Try again shortly or use the transactions test user.", accounts, transactions: [], summary: { ...balances, recentSpending: 0, recentInflow: 0, netCashFlow: 0, accountCount: accounts.length, transactionCount: 0 }, first_win: firstWinRecommendation(accounts, [], 0, 0) }, { status: 202 });
      }
      throw transactionError;
    }
  } catch (error) {
    const diagnostic = normalizePlaidError(error, "Unable to exchange the sandbox token and load financial data.");
    logSafePlaidError(diagnostic);
    return NextResponse.json(diagnostic, { status: diagnostic.status });
  }
}
