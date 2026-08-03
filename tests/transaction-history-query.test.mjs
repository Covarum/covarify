import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ambiguousHistoryMerchantNames, answerTransactionHistoryQuery, normalizeHistoryMerchant, parseTransactionHistoryQuery } from "../lib/transaction-history-query.ts";
import { recurringContextProposal, GIFTS_CATEGORY } from "../lib/recurring-category-understanding.ts";

const period = { key: "this-month", label: "This month", start: "2026-08-01", end: "2026-08-03", priorStart: "2026-07-01", priorEnd: "2026-07-03", asOf: "2026-08-03", futureKind: "preset" };
const tx = (id, overrides = {}) => ({ id, plaidAccountId: "a", accountLabel: "TD Checking", merchantName: "OLU’KAI", name: "OLU’KAI", description: "OLUKAI", amount: 50, currency: "USD", date: "2026-08-02", pending: false, pendingTransactionId: null, category: "GENERAL_MERCHANDISE", sourceCategory: "GENERAL_MERCHANDISE", detailedCategory: null, direction: "outflow", transferRelationship: null, ...overrides });

test("aggregate merchant questions route independently and normalize OLU’KAI variants", () => {
  assert.equal(parseTransactionHistoryQuery("How many payments were made to OLU’KAI?")?.intentType, "transaction_count_query");
  assert.equal(parseTransactionHistoryQuery("How much did I spend at Amazon last quarter?")?.intentType, "transaction_total_query");
  assert.equal(parseTransactionHistoryQuery("Show me my OLU'KAI purchases.")?.intentType, "transaction_list_query");
  assert.equal(parseTransactionHistoryQuery("Show me my OLU'KAI purchases.")?.merchant, "OLU'KAI");
  assert.equal(parseTransactionHistoryQuery("How many Starbucks charges are there?")?.merchant, "Starbucks");
  const july = parseTransactionHistoryQuery("Show all Walmart transactions from July.", new Date("2026-08-03T12:00:00Z"));
  assert.equal(july?.merchant, "Walmart");
  assert.deepEqual(july?.customPeriod, { label: "July 2026", start: "2026-07-01", end: "2026-07-31" });
  assert.equal(normalizeHistoryMerchant("OLU’KAI"), normalizeHistoryMerchant("OluKai"));
});

test("distinct branded merchant variants require clarification rather than broad matching", () => {
  assert.deepEqual(ambiguousHistoryMerchantNames("OLU’KAI", [tx("one"), tx("two", { merchantName: "OLU'KAI Outlet", name: "OLU'KAI Outlet" })]), ["OLU’KAI", "OLU'KAI Outlet"]);
});

test("history answer uses active period, deduplicates pending, and separates refunds", () => {
  const query = parseTransactionHistoryQuery("How many payments were made to OLU’KAI?");
  const answer = answerTransactionHistoryQuery({ query, activePeriod: period, transactions: [tx("pending", { pending: true }), tx("posted", { pendingTransactionId: "pending" }), tx("refund", { amount: -10, direction: "inflow" }), tx("old", { date: "2026-07-02" }), tx("transfer", { sourceCategory: "TRANSFER_OUT", category: "TRANSFER_OUT", transferRelationship: "external" })] });
  assert.equal(answer.purchases.length, 1);
  assert.equal(answer.refunds.length, 1);
  assert.equal(answer.hasEarlierActivity, true);
});

test("specified period overrides active period", () => {
  const query = parseTransactionHistoryQuery("How many times did I pay OLU’KAI last quarter?");
  const answer = answerTransactionHistoryQuery({ query, activePeriod: period, now: new Date("2026-08-03T12:00:00Z"), transactions: [tx("july", { date: "2026-07-02" }), tx("may", { date: "2026-05-02" })] });
  assert.equal(answer.period.key, "last-quarter");
  assert.deepEqual(answer.purchases.map((row) => row.id), ["may"]);
});

const commitment = (note, decision = {}) => ({ displayName: "Purchase", decision: { userNote: note, contextComplete: false, contextRelationship: null, businessUse: null, effectiveParentCategory: null, supportingTransactionsClassified: false, ...decision } });
test("birthday gift context identifies a person and proposes Shopping → Gifts", () => {
  const proposal = recurringContextProposal(commitment("Birthday gift for Caleb"));
  assert.equal(proposal.contextType, "person");
  assert.equal(proposal.namedEntity, "Caleb");
  assert.equal(proposal.purpose, "Birthday gift");
  assert.equal(proposal.nextQuestion, "person_relationship");
  assert.deepEqual(proposal.proposedCategory, GIFTS_CATEGORY);
});

test("business and project signals remain distinct", () => {
  assert.equal(recurringContextProposal({ ...commitment("my calendar booking app for Covarum"), displayName: "Calendly" }).contextType, "business");
  assert.equal(recurringContextProposal(commitment("for a personal project")).contextType, "project");
  assert.equal(recurringContextProposal(commitment("Callie’s shoes")).contextType, "person");
});

test("history results preserve exact supporting IDs and owner-scoped route boundaries", () => {
  const route = readFileSync(new URL("../app/api/account/transaction-understanding/route.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/account/transaction-understanding.tsx", import.meta.url), "utf8");
  const activity = readFileSync(new URL("../components/account/recent-activity.tsx", import.meta.url), "utf8");
  assert.match(route, /getAuthorizedFounderUser/);
  assert.match(route, /transactionIds: answer\.purchases\.map/);
  assert.match(panel, /covarify:category-filter/);
  assert.match(activity, /transactionIds: detail\.transactionIds/);
  assert.doesNotMatch(panel, /transaction_count_query|normalized match|parsed merchant/);
});

test("person relationship migration expands only the existing append-only context vocabulary", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260803120000_recurring_person_relationships.sql", import.meta.url), "utf8");
  assert.match(migration, /alter table public\.recurring_commitment_decisions/);
  assert.match(migration, /'child','partner','household_member','friend_family','someone_else'/);
  assert.doesNotMatch(migration, /\b(update|delete|truncate|drop table|disable row level security|grant)\b/i);
});
