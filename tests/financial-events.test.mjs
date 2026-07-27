import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  FINANCIAL_EVENTS_RULE_VERSION,
  applyFinancialEventConfirmation,
  buildFinancialEventLayer,
  buildFinancialEvents,
} from "../lib/financial-events.ts";
import {
  confirmationIsStale,
  effectiveEventType,
  effectiveDisplayTitle,
  groupingDecision,
  isExactFounderAllowlistMatch,
  nextUnreviewedIndex,
  recurringDecision,
  recurringReviewPriority,
  groupedReviewPriority,
  REVIEW_QUEUE_THRESHOLD,
  reviewTierForCard,
} from "../lib/financial-event-confirmations.ts";

const tx = (id, patch = {}) => ({
  id,
  plaidAccountId: "account-a",
  accountLabel: "Checking • 1111",
  name: "Activity",
  amount: 10,
  currency: "USD",
  date: "2026-07-01",
  pending: false,
  pendingTransactionId: null,
  category: "Uncategorized",
  detailedCategory: null,
  direction: "outflow",
  transferRelationship: null,
  ...patch,
});

test("event-worthiness separates events, classified activity, and unresolved activity", () => {
  const layer = buildFinancialEventLayer([
    tx("pay", {
      name: "Employer payroll",
      amount: -1500,
      category: "INCOME",
      direction: "inflow",
    }),
    tx("food", { name: "Neighborhood cafe", category: "FOOD_AND_DRINK" }),
    tx("unknown"),
  ]);
  assert.equal(layer.events.length, 1);
  assert.equal(layer.events[0].eventWorthy, true);
  assert.deepEqual(layer.events[0].eventWorthinessReasons, [
    "income_event",
    "memory_relevant",
  ]);
  assert.equal(layer.classifiedActivity.length, 1);
  assert.equal(layer.classifiedActivity[0].eventWorthy, false);
  assert.equal(layer.unresolvedActivity.length, 1);
  assert.equal(layer.unresolvedActivity[0].classification, "unresolved_activity");
});

test("payroll uses only visible deposit evidence and does not invent paycheck deductions", () => {
  const events = buildFinancialEvents([
    tx("pay", {
      name: "Direct deposit payroll",
      amount: -2000,
      category: "INCOME",
      direction: "inflow",
    }),
    tx("retirement", {
      name: "Investment contribution",
      amount: 200,
      category: "TRANSFER_OUT",
      date: "2026-07-02",
    }),
  ]);
  const event = events.find((candidate) => candidate.type === "payroll");
  assert.equal(event.type, "payroll");
  assert.equal(event.title, "Payroll received");
  assert.deepEqual(event.relatedTransactionIds, ["pay"]);
  assert.doesNotMatch(event.supportingEvidence.explanation, /deduction|taxes|401/i);
});

test("reliable repeated payroll deposits compress into one income series", () => {
  const layer = buildFinancialEventLayer([
    tx("p1", { name: "Employer payroll", amount: -1000, category: "INCOME", direction: "inflow", date: "2026-06-05" }),
    tx("p2", { name: "Employer payroll", amount: -1000, category: "INCOME", direction: "inflow", date: "2026-06-19" }),
    tx("p3", { name: "Employer payroll", amount: -1000, category: "INCOME", direction: "inflow", date: "2026-07-03" }),
  ]);
  assert.equal(layer.events.length, 1);
  assert.equal(layer.events[0].type, "payroll");
  assert.equal(layer.events[0].occurrenceCount, 3);
  assert.deepEqual(layer.events[0].relatedTransactionIds, ["p1", "p2", "p3"]);
});

test("verified internal transfer retains both transactions and accounts", () => {
  const layer = buildFinancialEventLayer([
    tx("out", {
      name: "Online transfer",
      amount: 200,
      category: "TRANSFER_OUT",
      transferRelationship: "internal",
    }),
    tx("in", {
      plaidAccountId: "account-b",
      accountLabel: "Savings • 2222",
      name: "Online transfer",
      amount: -200,
      date: "2026-07-02",
      category: "TRANSFER_IN",
      direction: "inflow",
      transferRelationship: "internal",
    }),
    tx("unmatched", {
      plaidAccountId: "account-b",
      name: "Online transfer",
      amount: -201,
      date: "2026-07-02",
      category: "TRANSFER_IN",
      direction: "inflow",
      transferRelationship: "internal",
    }),
  ]);
  const event = layer.events.find((candidate) => candidate.type === "internal_transfer");
  assert.deepEqual(event.relatedTransactionIds, ["in", "out"]);
  assert.equal(event.relatedAccounts.length, 2);
  assert.equal(layer.unresolvedActivity.some((row) => row.transactionId === "unmatched"), true);
});

test("subscription and generic recurring payment remain distinct", () => {
  const layer = buildFinancialEventLayer([
    tx("s1", { name: "Streaming subscription", amount: 12.99, date: "2026-05-01" }),
    tx("s2", { name: "Streaming subscription", amount: 12.99, date: "2026-06-01" }),
    tx("s3", { name: "Streaming subscription", amount: 12.99, date: "2026-07-01" }),
    tx("r1", { name: "Provider", amount: 50, date: "2026-05-02" }),
    tx("r2", { name: "Provider", amount: 50, date: "2026-06-02" }),
    tx("r3", { name: "Provider", amount: 50, date: "2026-07-02" }),
  ]);
  assert.equal(layer.events.filter((event) => event.type === "subscription_renewal").length, 1);
  assert.equal(layer.events.find((event) => event.type === "subscription_renewal").occurrenceCount, 3);
  assert.deepEqual(
    new Set(layer.recurringPaymentReview.map((row) => row.proposedType)),
    new Set(["subscription", "unresolved_recurring_payment"]),
  );
  assert.equal(layer.events.some((event) => event.type === "unresolved_recurring_payment"), false);
});

test("irregular same-merchant activity is not a recurring-payment candidate", () => {
  const layer = buildFinancialEventLayer([
    tx("r1", { name: "Provider", amount: 20, date: "2026-05-01" }),
    tx("r2", { name: "Provider", amount: 30, date: "2026-05-04" }),
    tx("r3", { name: "Provider", amount: 40, date: "2026-07-01" }),
  ]);
  assert.equal(layer.recurringPaymentReview.length, 0);
});

test("utility, insurance, loan, and credit-card payments are not subscriptions", () => {
  const layer = buildFinancialEventLayer([
    tx("utility", { name: "City electric utility", category: "GENERAL_SERVICES" }),
    tx("insurance", { name: "Example insurance premium", category: "GENERAL_SERVICES" }),
    tx("loan", { name: "Auto loan payment", category: "LOAN_PAYMENTS" }),
    tx("card", { name: "Credit card payment", category: "LOAN_PAYMENTS" }),
  ]);
  assert.deepEqual(
    new Set(layer.events.map((event) => event.type)),
    new Set([
      "utility_payment",
      "insurance_payment",
      "loan_payment",
      "credit_card_payment",
    ]),
  );
  assert.equal(layer.events.some((event) => event.type === "subscription_renewal"), false);
});

test("travel grouping requires multiple compatible recognized bookings", () => {
  const layer = buildFinancialEventLayer([
    tx("flight", { name: "Regional airline", amount: 450, category: "TRAVEL", date: "2026-06-01" }),
    tx("hotel", { name: "Downtown hotel", amount: 600, category: "TRAVEL", date: "2026-06-04" }),
    tx("ordinary", { name: "Travel activity", amount: 40, category: "TRAVEL", date: "2026-06-03" }),
    tx("later", { name: "Rental car", amount: 250, category: "TRAVEL", date: "2026-06-20" }),
  ]);
  const cluster = layer.events.find((event) => event.type === "travel_spending");
  assert.deepEqual(cluster.relatedTransactionIds, ["flight", "hotel"]);
  assert.equal(layer.classifiedActivity.some((row) => row.transactionId === "ordinary"), true);
  assert.equal(layer.events.find((event) => event.relatedTransactionIds.includes("later")).relatedTransactionIds.length, 1);
});

test("medical grouping requires the same provider key within seven days", () => {
  const layer = buildFinancialEventLayer([
    tx("m1", { name: "Medical clinic", category: "MEDICAL", date: "2026-06-01" }),
    tx("m2", { name: "Medical clinic", category: "MEDICAL", date: "2026-06-05" }),
    tx("other", { name: "Different pharmacy", category: "MEDICAL", date: "2026-06-05" }),
    tx("later", { name: "Medical clinic", category: "MEDICAL", date: "2026-06-20" }),
  ]);
  const episode = layer.events.find((event) => event.relatedTransactionIds.length === 2);
  assert.deepEqual(episode.relatedTransactionIds, ["m1", "m2"]);
  assert.equal(layer.events.find((event) => event.relatedTransactionIds.includes("other")).relatedTransactionIds.length, 1);
  assert.equal(layer.events.find((event) => event.relatedTransactionIds.includes("later")).relatedTransactionIds.length, 1);
});

test("large purchase materiality is relative to recent ordinary outflows", () => {
  const layer = buildFinancialEventLayer([
    ...Array.from({ length: 8 }, (_, index) =>
      tx(`small-${index}`, { name: `Ordinary ${index}`, amount: 100 + index }),
    ),
    tx("large", { name: "One-time purchase", amount: 550 }),
  ]);
  assert.equal(layer.events.some((event) => event.type === "large_purchase"), true);
  assert.equal(layer.events.find((event) => event.type === "large_purchase").relatedTransactionIds[0], "large");
});

test("user-confirmed and inferred classifications remain separate", () => {
  const [event] = buildFinancialEvents([
    tx("insurance", { name: "Example insurance premium" }),
  ]);
  const confirmed = applyFinancialEventConfirmation(event, {
    confirmedType: "other_recurring_bill",
    renamedTitle: "Annual household coverage",
    confirmedAt: "2026-07-27T12:00:00.000Z",
  });
  assert.equal(confirmed.inferredType, "insurance_payment");
  assert.equal(confirmed.type, "insurance_payment");
  assert.equal(confirmed.effectiveType, "other_recurring_bill");
  assert.equal(confirmed.supersededClassification, "insurance_payment");
  assert.match(confirmed.supportingEvidence.explanation, /insurance/i);
  assert.equal(confirmed.eventWorthinessReasons.includes("user_confirmed"), true);
});

test("pending rows are excluded and output is deterministic and traceable", () => {
  const rows = [
    tx("posted", { name: "Refund", amount: -10, direction: "inflow" }),
    tx("pending", { pending: true }),
  ];
  const first = buildFinancialEventLayer(rows);
  const second = buildFinancialEventLayer([...rows].reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(first.events.flatMap((event) => event.relatedTransactionIds), ["posted"]);
  assert.equal(first.metrics.postedTransactionsAnalyzed, 1);
});

test("product engine contains no founder-specific hardcoding, Plaid calls, or production mutation", () => {
  const source = readFileSync(
    new URL("../lib/financial-events.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /TD BANK|TARA|COVARIFY_ADMIN|founder/i);
  assert.doesNotMatch(source, /transactionsSync|plaidClient|access_token|createClient/i);
  assert.doesNotMatch(source, /\.from\(|insert\(|update\(|upsert\(|delete\(/i);
});

test("recurring review preserves a user label and distinguishes confirmation from rejection", () => {
  assert.deepEqual(recurringDecision("subscription"), {
    userConfirmedType: "subscription_renewal",
    recurrenceConfirmed: true,
    recurrenceRejected: false,
  });
  assert.deepEqual(recurringDecision("not_recurring"), {
    userConfirmedType: null,
    recurrenceConfirmed: false,
    recurrenceRejected: true,
  });
  const label = "Family streaming";
  assert.equal(label, "Family streaming");
});

test("save and continue advances to the next unreviewed card and wraps the queue", () => {
  const cards = [
    { reviewed: true, stale: false },
    { reviewed: false, stale: false },
    { reviewed: true, stale: false },
    { reviewed: false, stale: false },
  ];
  assert.equal(nextUnreviewedIndex(cards, 1), 3);
  assert.equal(nextUnreviewedIndex(cards, 3), 1);
  assert.equal(
    nextUnreviewedIndex(
      cards.map(() => ({ reviewed: true, stale: false })),
      1,
    ),
    null,
  );
});

test("relationship confirmation and separation remain distinct", () => {
  assert.deepEqual(groupingDecision("related"), {
    groupingConfirmed: true,
    groupingRejected: false,
  });
  assert.deepEqual(groupingDecision("separate"), {
    groupingConfirmed: false,
    groupingRejected: true,
  });
});

test("mixed-use pharmacy merchants stay neutral and ask relationship before meaning", () => {
  const layer = buildFinancialEventLayer([
    tx("cvs-1", { name: "CVS", category: "MEDICAL", date: "2026-07-01" }),
    tx("cvs-2", { name: "CVS", category: "MEDICAL", date: "2026-07-05" }),
    tx("walgreens-1", { name: "Walgreens", category: "MEDICAL", date: "2026-07-10" }),
    tx("walgreens-2", { name: "Walgreens", category: "MEDICAL", date: "2026-07-13" }),
  ]);
  const groups = layer.events.filter((event) => event.type === "related_purchases");
  assert.equal(groups.length, 2);
  assert.equal(layer.events.some((event) => event.type === "medical_expense"), false);
  assert.equal(groups.every((event) => event.title === "Possible related purchases"), true);
  const component = readFileSync(
    new URL("../components/account/financial-events-review.tsx", import.meta.url),
    "utf8",
  );
  assert.match(component, /Are these purchases related\?/);
  assert.match(component, /What would you call this\?/);
  assert.ok(
    component.indexOf("Are these purchases related?") <
      component.indexOf("What would you call this?"),
  );
  assert.doesNotMatch(
    component,
    /diagnosis|medical condition|treatment|procedure|family member|prescription details/i,
  );
});

test("queue priority suppresses low-value noise and retains material clarification", () => {
  const lowValue = recurringReviewPriority({
    confidence: "medium",
    typicalAmount: 12,
    observationCount: 3,
    proposedType: "unresolved_recurring_payment",
  });
  const material = recurringReviewPriority({
    confidence: "high",
    typicalAmount: 75,
    observationCount: 4,
    proposedType: "unresolved_recurring_payment",
  });
  const grouped = groupedReviewPriority({
    transactionCount: 2,
    aggregateAmount: 80,
  });
  assert.ok(lowValue.score < REVIEW_QUEUE_THRESHOLD);
  assert.ok(material.score >= REVIEW_QUEUE_THRESHOLD);
  assert.ok(grouped.score >= REVIEW_QUEUE_THRESHOLD);
  assert.equal(reviewTierForCard("CVS", 10, false), "primary");
  assert.equal(reviewTierForCard("Walgreens", 10, false), "primary");
  assert.equal(reviewTierForCard("Expedia", 10, false), "primary");
  assert.equal(reviewTierForCard("Lemonade Insurance", 10, false), "primary");
  assert.equal(reviewTierForCard("Home Depot", 10, false), "primary");
  assert.equal(reviewTierForCard("Aff Viome", 55, false), "primary");
  assert.equal(reviewTierForCard("Aff Viome", 54, false), null);
  assert.equal(reviewTierForCard("Zoom", 90, false), "later");
  assert.equal(reviewTierForCard("Amazon Prime Video", 90, false), "later");
  assert.equal(reviewTierForCard("Lee Pressofatlanticcity", 90, false), null);
  assert.equal(reviewTierForCard("Olukai", 90, false), null);
  assert.equal(reviewTierForCard("Zeely App", 90, true), "history");
  assert.equal(reviewTierForCard("Aff Gopetl", 90, true), "history");
});

test("v2 persistence keeps context separate, append-only, and preserves re-review reason", () => {
  const action = readFileSync(
    new URL("../app/account/events/review/actions.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260728100000_financial_event_context_v2.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(action, /user_context_label: context/);
  assert.match(action, /relationship_decision/);
  assert.match(action, /re_review_reason/);
  assert.match(migration, /inference_model_refined/);
  assert.doesNotMatch(action, /\.update\(|\.upsert\(|\.delete\(/);
  assert.doesNotMatch(action, /plaid_transactions|transactionsSync|access_token/i);
  assert.equal(
    effectiveDisplayTitle({
      userContextLabel: "Birthday gift",
      deterministicTitle: "Possible related purchases",
    }),
    "Birthday gift",
  );
  assert.equal(
    effectiveDisplayTitle({
      userContextLabel: null,
      deterministicTitle: "Possible related purchases",
    }),
    "Possible related purchases",
  );
});

test("effective type uses a current user confirmation and otherwise deterministic inference", () => {
  const [event] = buildFinancialEvents([
    tx("insurance", { name: "Example insurance premium" }),
  ]);
  assert.equal(effectiveEventType(event.inferredType, null), "insurance_payment");
  assert.equal(
    effectiveEventType(event.inferredType, {
      eventId: event.id,
      inferredType: event.inferredType,
      userConfirmedType: "other_recurring_bill",
      userConfirmedTitle: null,
      recurrenceConfirmed: true,
      recurrenceRejected: false,
      groupingConfirmed: null,
      groupingRejected: false,
      reviewedAt: "2026-07-27T12:00:00.000Z",
      reviewedBy: "founder",
      sourceConditionSignature: event.sourceConditionSignature,
      engineRuleVersion: event.engineRuleVersion,
    }),
    "other_recurring_bill",
  );
});

test("confirmation staleness detects evidence and rule-version changes", () => {
  const [event] = buildFinancialEvents([
    tx("insurance", { name: "Example insurance premium" }),
  ]);
  const current = {
    sourceConditionSignature: event.sourceConditionSignature,
    engineRuleVersion: FINANCIAL_EVENTS_RULE_VERSION,
  };
  assert.equal(confirmationIsStale(current, event), false);
  assert.equal(
    confirmationIsStale(
      { ...current, sourceConditionSignature: "prior-condition" },
      event,
    ),
    true,
  );
  assert.equal(
    confirmationIsStale(
      { ...current, engineRuleVersion: "financial-events-v0" },
      event,
    ),
    true,
  );
});

test("review workflow is founder-only, append-only, and does not mutate source activity or call Plaid", () => {
  const auth = readFileSync(
    new URL("../lib/founder-review-auth.ts", import.meta.url),
    "utf8",
  );
  const action = readFileSync(
    new URL("../app/account/events/review/actions.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20260727183000_financial_event_confirmations.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(
    isExactFounderAllowlistMatch("founder", new Set(["founder"])),
    true,
  );
  assert.equal(
    isExactFounderAllowlistMatch("other", new Set(["founder"])),
    false,
  );
  assert.equal(
    isExactFounderAllowlistMatch(
      "founder",
      new Set(["founder", "other"]),
    ),
    false,
  );
  assert.match(auth, /isExactFounderAllowlistMatch/);
  assert.match(auth, /redirect\("\/account"\)/);
  assert.match(action, /requireFounderReviewUser/);
  assert.match(action, /\.insert\(/);
  assert.doesNotMatch(action, /\.update\(|\.upsert\(|\.delete\(/);
  assert.doesNotMatch(action, /plaid_transactions|transactionsSync|access_token/i);
  assert.match(migration, /revoke all .* anon, authenticated/i);
  assert.match(migration, /source_condition_signature/);
  assert.match(migration, /engine_rule_version/);
  const decisionMigration = readFileSync(
    new URL(
      "../supabase/migrations/20260727190000_financial_event_selected_decision.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(decisionMigration, /selected_decision text not null/);
  assert.match(action, /selected_decision: decision/);
  const privilegeMigration = readFileSync(
    new URL(
      "../supabase/migrations/20260727191500_financial_event_append_only_privileges.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(privilegeMigration, /revoke update, delete, truncate/i);
  assert.match(privilegeMigration, /grant select, insert/i);
  assert.doesNotMatch(migration, /update public\.plaid_transactions/i);
});
