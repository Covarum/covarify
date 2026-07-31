import type { MoneyTransaction } from "./money-picture.ts";

export type AccountCostClassification =
  | "credit_card_interest"
  | "issuer_fee"
  | "penalty_fee";

type AccountCostInput = Pick<
  MoneyTransaction,
  | "accountLabel"
  | "accountType"
  | "accountSubtype"
  | "category"
  | "detailedCategory"
  | "description"
  | "merchantName"
  | "name"
>;

const normalize = (value?: string | null) =>
  (value || "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toUpperCase()
    .replace(/\bINT(?:EREST)?\s+CHG\b/g, "INTEREST CHARGE")
    .replace(/\bFIN(?:ANCE)?\s+CHG\b/g, "FINANCE CHARGE")
    .replace(/\bPMT\b/g, "PAYMENT")
    .replace(/\bTXN\b/g, "TRANSACTION")
    .replace(/\bBAL\b/g, "BALANCE")
    .replace(/\bXFER\b/g, "TRANSFER")
    .replace(/\bADV\b/g, "ADVANCE")
    .replace(/\s+/g, " ");

const detailedInterest = /(?:^|_)INTEREST(?:_|$)|INTEREST_CHARGE/;
const detailedPenalty =
  /LATE_PAYMENT|RETURNED_PAYMENT|PENALTY|OVERDRAFT|NON_SUFFICIENT_FUNDS|(?:^|_)NSF(?:_|$)/;
const detailedIssuerFee =
  /ANNUAL_FEE|FOREIGN_TRANSACTION|CASH_ADVANCE|BALANCE_TRANSFER|CARD_MEMBERSHIP|OVER_LIMIT|STATEMENT_FEE/;

const interestDescriptions = new Set([
  "INTEREST CHARGE",
  "INTEREST CHARGE ON PURCHASES",
  "PURCHASE INTEREST CHARGE",
  "CASH ADVANCE INTEREST CHARGE",
  "CASH ADVANCE INTEREST",
  "BALANCE TRANSFER INTEREST CHARGE",
  "BALANCE TRANSFER INTEREST",
  "CREDIT CARD INTEREST",
  "FINANCE CHARGE",
  "MINIMUM INTEREST CHARGE",
]);
const penaltyDescriptions = new Set([
  "LATE FEE",
  "LATE PAYMENT FEE",
  "RETURNED PAYMENT FEE",
  "RETURNED CHECK FEE",
  "PENALTY FEE",
  "OVER LIMIT FEE",
  "OVERLIMIT FEE",
]);
const issuerFeeDescriptions = new Set([
  "ANNUAL FEE",
  "ANNUAL MEMBERSHIP FEE",
  "CARD MEMBERSHIP FEE",
  "FOREIGN TRANSACTION FEE",
  "BALANCE TRANSFER FEE",
  "CASH ADVANCE FEE",
  "PAPER STATEMENT FEE",
  "STATEMENT FEE",
]);

const isCreditAccount = (input: AccountCostInput) => {
  const type = normalize(input.accountType);
  const subtype = normalize(input.accountSubtype);
  const label = normalize(input.accountLabel);
  return (
    type === "CREDIT" ||
    subtype === "CREDIT CARD" ||
    /\bCREDIT CARD\b/.test(label)
  );
};

export function classifyAccountCost(
  input: AccountCostInput,
): AccountCostClassification | null {
  const detailed = normalize(input.detailedCategory).replace(/ /g, "_");
  if (detailedInterest.test(detailed)) return "credit_card_interest";
  if (detailedPenalty.test(detailed)) return "penalty_fee";
  if (detailedIssuerFee.test(detailed)) return "issuer_fee";
  if (!isCreditAccount(input)) return null;

  const primary = normalize(input.category).replace(/ /g, "_");
  if (primary === "BANK_FEES") return "issuer_fee";

  const description = normalize(input.description || input.name);
  const merchant = normalize(input.merchantName);
  if (merchant && merchant !== description) return null;
  if (interestDescriptions.has(description)) return "credit_card_interest";
  if (penaltyDescriptions.has(description)) return "penalty_fee";
  if (issuerFeeDescriptions.has(description)) return "issuer_fee";
  return null;
}

export const accountCostLabel = (
  classification: AccountCostClassification,
) =>
  classification === "credit_card_interest"
    ? "Credit-card interest"
    : "Credit-card fee";

export const accountCostDisplayLabel = (input: AccountCostInput) => {
  const classification = classifyAccountCost(input);
  return classification ? accountCostLabel(classification) : null;
};
