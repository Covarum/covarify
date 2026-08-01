import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  PRICE_INCREASE_MINIMUM_DOLLARS,
  PRICE_INCREASE_MINIMUM_PERCENT,
  amountDescription,
  buildRecurringCommitments,
  reconcileSupportingTransactions,
  filterRecurringCommitments,
  recurringCommitmentSummary,
} from "../lib/recurring-commitments.ts";
import {
  INSURANCE_PARENT,
  INSURANCE_SUBCATEGORIES,
  assistedCategoryProposalBoundary,
  deterministicInsuranceProposal,
  recurringCategoryProposal,
  recurringContextProposal,
  BUSINESS_CATEGORY,
} from "../lib/recurring-category-understanding.ts";

const searchableCommitment = (status, patch = {}) => ({
  patternKey: `lemonade-${status}`,
  displayName: "Lemonade Insurance",
  normalizedMerchant: "LEMONADE INSURANCE",
  type: "insurance",
  status,
  effectiveCategory: "Insurance → Renters Insurance",
  paymentAccountLabel: "Checking • 1111",
  decision: { ownerLabel: "Mine", userNote: "renter's insurance", identityNote: null, manualOriginalPurpose: null },
  supportingTransactions: [tx(`support-${status}`, { name: "LEMONADE INSURANCE CO", description: "Monthly renters policy", date: "2026-06-25" })],
  ...patch,
});

test("recurring search uses all statuses and any in-period supporting evidence", () => {
  const period = { start: "2026-04-01", end: "2026-06-30" };
  const commitments = ["needs_attention", "confirmed", "possible", "completed"].map(searchableCommitment);
  assert.equal(filterRecurringCommitments(commitments, { period, search: "Lemonade" }).length, 4);
  assert.equal(filterRecurringCommitments(commitments, { period, search: "monthly renters policy" }).length, 4);
  assert.equal(filterRecurringCommitments(commitments, { period, search: "renter's insurance" }).length, 4);
  assert.equal(filterRecurringCommitments(commitments, { period, status: "needs_attention" }).length, 1);
  const latestOutside = searchableCommitment("completed", { lastObserved: "2026-07-25", supportingTransactions: [
    tx("june", { date: "2026-06-25" }), tx("july", { date: "2026-07-25" }),
  ] });
  assert.equal(filterRecurringCommitments([latestOutside], { period, search: "Lemonade" }).length, 1);
  assert.equal(filterRecurringCommitments([latestOutside], { period: { start: "2026-01-01", end: "2026-03-31" }, search: "Lemonade" }).length, 0);
  assert.doesNotMatch(JSON.stringify(filterRecurringCommitments(commitments, { period, search: "Lemonade" })), /pattern_key|normalized_merchant/);
});

test("descriptive recurring notes produce progressive business proposals without applying them", () => {
  const commitment = searchableCommitment("possible", {
    displayName: "Calendly",
    type: "software_service",
    decision: { userNote: "my calendar booking app for Covarum", contextRelationship: null, businessUse: null, effectiveParentCategory: null },
  });
  const proposal = recurringContextProposal(commitment);
  assert.equal(proposal.namedEntity, "Covarum");
  assert.equal(proposal.proposedType, "software_service");
  assert.deepEqual(proposal.proposedCategory, BUSINESS_CATEGORY);
  assert.equal(proposal.nextQuestion, "entity_relationship");
  assert.equal(recurringContextProposal({ ...commitment, decision: { ...commitment.decision, userNote: "check this later" } }), null);
  assert.doesNotMatch(JSON.stringify(proposal), /deductible|EIN|ownership percentage/i);
});

test("recurring UX exposes semantic search, dismissible completion, and contextual attention routing", () => {
  const workspace = readFileSync(new URL("../app/account/recurring/recurring-workspace.tsx", import.meta.url), "utf8");
  const account = readFileSync(new URL("../components/account/authenticated-workspace.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/account/recurring/recurring.module.css", import.meta.url), "utf8");
  assert.match(workspace, /type="search"/);
  assert.match(workspace, /Dismiss saved notice/);
  assert.match(workspace, /setTimeout\(\(\) => setNotice\(null\), 9000\)/);
  assert.match(workspace, /setOpen\(false\)/);
  assert.match(account, /status=needs_attention/);
  assert.match(account, /observationAction/);
  assert.match(css, /@media\(max-width:560px\).*searchControls/);
});

test("business context migration is additive, owner-scoped, append-only, and service-role only", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260801010000_recurring_context_and_business_categories.sql", import.meta.url), "utf8");
  assert.match(migration, /'Business', 'business'/);
  assert.match(migration, /'Software & Services'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /where user_id = p_user_id and pattern_key = p_pattern_key/);
  assert.match(migration, /supersedes_version_id/);
  assert.match(migration, /revoke all on function public\.record_recurring_commitment_context_decision.*authenticated/s);
  assert.match(migration, /grant execute on function public\.record_recurring_commitment_context_decision.*service_role/s);
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from|update public\.)\b/i);
});

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

test("insurance notes produce canonical proposals without treating general notes as commands", () => {
  for (const phrase of ["renter’s insurance", "renters insurance"]) {
    const proposal = deterministicInsuranceProposal(phrase);
    assert.equal(proposal.parentCategory, "Insurance");
    assert.equal(proposal.subcategory, "Renters Insurance");
  }
  const mappings = new Map([
    ["auto insurance", "Auto Insurance"],
    ["car insurance", "Auto Insurance"],
    ["homeowners insurance", "Homeowners Insurance"],
    ["life insurance", "Life Insurance"],
    ["health insurance", "Health Insurance"],
    ["disability insurance", "Disability Insurance"],
    ["pet insurance", "Pet Insurance"],
  ]);
  for (const [phrase, expected] of mappings) {
    assert.equal(deterministicInsuranceProposal(phrase)?.subcategory, expected);
  }
  for (const note of [
    "Need to look at this later",
    "Called them Tuesday",
    "Not sure why this increased",
  ]) {
    assert.equal(deterministicInsuranceProposal(note), null);
  }
  assert.equal(
    assistedCategoryProposalBoundary(deterministicInsuranceProposal("pet insurance"))
      ?.source,
    "deterministic_note",
  );
});

test("confirmed Insurance with Other requires review and accepted context wins canonically", () => {
  const base = {
    type: "insurance",
    effectiveCategory: "Other",
    decision: {
      userNote: "renter's insurance",
      categoryResolution: null,
      effectiveParentCategory: null,
    },
  };
  const proposal = recurringCategoryProposal(base);
  assert.equal(proposal.subcategory, "Renters Insurance");
  assert.equal(proposal.parentCategoryId, INSURANCE_PARENT.id);
  assert.equal(
    INSURANCE_SUBCATEGORIES.filter((item) => item.name === "Renters Insurance")
      .length,
    1,
  );
  assert.equal(
    recurringCategoryProposal({
      ...base,
      decision: {
        ...base.decision,
        categoryResolution: "kept_current",
      },
    }),
    null,
  );
  assert.equal(
    recurringCategoryProposal({
      ...base,
      decision: {
        ...base.decision,
        categoryResolution: "accepted",
        effectiveParentCategory: "Insurance",
      },
    }),
    null,
  );
});

test("commitment-level category overrides weak evidence without mutating source transactions", () => {
  const decision = {
    recurringStatus: "confirmed",
    recognitionStatus: "recognized",
    disposition: "keep",
    commitmentType: "insurance",
    ownerLabel: "Household",
    userNote: "renter's insurance",
    identityNote: null,
    loginStatus: null,
    duplicateDecision: null,
    manualOriginalPurpose: null,
    manualCurrentBalance: null,
    manualOriginalAmount: null,
    manualPaymentsRemaining: null,
    manualNextPaymentDate: null,
    effectiveParentCategoryId: INSURANCE_PARENT.id,
    effectiveSubcategoryId: INSURANCE_SUBCATEGORIES[0].id,
    effectiveParentCategory: "Insurance",
    effectiveSubcategory: "Renters Insurance",
    categoryResolution: "accepted",
    supportingTransactionsClassified: false,
  };
  const rows = monthly("Lemonade Insurance").map((row) => ({
    ...row,
    category: "OTHER",
    sourceCategory: "OTHER",
  }));
  const detected = buildRecurringCommitments(rows);
  const [unconfirmed] = detected;
  const [confirmed] = buildRecurringCommitments(
    rows,
    new Map([[unconfirmed.patternKey, decision]]),
  );
  assert.equal(confirmed.type, "insurance");
  assert.equal(confirmed.effectiveCategory, "Insurance → Renters Insurance");
  assert.ok(confirmed.supportingTransactions.every((row) => row.sourceCategory === "OTHER"));
  assert.ok(confirmed.supportingTransactions.every((row) => row.category === "OTHER"));
});

test("category migration and review flow are additive, owner-scoped, and explicit", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260731013000_recurring_commitment_categories.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const actions = readFileSync(
    new URL("../app/account/recurring/actions.ts", import.meta.url),
    "utf8",
  );
  const workspace = readFileSync(
    new URL(
      "../app/account/recurring/recurring-workspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /Renters Insurance/);
  assert.match(migration, /on conflict \(id\) do nothing/);
  assert.match(migration, /subcategory already|normalized_name/);
  assert.match(migration, /p_user_id/);
  assert.match(migration, /subcategory\.user_id is null or subcategory\.user_id = p_user_id/);
  assert.match(migration, /security definer/);
  assert.match(migration, /to service_role/);
  assert.match(actions, /categorySource !== "user_confirmed"/);
  assert.match(actions, /appendTransactionUnderstandingRecords/);
  assert.match(workspace, /Yes, apply to these transactions/);
  assert.match(workspace, /Use only for this commitment/);
  assert.match(workspace, /Not now/);
  assert.match(workspace, /Keep current classification/);
});

test("monthly commitments require sufficient posted evidence and remain explainable", () => {
  assert.equal(buildRecurringCommitments([tx("one")]).length, 0);
  const [commitment] = buildRecurringCommitments(monthly());
  assert.equal(commitment.cadence, "monthly");
  assert.equal(commitment.supportingTransactionIds.length, 3);
  assert.match(commitment.confidenceExplanation, /3 posted charges/);
  assert.ok(commitment.nextExpected);
});

test("credit-card interest and issuer fees never become commitments or duplicate warnings", () => {
  const costs = [
    ...monthly("Interest Charge").map((row) => ({
      ...row,
      description: "INTEREST CHARGE",
      merchantName: null,
      accountType: "credit",
      accountSubtype: "credit card",
    })),
    ...monthly("Annual Fee").map((row) => ({
      ...row,
      description: "ANNUAL FEE",
      merchantName: null,
      accountType: "credit",
      accountSubtype: "credit card",
      plaidAccountId: "account-b",
    })),
  ];
  const commitments = buildRecurringCommitments(costs);
  assert.deepEqual(commitments, []);
  assert.deepEqual(recurringCommitmentSummary(commitments), {
    confirmed: 0,
    possible: 0,
    needsAttention: 0,
    completed: 0,
    monthlyEquivalent: null,
    meaningfulAttention: null,
  });
});

test("account costs remain in Recent Activity and transaction detail with source evidence", () => {
  const activity = readFileSync(
    new URL("../components/account/recent-activity.tsx", import.meta.url),
    "utf8",
  );
  const detail = readFileSync(
    new URL("../components/account/transaction-understanding.tsx", import.meta.url),
    "utf8",
  );
  const server = readFileSync(
    new URL("../lib/recurring-commitments-server.ts", import.meta.url),
    "utf8",
  );
  assert.match(activity, /covarify:understand-transaction/);
  assert.match(detail, /Transaction detail/);
  assert.match(detail, /<dt>Source<\/dt>/);
  assert.match(detail, /accountCostDisplayLabel/);
  assert.match(detail, /Account cost/);
  assert.match(server, /plaid_item_id,name,official_name,mask,type,subtype/);
  assert.match(server, /institutionName/);
  assert.match(server, /merchantName/);
  assert.match(server, /category_data/);
});

test("supporting transaction reconciliation returns only exact requested evidence", () => {
  const [commitment] = buildRecurringCommitments(monthly());
  const extra = tx("different-user-or-pattern");
  commitment.supportingTransactions.push(extra);
  assert.deepEqual(
    reconcileSupportingTransactions(commitment).available.map((row) => row.id),
    commitment.supportingTransactionIds,
  );
  assert.equal(reconcileSupportingTransactions(commitment).missingCount, 0);
});

test("supporting transaction reconciliation handles removed and partial evidence", () => {
  const [commitment] = buildRecurringCommitments(monthly());
  const partial = {
    ...commitment,
    supportingTransactions: commitment.supportingTransactions.slice(0, 2),
  };
  assert.equal(reconcileSupportingTransactions(partial).available.length, 2);
  assert.equal(reconcileSupportingTransactions(partial).missingCount, 1);
  assert.deepEqual(
    reconcileSupportingTransactions({
      ...commitment,
      supportingTransactions: [],
    }),
    { available: [], missingCount: 3 },
  );
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
  const review = new Map([[initial.patternKey, { ...confirmed.get(initial.patternKey), disposition: "review" }]]);
  assert.equal(buildRecurringCommitments(monthly(), review)[0].status, "needs_attention");
  const keepPossible = new Map([[initial.patternKey, { ...confirmed.get(initial.patternKey), recurringStatus: "possible", disposition: "keep" }]]);
  assert.equal(buildRecurringCommitments(monthly(), keepPossible)[0].status, "possible");
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
  assert.equal(klarna.detectedType, "buy_now_pay_later");
  assert.notEqual(klarna.type, "subscription");
});

test("confirmed installment type and completed activity remain independent", () => {
  const detected = buildRecurringCommitments(monthly("Installment payment"))[0];
  const completed = new Map([[detected.patternKey, {
    recurringStatus: "completed",
    recognitionStatus: "recognized",
    disposition: "keep",
    commitmentType: "installment_loan",
    ownerLabel: "Mine",
    userNote: null,
    identityNote: null,
    loginStatus: "unsure",
    duplicateDecision: null,
    manualOriginalPurpose: null,
    manualCurrentBalance: null,
    manualOriginalAmount: null,
    manualPaymentsRemaining: null,
    manualNextPaymentDate: null,
  }]]);
  const commitment = buildRecurringCommitments(monthly("Installment payment"), completed)[0];
  assert.equal(commitment.detectedType, "unknown_recurring");
  assert.equal(commitment.type, "installment_loan");
  assert.equal(commitment.status, "completed");
  assert.equal(recurringCommitmentSummary([commitment]).confirmed, 0);
  assert.equal(recurringCommitmentSummary([commitment]).completed, 1);
});

test("known BNPL providers can be confirmed without losing cautious detection", () => {
  const detected = buildRecurringCommitments(monthly("Klarna payment"))[0];
  assert.equal(detected.decision, null);
  assert.equal(detected.detectedType, "buy_now_pay_later");
  const decisions = new Map([[detected.patternKey, {
    recurringStatus: "confirmed",
    recognitionStatus: "recognized",
    disposition: "keep",
    commitmentType: "buy_now_pay_later",
    ownerLabel: "Mine",
    userNote: null,
    identityNote: null,
    loginStatus: "unsure",
    duplicateDecision: null,
    manualOriginalPurpose: null,
    manualCurrentBalance: null,
    manualOriginalAmount: null,
    manualPaymentsRemaining: null,
    manualNextPaymentDate: null,
  }]]);
  const confirmed = buildRecurringCommitments(monthly("Klarna payment"), decisions)[0];
  assert.equal(confirmed.type, "buy_now_pay_later");
  assert.equal(confirmed.status, "needs_attention");
  assert.ok(confirmed.installmentAmbiguous);
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

test("completed activity migration extends only the versioned decision status", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260731010000_add_completed_recurring_commitment_state.sql", import.meta.url), "utf8");
  assert.match(migration, /recurring_status in \('confirmed', 'completed', 'possible', 'not_recurring'\)/);
  assert.match(migration, /without erasing commitment_type/);
  assert.doesNotMatch(migration, /\b(drop table|truncate|delete from|update public\.)\b/i);
});

test("consumer UI is real, cautious, password-free, and responsive", () => {
  const page = readFileSync(new URL("../app/account/recurring/page.tsx", import.meta.url), "utf8");
  const review = readFileSync(new URL("../app/account/recurring/recurring-workspace.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/account/recurring/recurring.module.css", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/account/authenticated-workspace.tsx", import.meta.url), "utf8");
  assert.match(page, /getAuthenticatedUser/);
  assert.match(review, /Recurring Commitments/);
  assert.match(review, /does not report fraud or cancel anything/);
  assert.match(review, /Provided by you/);
  assert.match(review, /I can’t find the login/);
  assert.doesNotMatch(review, /name=["']password/i);
  assert.doesNotMatch(review, /Gmail|scan email/i);
  assert.match(review, /Supporting transactions/);
  assert.match(review, /Supporting charges for/);
  assert.match(review, /Review transaction/);
  assert.match(review, /role="dialog"/);
  assert.match(review, /Source category/);
  assert.match(review, /Effective classification/);
  assert.match(review, /Back to \{commitment\.displayName\}/);
  assert.match(review, /This supporting transaction is no longer available/);
  assert.match(review, /One or more supporting transactions are no longer available/);
  assert.doesNotMatch(review, /href=.*transaction/i);
  assert.match(review, /Add installment details/);
  assert.match(workspace, /recurringHref|\/account\/recurring/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.doesNotMatch(css, /min-width:\s*[4-9]\d\dpx/);
  assert.match(css, /\.transactionDialog/);
  assert.match(css, /\.transactionDialog dl\{grid-template-columns:1fr\}/);
});

test("identity notes reject credential-like values and editor fields can be cleared", () => {
  const action = readFileSync(new URL("../app/account/recurring/actions.ts", import.meta.url), "utf8");
  assert.match(action, /CREDENTIALS_NOT_ALLOWED/);
  assert.match(action, /identityNote: assertNoCredential/);
  assert.match(action, /manualCurrentBalance: optionalNumber/);
  assert.match(action, /INVALID_USER_PROVIDED_COUNT/);
  assert.match(action, /INVALID_USER_PROVIDED_DATE/);
});

test("server action module exports async functions only at runtime", () => {
  const action = readFileSync(new URL("../app/account/recurring/actions.ts", import.meta.url), "utf8");
  assert.doesNotMatch(action, /export const initialRecurringReviewActionState/);
  assert.match(action, /export async function saveRecurringCommitmentDecision/);
  assert.match(action, /export async function undoRecurringCommitmentDecision/);
});

test("supporting evidence is loaded through the authenticated owner scope", () => {
  const server = readFileSync(new URL("../lib/recurring-commitments-server.ts", import.meta.url), "utf8");
  assert.match(server, /\.from\("plaid_transactions"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(server, /\.from\("plaid_accounts"\)[\s\S]*\.eq\("user_id", userId\)/);
  assert.match(server, /\.from\("plaid_items"\)[\s\S]*\.eq\("user_id", userId\)/);
});

test("review choices are progressive, visibly selected, and saved once", () => {
  const review = readFileSync(new URL("../app/account/recurring/recurring-workspace.tsx", import.meta.url), "utf8");
  assert.match(review, /1\. What is this charge\?/);
  assert.match(review, /2\. Does this payment still repeat\?/);
  assert.match(review, /3\. Do you recognize it\?/);
  assert.match(review, /4\. What would you like to do\?/);
  assert.match(review, /Use \$\{typeLabel\[commitment\.detectedType\]\}/);
  assert.match(review, /Choose another type/);
  assert.match(review, /Yes, it is active/);
  assert.match(review, /No, it is finished/);
  assert.match(review, /Yes, I recognize it/);
  assert.match(review, /No, I don’t recognize it/);
  assert.match(review, /aria-pressed=\{selected\}/);
  assert.match(review, /type="button"/);
  assert.match(review, /type="submit"/);
  assert.match(review, /disabled=\{!changed \|\| pending \|\| state\.status === "saved" \|\| Boolean\(categoryProposal\) \|\| Boolean\(contextProposal\)\}/);
  assert.match(review, /pending \? "Saving…" : state\.status === "saved" \? "Saved" : "Save"/);
  assert.equal((review.match(/action=\{formAction\}/g) || []).length, 1);
  assert.doesNotMatch(review, /<form action=\{saveRecurringCommitmentDecision\}/);
  assert.doesNotMatch(review, /No, it isn’t recurring/);
  assert.match(review, /draft\.recurringStatus === "completed"/);
  assert.match(review, /Completed Plans/);
  assert.match(review, /Possible installment payment/);
  assert.match(review, /Buy now, pay later/);
});

test("save feedback, section movement, errors, and undo remain explicit", () => {
  const review = readFileSync(new URL("../app/account/recurring/recurring-workspace.tsx", import.meta.url), "utf8");
  const action = readFileSync(new URL("../app/account/recurring/actions.ts", import.meta.url), "utf8");
  assert.match(review, /state\.status === "error"/);
  assert.match(action, /Your selections are still here/);
  assert.match(review, /state\.status === "saved"/);
  assert.match(review, /setTimeout\(\(\) =>/);
  assert.match(review, /1000/);
  assert.match(review, /undoRecurringCommitmentDecision/);
  assert.match(review, /Previous understanding restored\. Decision history was preserved\./);
  assert.match(action, /moved to Confirmed Recurring/);
  assert.match(action, /removed from recurring suggestions/);
  assert.match(action, /moved to Needs Attention/);
  assert.match(action, /remains in Possible Recurring/);
  assert.match(action, /Saved as a completed installment plan/);
  assert.match(action, /supersedes_version_id/);
  assert.match(action, /record_recurring_commitment_decision/);
});
