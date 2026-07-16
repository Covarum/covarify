import { NextResponse } from "next/server";
import { getPlaidConfig, logSafePlaidError, normalizePlaidError, type SafePlaidError } from "@/lib/plaid/server";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

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

    // The sandbox token is used only for these immediate reads. It is never logged,
    // returned to the browser, or stored. TODO: Add encrypted token storage and token management.
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
    const [accountsResponse, transactionsResponse] = await Promise.all([
      client.accountsGet({ access_token: accessToken }),
      client.transactionsGet({ access_token: accessToken, start_date: isoDate(startDate), end_date: isoDate(endDate), options: { count: 25, offset: 0 } }),
    ]);

    const accounts = accountsResponse.data.accounts.map((account) => ({
      id: account.account_id,
      name: account.name,
      officialName: account.official_name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      currentBalance: account.balances.current,
      availableBalance: account.balances.available,
      currency: account.balances.iso_currency_code || "USD",
    }));
    const transactions = transactionsResponse.data.transactions.map((transaction) => ({
      id: transaction.transaction_id,
      accountId: transaction.account_id,
      name: transaction.merchant_name || transaction.name,
      amount: transaction.amount,
      date: transaction.date,
      category: transaction.personal_finance_category?.primary || transaction.category?.[0] || "Other",
      pending: transaction.pending,
      currency: transaction.iso_currency_code || "USD",
    }));
    const spending = transactions.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
    const inflow = Math.abs(transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
    const cash = accounts.filter((account) => account.type === "depository").reduce((sum, account) => sum + (account.currentBalance || 0), 0);
    const debt = accounts.filter((account) => account.type === "credit" || account.type === "loan").reduce((sum, account) => sum + (account.currentBalance || 0), 0);

    return NextResponse.json({ accounts, transactions, summary: { totalCash: cash, totalDebt: debt, recentSpending: spending, recentInflow: inflow, netCashFlow: inflow - spending, accountCount: accounts.length, transactionCount: transactions.length } });
  } catch (error) {
    const diagnostic = normalizePlaidError(error, "Unable to exchange the sandbox token and load financial data.");
    logSafePlaidError(diagnostic);
    return NextResponse.json(diagnostic, { status: diagnostic.status });
  }
}
