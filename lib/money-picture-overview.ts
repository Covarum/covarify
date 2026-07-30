export type ConnectedAccountSummaryInput = {
  id: string;
  institution: string;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
};

export type ConnectedAccountKind = "cash" | "credit" | "loan" | "investment" | "other";

export function connectedAccountKind(
  account: Pick<ConnectedAccountSummaryInput, "type" | "subtype">,
): ConnectedAccountKind {
  const type = account.type.toLowerCase();
  const subtype = (account.subtype || "").toLowerCase();
  if (type === "depository" && ["checking", "savings", "money market", "cash management"].includes(subtype)) return "cash";
  if (type === "credit") return "credit";
  if (type === "loan") return "loan";
  if (type === "investment" || type === "brokerage") return "investment";
  return "other";
}

const knownSum = (
  accounts: ConnectedAccountSummaryInput[],
  value: (account: ConnectedAccountSummaryInput) => number | null,
) => {
  if (!accounts.length) return null;
  const values = accounts.map(value);
  return values.every((item): item is number => item !== null)
    ? values.reduce((sum, item) => sum + item, 0)
    : null;
};

export function buildConnectedAccountSummary(accounts: ConnectedAccountSummaryInput[]) {
  const groups = {
    cash: accounts.filter((account) => connectedAccountKind(account) === "cash"),
    credit: accounts.filter((account) => connectedAccountKind(account) === "credit"),
    loan: accounts.filter((account) => connectedAccountKind(account) === "loan"),
    investment: accounts.filter((account) => connectedAccountKind(account) === "investment"),
    other: accounts.filter((account) => connectedAccountKind(account) === "other"),
  };
  return {
    accountCount: accounts.length,
    institutionCount: new Set(accounts.map((account) => account.institution)).size,
    cashAccountCount: groups.cash.length,
    creditAccountCount: groups.credit.length,
    loanAccountCount: groups.loan.length,
    investmentAccountCount: groups.investment.length,
    otherAccountCount: groups.other.length,
    availableCash: knownSum(groups.cash, (account) => account.availableBalance ?? account.currentBalance),
    creditCardDebt: knownSum(groups.credit, (account) =>
      account.currentBalance === null ? null : Math.max(0, account.currentBalance)),
    otherDebt: knownSum(groups.loan, (account) =>
      account.currentBalance === null ? null : Math.max(0, account.currentBalance)),
    investments: knownSum(groups.investment, (account) => account.currentBalance),
  };
}

export function accountTypeLabel(account: Pick<ConnectedAccountSummaryInput, "type" | "subtype">) {
  const kind = connectedAccountKind(account);
  if (kind === "cash") return account.subtype?.toLowerCase() === "savings" ? "Savings" : "Cash account";
  if (kind === "credit") return "Credit card";
  if (kind === "loan") return "Loan";
  if (kind === "investment") return "Investment";
  return "Connected account";
}
