import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  PRICE_INCREASE_MINIMUM_DOLLARS,
  PRICE_INCREASE_MINIMUM_PERCENT,
  amountDescription,
  buildRecurringCommitments,
  recurringCommitmentSummary,
} from "../lib/recurring-commitments.ts";

const tx = (id, patch = {}) => ({
  id,
  plaidAccountId: "account-a",
  accountLabel: "Checking • 1111",
  name: "Streaming subscription",
  description: "Streaming subscription",
  amount: 15.99,
  currency: "USD",
  date: "2026-05-01",
  pending: false,
  pendingTransactionId: null,
  category: "ENTERTAINMENT",
  detailedCategory: null,
  direction: "outflow",
  transferRelationship: null,
  ...patch,
});

const monthly = (name = "Streaming subscription", amounts = [15.99, 15.99, 15.99]) =>
  ["2026-05-01", "2026-06-01", "2026-07-01"].map((date, index) =>
    tx(`${name}-${index}`, { name, description: name, amount: amounts[index], date }),
  );

test("monthly commitments require sufficient posted evidence and remain explainable", () => {
  assert.equal(buildRecurringCommitments([tx("one")]).length, 0);
  const [commitment] = buildRecurringCommitments(monthly());
  assert.equal(commitment.cadence, "monthly");
  assert.equal(commitment.supportingTransactionIds.length, 3);
  assert.match(commitment.confidenceExplanation, /3 posted charges/);
  assert.ok(commitment.nextExpected);
});

test("pending copies, transfers, refunds, and payroll are not recurring commitments", () => {
  const rows = [
    ...monthly(),
    tx("pending", { date: "2026-07-01", pending: true, pendingTransactionId: "Streaming subscription-2" }),
    ...monthly("Internal transfer").map((row) => ({ ...row, transferRelationship: "internal", category: "TRANSFER_OUT" })),
    ...monthly("Refund").map((row) => ({ ...row, amount: -15.99, direction: "inflow" })),
    ...monthly("Employer payroll").map((row) => ({ ...row, amount: -1000, direction: "inflow", category: "INCOME" })),
  ];
  const commitments = buildRecurringCommitments(rows);
  assert.equal(commitments.length, 1);
  assert.equal(commitments[0].supportingTransactionIds.length, 3);
});

test("frequent retail activity is not promoted merely because it repeats", () => {
  const groceries = monthly("Neighborhood Market", [82, 82, 82]).map((row) => ({
    ...row,
    category: "FOOD_AND_DRINK",
    effectiveParentCategory: "Food & Drink",
    effectiveSubcategory: "Groceries",
  }));
  assert.deepEqual(buildRecurringCommitments(groceries), []);
});

test("effective categories are human-readable and raw enums stay out of commitment copy", () => {
  const commitment = buildRecurringCommitments(
    monthly("Insurance payment").map((row) => ({
      ...row,
      category: "LOAN_PAYMENTS",
      effectiveParentCategory: "Bills & Utilities",
      effectiveSubcategory: "Insurance",
    })),
  )[0];
  assert.equal(commitment.effectiveCategory, "Bills & Utilities → Insurance");
  assert.doesNotMatch(commitment.effectiveCategory, /LOAN_PAYMENTS|_/);
});

test("quarterly, semiannual, annual, and irregular timing stay distinct", () => {
  const series = (name, dates) =>
    dates.map((date, index) => tx(`${name}-${index}`, { name, date }));
  assert.equal(buildRecurringCommitments(series("Quarterly subscription", ["2025-12-01", "2026-03-01", "2026-06-01"]))[0].cadence, "quarterly");
  assert.equal(buildRecurringCommitments(series("Semiannual subscription", ["2025-07-01", "2026-01-01", "2026-07-01"]))[0].cadence, "semiannual");
  assert.equal(buildRecurringCommitments(series("Annual subscription", ["2024-07-01", "2025-07-01", "2026-07-01"]))[0].cadence, "annual");
  assert.equal(buildRecurringCommitments(series("Irregular subscription", ["2026-01-01", "2026-02-09", "2026-07-01"])).length, 0);
});

test("variable ranges are truthful and unsupported next dates are omitted", () => {
  const [variable] = buildRecurringCommitments(monthly("Utility payment", [180, 260, 195]));
  assert.equal(variable.variableAmount, true);
  assert.match(amountDescription(variable), /Usually \$180\.00–\$260\.00/);
  const irregular = [
    tx("i1", { name: "Membership", date: "2026-01-01" }),
    tx("i2", { name: "Membership", date: "2026-02-18" }),
    tx("i3", { name: "Membership", date: "2026-07-01" }),
  ];
  assert.equal(buildRecurringCommitments(irregular).length, 0);
});

test("user decisions are reversible projections and attention states stay truthful", () => {
  const initial = buildRecurringCommitments(monthly())[0];
  const confirmed = new Map([[initial.patternKey, {
    recurringStatus: "confirmed",
    recognitionStatus: "recognized",
    disposition: "keep",
    commitmentType: "subscription",
    ownerLabel: "Mine",
    userNote: null,
    identityNote: null,
    loginStatus: "known",
    duplicateDecision: null,
    manualOriginalPurpose: null,
    manualCurrentBalance: null,
    manualOriginalAmount: null,
    manualPaymentsRemaining: null,
    manualNextPaymentDate: null,
  }]]);
  assert.equal(buildRecurringCommitments(monthly(), confirmed)[0].status, "confirmed");
  const reversed = new Map([[initial.patternKey, { ...confirmed.get(initial.patternKey), recurringStatus: "not_recurring" }]]);
  assert.equal(buildRecurringCommitments(monthly(), reversed).length, 0);
  const unrecognized = new Map([[initial.patternKey, { ...confirmed.get(initial.patternKey), recognitionStatus: "unrecognized", disposition: "cancellation_requested" }]]);
  const attention = buildRecurringCommitments(monthly(), unrecognized)[0];
  assert.equal(attention.status, "needs_attention");
  assert.match(attention.attentionReasons.join(" "), /unrecognized/);
  assert.match(attention.attentionReasons.join(" "), /Cancellation requested for review/);
  assert.doesNotMatch(attention.attentionReasons.join(" "), /canceled|cancelled/);
});

test("Affirm and Klarna are possible installments and distinct amount plans stay separate", () => {
  const affirm = [
    ...monthly("Affirm plan", [50, 50, 50]),
    ...monthly("Affirm plan", [80, 80, 80]).map((row, index) => ({ ...row, id: `affirm-b-${index}` })),
  ];
  const commitments = buildRecurringCommitments(affirm);
  assert.equal(commitments.length, 2);
  assert.ok(commitments.every((item) => item.type === "buy_now_pay_later"));
  assert.ok(commitments.every((item) => item.attentionReasons.some((reason) => /may include more than one payment plan/i.test(reason))));
  const klarna = buildRecurringCommitments(monthly("Klarna payment"))[0];
  assert.equal(klarna.type, "buy_now_pay_later");
  assert.notEqual(klarna.type, "subscription");
});

test("price attention requires both the absolute and percentage threshold", () => {
  assert.equal(PRICE_INCREASE_MINIMUM_DOLLARS, 5);
  assert.equal(PRICE_INCREASE_MINIMUM_PERCENT, 10);
  assert.equal(buildRecurringCommitments(monthly("Software subscription", [15, 15, 15.5]))[0].attentionReasons.length, 0);
  assert.match(buildRecurringCommitments(monthly("Software subscription", [15, 15, 20]))[0].attentionReasons[0], /Price increased/);
});

test("monthly equivalent appears only for fully supportable confirmed commitments", () => {
  const item = buildRecurringCommitments(monthly())[0];
  item.status = "confirmed";
  assert.equal(recurringCommitmentSummary([item]).monthlyEquivalent, 15.99);
  item.variableAmount = true;
  assert.equal(recurringCommitmentSummary([item]).monthlyEquivalent, null);
});

test("cancellation intent alone is not promoted as a new Money Picture alert", () => {
  const commitment = buildRecurringCommitments(monthly())[0];
  commitment.status = "needs_attention";
  commitment.attentionReasons = ["Cancellation requested for review."];
  assert.equal(recurringCommitmentSummary([commitment]).meaningfulAttention, null);
});

test("canonical housing payments are not duplicated as recurring commitments", () => {
  const rent = monthly("The Heights Manage", [1450, 1450, 1450]).map((row) => ({
    ...row,
    effectiveParentCategory: "Housing",
    effectiveSubcategory: "Rent",
    housingObligation: {
      type: "rent",
      paymentType: "full",
      expectedAmount: 1450,
      remainingDue: 0,
      dueDay: 1,
      ongoingStatus: "ongoing",
    },
  }));
  assert.deepEqual(buildRecurringCommitments(rent), []);
});

test("migration enforces owner-scoped evidence and append-only decision chains", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260730224500_recurring_commitments_v1.sql", import.meta.url), "utf8");
  assert.match(migration, /foreign key \(user_id, plaid_transaction_id\)[\s\S]*references public\.plaid_transactions\(user_id, id\)/);
  assert.match(migration, /foreign key \(user_id, supersedes_version_id\)[\s\S]*recurring_commitment_decision_versions\(user_id, id\)/);
  assert.match(migration, /recurring_commitment_decisions_one_successor_idx/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /CROSS_USER_OR_MISSING_TRANSACTION/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /housing_obligation_version_id[\s\S]*recurring_obligation_versions/);
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from)\b/i);
});

test("consumer UI is real, cautious, password-free, and responsive", () => {
  const page = readFileSync(new URL("../app/account/recurring/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/account/recurring/recurring.module.css", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/account/authenticated-workspace.tsx", import.meta.url), "utf8");
  assert.match(page, /Recurring Commitments/);
  assert.match(page, /Cancellation requested for review|marks cancellation intent/);
  assert.match(page, /Provided by you/);
  assert.match(page, /I can&apos;t find the login/);
  assert.doesNotMatch(page, /name=["']password/i);
  assert.match(page, /name="mode" value="editor"/);
  assert.doesNotMatch(page, /Gmail|scan email/i);
  assert.match(page, /Supporting transactions/);
  assert.match(page, />View supporting transactions</);
  assert.match(workspace, /href="\/account\/recurring"/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.doesNotMatch(css, /min-width:\s*[4-9]\d\dpx/);
});

test("identity notes reject credential-like values and editor fields can be cleared", () => {
  const action = readFileSync(new URL("../app/account/recurring/actions.ts", import.meta.url), "utf8");
  assert.match(action, /CREDENTIALS_NOT_ALLOWED/);
  assert.match(action, /isEditor \? identityNote/);
  assert.match(action, /manualCurrentBalance:\s+isEditor\s+\?\s+manualCurrentBalance/);
  assert.match(action, /INVALID_USER_PROVIDED_COUNT/);
  assert.match(action, /INVALID_USER_PROVIDED_DATE/);
});
