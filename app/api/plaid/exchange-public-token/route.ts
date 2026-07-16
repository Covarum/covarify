import { NextResponse } from "next/server";
import { getPlaidConfig, logSafePlaidError, normalizePlaidError, type SafePlaidError } from "@/lib/plaid/server";
import { buildFirstWinAnalysis } from "@/lib/plaid/first-win-engine";

type SanitizedAccount = { id: string; name: string; officialName: string | null; type: string; subtype: string | null; mask: string | null; currentBalance: number | null; availableBalance: number | null; currency: string };
type SanitizedTransaction = { id: string; accountId: string; name: string; amount: number; date: string; category: string; pending: boolean; currency: string };

const accountSummary = (accounts: SanitizedAccount[]) => ({
  totalCash: accounts.filter((account) => account.type === "depository").reduce((sum, account) => sum + (account.currentBalance || 0), 0),
  totalDebt: accounts.filter((account) => account.type === "credit" || account.type === "loan").reduce((sum, account) => sum + (account.currentBalance || 0), 0),
});

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
      transactions.sort((a, b) => b.date.localeCompare(a.date));
      const spending = transactions.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
      const inflow = Math.abs(transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
      return NextResponse.json({ connected: true, transactions_status: "ready", message: "Account connected and sandbox transactions loaded.", accounts, transactions, summary: { ...balances, recentSpending: spending, recentInflow: inflow, netCashFlow: inflow - spending, accountCount: accounts.length, transactionCount: transactions.length }, first_win: buildFirstWinAnalysis(transactions) });
    } catch (transactionError) {
      const diagnostic = normalizePlaidError(transactionError, "Unable to load sandbox transactions.");
      if (diagnostic.error_code === "PRODUCT_NOT_READY") {
        return NextResponse.json({ connected: true, transactions_status: "processing", message: "Account connected. Transactions are still processing in Plaid sandbox. Try again shortly or use the transactions test user.", accounts, transactions: [], summary: { ...balances, recentSpending: 0, recentInflow: 0, netCashFlow: 0, accountCount: accounts.length, transactionCount: 0 }, first_win: buildFirstWinAnalysis([]) }, { status: 202 });
      }
      throw transactionError;
    }
  } catch (error) {
    const diagnostic = normalizePlaidError(error, "Unable to exchange the sandbox token and load financial data.");
    logSafePlaidError(diagnostic);
    return NextResponse.json(diagnostic, { status: diagnostic.status });
  }
}
