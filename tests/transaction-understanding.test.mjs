import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCategoryIntelligence } from "../lib/category-intelligence.ts";
import { isExactFounderAllowlistMatch } from "../lib/financial-event-confirmations.ts";
import {
  filterTransactions,
  formatCategoryLabel,
  formatCategoryPath,
  formatTransactionCategoryPath,
} from "../lib/money-picture.ts";
import {
  normalizeCategoryName,
  parentForSourceCategory,
  requestedSubcategoryFromText,
  suggestSubcategories,
  SYSTEM_CATEGORY_PARENTS,
} from "../lib/category-hierarchy.ts";
import {
  applySavedClassificationToTransaction,
  applyEffectiveCategories,
  buildMerchantRuleAssignmentRecords,
  buildConfirmedUnderstandingRecord,
  checkMerchantCategoryRule,
  classifyTransactionUnderstandingIntent,
  effectiveTransactionState,
  exactMerchantTransactions,
  merchantBreadthForName,
  parseTransactionIntent,
  reconcilePendingUnderstanding,
  restoreTransactionCategoryView,
  resolveTransactionIntent,
  sourceConditionSignature,
} from "../lib/transaction-understanding.ts";
import {
  housingObligationType,
  recurringObligationInput,
  summarizeObligationPayments,
} from "../lib/recurring-obligations.ts";

const tx = (id, overrides = {}) => ({
  id,
  plaidAccountId: "checking",
  accountLabel: "TD Beyond Checking • 9214",
  name: "Walmart",
  amount: 148.72,
  currency: "USD",
  date: "2026-07-24",
  pending: false,
  pendingTransactionId: null,
  category: "GENERAL_MERCHANDISE",
  detailedCategory: "GENERAL_MERCHANDISE_SUPERSTORES",
  direction: "outflow",
  transferRelationship: null,
  ...overrides,
});

const now = new Date("2026-07-28T12:00:00Z");
const foodParent = parentForSourceCategory("FOOD_AND_DRINK");
const foodSubcategories = [
  { id: "liquor", userId: null, parentCategoryId: foodParent.id, displayName: "Liquor", normalizedName: "liquor", aliases: ["alcohol", "wine and spirits"], categoryType: "system", status: "active" },
  { id: "bars", userId: null, parentCategoryId: foodParent.id, displayName: "Bars", normalizedName: "bars", aliases: ["pub"], categoryType: "system", status: "active" },
  { id: "restaurants", userId: null, parentCategoryId: foodParent.id, displayName: "Restaurants", normalizedName: "restaurants", aliases: ["dining"], categoryType: "system", status: "active" },
  { id: "fast-food", userId: null, parentCategoryId: foodParent.id, displayName: "Fast Food", normalizedName: "fast food", aliases: [], categoryType: "system", status: "active" },
];

test("Alcohol is treated as subcategory intent and suggests Liquor without replacing Food & Drink", () => {
  const intent = parseTransactionIntent("Alcohol", { selectedTransactionId: "white-horse", now });
  const suggestions = suggestSubcategories(intent.requestedSubcategory, foodParent.id, foodSubcategories);
  assert.equal(intent.requestedSubcategory, "Alcohol");
  assert.equal(foodParent.displayName, "Food & Drink");
  assert.deepEqual(suggestions.map(({ category }) => category.displayName), ["Liquor"]);
});

test("subcategory matching handles exact normalization and aliases but preserves distinct concepts", () => {
  assert.equal(normalizeCategoryName("Wine & Spirits"), "wine and spirit");
  assert.equal(suggestSubcategories("Wine & Spirits", foodParent.id, foodSubcategories)[0].category.displayName, "Liquor");
  assert.equal(suggestSubcategories("Dining", foodParent.id, foodSubcategories)[0].category.displayName, "Restaurants");
  assert.equal(suggestSubcategories("Liquors", foodParent.id, foodSubcategories)[0].match, "exact");
  assert.deepEqual(suggestSubcategories("Bars", foodParent.id, [foodSubcategories[0]]), []);
  assert.deepEqual(suggestSubcategories("Restaurants", foodParent.id, [foodSubcategories[3]]), []);
});

test("subcategory text extraction supports selected and conversational requests", () => {
  assert.equal(requestedSubcategoryFromText("Alcohol"), "Alcohol");
  assert.equal(requestedSubcategoryFromText("Classify it more specifically as Alcohol."), "Alcohol");
  assert.equal(requestedSubcategoryFromText("That was dining."), "dining");
  assert.equal(requestedSubcategoryFromText("Always rent."), "rent");
  assert.equal(requestedSubcategoryFromText("Rent from now on."), "Rent");
});

test("Rent and Mortgage resolve as Housing details rather than literal Shopping children", () => {
  const housing = SYSTEM_CATEGORY_PARENTS.find((parent) => parent.displayName === "Housing");
  const categories = [
    { id: "rent", userId: null, parentCategoryId: housing.id, displayName: "Rent", normalizedName: "rent", aliases: ["lease"], categoryType: "system", status: "active" },
    { id: "mortgage", userId: null, parentCategoryId: housing.id, displayName: "Mortgage", normalizedName: "mortgage", aliases: ["home loan"], categoryType: "system", status: "active" },
  ];
  assert.equal(parseTransactionIntent("That was rent.", { selectedTransactionId: "payment" }).category, "Rent");
  assert.equal(suggestSubcategories("Rent", housing.id, categories)[0].category.displayName, "Rent");
  assert.equal(suggestSubcategories("home loan", housing.id, categories)[0].category.displayName, "Mortgage");
  assert.equal(housingObligationType("Housing", "Rent"), "rent");
  assert.equal(housingObligationType("Shopping", "Rent"), null);
});

test("recurring obligation input never infers the expected amount from the payment", () => {
  const input = recurringObligationInput({
    userId: "founder",
    transactionId: "payment",
    payee: "The Heights Manage",
    type: "rent",
    actualPaymentAmount: 1700,
    paymentDate: "2026-07-29",
    ongoingStatus: "ongoing",
    paymentType: "partial",
  });
  assert.equal(input.expectedAmount, null);
  assert.equal(input.remainingDue, null);
  assert.equal(input.normalizedPayee, "HEIGHTS MANAGE");
  assert.deepEqual(
    summarizeObligationPayments(2200, [
      { actualPaymentAmount: 1700, remainingDue: 500 },
    ]),
    { expectedAmount: 2200, actualPayments: 1700, remainingDue: 500 },
  );
});

test("housing obligation migration is owner-scoped, append-only, and transaction-linked", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260730170000_housing_obligations.sql", import.meta.url), "utf8");
  assert.match(migration, /'Housing'[\s\S]*'Rent'|000000000008'[\s\S]*'Rent'/);
  assert.match(migration, /recurring_obligation_versions_append_only/);
  assert.match(migration, /obligation_payment_records_append_only/);
  assert.match(migration, /validate_obligation_payment_owner/);
  assert.match(migration, /record_housing_obligation/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/);
});

test("housing obligation history is user-scoped, self-safe, and has one canonical successor", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260730170000_housing_obligations.sql", import.meta.url), "utf8");
  assert.match(migration, /foreign key \(user_id, supersedes_version_id\)[\s\S]*references public\.recurring_obligation_versions\(user_id, id\)/);
  assert.match(migration, /foreign key \(user_id, supersedes_record_id\)[\s\S]*references public\.obligation_payment_records\(user_id, id\)/);
  assert.match(migration, /unique \(user_id, id\)[\s\S]*supersedes_version_id is null or supersedes_version_id <> id/);
  assert.match(migration, /unique \(user_id, id\)[\s\S]*supersedes_record_id is null or supersedes_record_id <> id/);
  assert.match(migration, /recurring_obligation_versions_one_root_idx/);
  assert.match(migration, /recurring_obligation_versions_one_successor_idx/);
  assert.match(migration, /obligation_payment_records_one_root_idx/);
  assert.match(migration, /obligation_payment_records_one_successor_idx/);
  assert.match(migration, /prior\.obligation_key = new\.obligation_key/);
  assert.match(migration, /prior\.plaid_transaction_id = new\.plaid_transaction_id/);
});

test("housing obligation writes serialize before re-reading canonical append-only state", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260730170000_housing_obligations.sql", import.meta.url), "utf8");
  const recordFunction = migration.slice(
    migration.indexOf("create function public.record_housing_obligation"),
    migration.indexOf("revoke all on function public.record_housing_obligation"),
  );
  const unlinkFunction = migration.slice(
    migration.indexOf("create function public.unlink_housing_obligation"),
    migration.indexOf("revoke all on function public.unlink_housing_obligation"),
  );
  for (const sql of [recordFunction, unlinkFunction]) {
    assert.ok(sql.indexOf("pg_advisory_xact_lock") < sql.indexOf("from public.obligation_payment_records"));
    assert.match(sql, /not exists \([\s\S]*successor\.supersedes_record_id = payment\.id/);
  }
  assert.match(migration, /returns jsonb[\s\S]*'obligationVersionId'[\s\S]*'paymentRecordId'[\s\S]*'linkStatus'/);
});

test("Housing seeds are replay-safe and reject conflicting canonical category state", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260730170000_housing_obligations.sql", import.meta.url), "utf8");
  const seed = migration.slice(0, migration.indexOf("create table public.recurring_obligation_versions"));
  assert.match(seed, /normalized_name = v_seed\.normalized_name/);
  assert.match(seed, /parent_category_id = v_housing_id/);
  assert.match(seed, /continue;/);
  assert.match(seed, /canonical % category exists in a conflicting state/);
  assert.doesNotMatch(seed, /on conflict \(id\) do nothing/);
});

test("housing obligation loaders choose unsuperseded payment state and retry write conflicts truthfully", () => {
  const server = readFileSync(new URL("../lib/transaction-understanding-server.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/account/transaction-understanding/route.ts", import.meta.url), "utf8");
  assert.match(server, /supersededPaymentIds/);
  assert.match(server, /if \(supersededPaymentIds\.has\(String\(payment\.id\)\)\) continue/);
  assert.match(route, /OBLIGATION_CONFLICT_RETRY/);
  assert.match(route, /retryable: true/);
  assert.match(route, /obligationVersionId: data\.obligationVersionId/);
  assert.match(route, /paymentRecordId: data\.paymentRecordId/);
});

test("recurring merchant language routes deterministically without transaction lookup selectors", () => {
  const intent = parseTransactionIntent("Walmart is always for groceries", { now });
  assert.equal(intent.intentType, "merchant_rule");
  assert.equal(intent.scopeSignal, "recurring");
  assert.equal(intent.merchant, "Walmart");
  assert.equal(intent.category, "Groceries");
  assert.equal(intent.requestedSubcategory, "Groceries");
  assert.equal(intent.amount, null);
  assert.equal(intent.approximateDate, null);
  const coffee = parseTransactionIntent("Always categorize Starbucks as coffee.", { now });
  const rideshare = parseTransactionIntent("Future Uber purchases should be rideshare.", { now });
  const liquor = parseTransactionIntent("Make every Tomars Discount Liquor purchase liquor.", { now });
  assert.equal(coffee.intentType, "merchant_rule");
  assert.equal(coffee.merchant, "Starbucks");
  assert.equal(coffee.requestedSubcategory, "coffee");
  assert.equal(rideshare.intentType, "merchant_rule");
  assert.equal(rideshare.merchant, "Uber");
  assert.equal(rideshare.requestedSubcategory, "rideshare");
  assert.equal(liquor.merchant, "Tomars Discount Liquor");
  assert.equal(liquor.requestedSubcategory, "liquor");
  assert.equal(classifyTransactionUnderstandingIntent("Walmart was groceries.").intentType, "ambiguous_transaction_request");
  assert.equal(classifyTransactionUnderstandingIntent("Amazon is shopping.").intentType, "category_instruction");
  assert.equal(parseTransactionIntent("Treat my Walmart purchase yesterday as groceries.", { now }).intentType, "specific_transaction");
});

test("merchant breadth and discovery fail closed to normalized exact merchant matches", () => {
  assert.equal(merchantBreadthForName("Walmart"), "broad");
  assert.equal(merchantBreadthForName("White Horse Wine"), "narrow");
  assert.equal(merchantBreadthForName("Tomars Market"), "unknown");
  const matches = exactMerchantTransactions("Walmart", [
    tx("merchant", { name: "Walmart" }),
    tx("payroll", { name: "Walmart payroll reimbursement" }),
    tx("transfer", { name: "Transfer from Walmart" }),
    tx("other", { name: "Walmart Supercenter" }),
  ]);
  assert.deepEqual(matches.map((transaction) => transaction.id), ["merchant"]);
});

test("merchant rule checks detect identical, conflicting, and archived rules without duplicates", () => {
  const base = {
    id: "rule",
    normalizedMerchantName: "WALMART",
    parentCategoryId: foodParent.id,
    parentCategoryName: "Food & Drink",
    subcategoryId: "groceries",
    subcategoryName: "Groceries",
    ruleScope: "future",
    status: "active",
    createdAt: now.toISOString(),
  };
  assert.equal(checkMerchantCategoryRule([base], "Walmart", foodParent.id, "groceries").kind, "identical");
  assert.equal(checkMerchantCategoryRule([base], "Walmart", foodParent.id, "liquor").kind, "conflict");
  assert.equal(checkMerchantCategoryRule([{ ...base, status: "archived" }], "Walmart", foodParent.id, "groceries").kind, "archived");
  assert.equal(checkMerchantCategoryRule([base], "Target", foodParent.id, "groceries").kind, "none");
});

test("exact normalized merchant and amount produce one high-confidence match that still requires confirmation", () => {
  const intent = parseTransactionIntent("That Walmart charge for $148.72 was groceries.", { now });
  const result = resolveTransactionIntent(intent, [tx("target"), tx("other", { amount: 74.18 })]);
  assert.equal(result.kind, "clear");
  assert.equal(result.candidate.transaction.id, "target");
  assert.equal(result.candidate.confidence, "high");
  assert.equal(result.requiresConfirmation, true);
  assert.equal(intent.category, "Groceries");
});

test("merchant normalization is fuzzy but deterministic and amount mismatch fails closed", () => {
  const fuzzy = resolveTransactionIntent(
    parseTransactionIntent("That Walmart charge for $148.72 was groceries.", { now }),
    [tx("target", { name: "POS DEBIT WALMART SUPERCENTER" })],
  );
  assert.equal(fuzzy.kind, "clear");
  const mismatch = resolveTransactionIntent(
    parseTransactionIntent("That Walmart charge for $149.72 was groceries.", { now }),
    [tx("target")],
  );
  assert.equal(mismatch.kind, "no_match");
});

test("merchant-only references are ambiguous and do not expose internal identifiers", () => {
  const result = resolveTransactionIntent(
    parseTransactionIntent("That Walmart charge was groceries.", { now }),
    [tx("one"), tx("two", { name: "Walmart Supercenter", amount: 74.18, date: "2026-07-22" })],
  );
  assert.equal(result.kind, "ambiguous");
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.candidates.map(({ transaction }) => transaction.date), ["2026-07-24", "2026-07-22"]);
});

test("relative date handling resolves yesterday and selected context needs no merchant restatement", () => {
  const cvs = tx("cvs", { name: "CVS Pharmacy", amount: 41.26, date: "2026-07-27" });
  const relative = resolveTransactionIntent(parseTransactionIntent("The CVS purchase yesterday was personal care.", { now }), [cvs]);
  assert.equal(relative.kind, "clear");
  assert.equal(parseTransactionIntent("The CVS purchase yesterday was personal care.", { now }).approximateDate, "2026-07-27");
  const selected = resolveTransactionIntent(parseTransactionIntent("That was groceries.", { selectedTransactionId: "cvs", modality: "selected_transaction", now }), [cvs]);
  assert.equal(selected.kind, "clear");
  assert.deepEqual(selected.candidate.evidence, ["selected transaction context"]);
});

test("typed and voice-ready transcriptions produce the same constrained intent", () => {
  const typed = parseTransactionIntent("That Walmart charge for $148.72 was groceries.", { modality: "typed", now });
  const spoken = parseTransactionIntent("That Walmart charge for $148.72 was groceries.", { modality: "spoken", now });
  assert.deepEqual({ ...typed, modality: null }, { ...spoken, modality: null });
});

test("split reconciliation, treatment, context, notes, and receipt intent are structured", () => {
  const equal = parseTransactionIntent("Split the $200 at Home Depot equally between business and personal.", { now });
  assert.equal(equal.treatment, "split");
  assert.deepEqual(equal.split, [{ treatment: "business", percentage: 50 }, { treatment: "personal", percentage: 50 }]);
  const context = parseTransactionIntent("The $102.38 at Dick's was softball equipment for my child. Add a note that I need the receipt for taxes.", { now });
  assert.equal(context.contextLabel, "For my child");
  assert.equal(context.receiptNeeded, true);
  assert.match(context.note, /receipt/i);
});

test("non-reconciling splits and weak matches fail closed", () => {
  const intent = parseTransactionIntent("Split the $200 at Home Depot 60% business and 30% personal.", { now });
  assert.equal(resolveTransactionIntent(intent, [tx("home", { name: "Home Depot", amount: 200 })]).kind, "no_match");
  const prior = effectiveTransactionState(tx("target"), null, []);
  assert.throws(() => buildConfirmedUnderstandingRecord({
    id: "bad", userId: "founder", confirmedBy: "founder", transaction: tx("target"), intent,
    priorState: prior, confirmedAt: now.toISOString(), matchConfidence: "medium",
  }), /SPLIT_DOES_NOT_RECONCILE/);
});

test("source truth is preserved while current user confirmation takes effective-category precedence", () => {
  const source = tx("target");
  const original = structuredClone(source);
  const intent = parseTransactionIntent("That Walmart charge for $148.72 was groceries.", { selectedTransactionId: source.id, now });
  const prior = effectiveTransactionState(source, "Retail", []);
  const record = buildConfirmedUnderstandingRecord({
    id: "record-1", userId: "founder", confirmedBy: "founder", transaction: source,
    intent, priorState: prior, confirmedAt: now.toISOString(), matchConfidence: "high",
  });
  const effective = effectiveTransactionState(source, "Retail", [record]);
  assert.equal(effective.effectiveCategory, "Groceries");
  assert.equal(effective.categorySource, "user_confirmed");
  assert.deepEqual(source, original);
  assert.equal(record.sourceConditionSignature, sourceConditionSignature(source));
});

test("effective parent and subcategory are stored separately while source evidence remains unchanged", () => {
  const source = tx("white-horse", { name: "White Horse Wine", amount: 176.43, date: "2026-07-29", category: "FOOD_AND_DRINK" });
  const original = structuredClone(source);
  const intent = parseTransactionIntent("Alcohol", { selectedTransactionId: source.id, now });
  const record = buildConfirmedUnderstandingRecord({
    id: "hierarchy-record", userId: "founder", confirmedBy: "founder", transaction: source, intent,
    priorState: effectiveTransactionState(source, null, []), confirmedAt: now.toISOString(), matchConfidence: "high",
    categoryAssignment: {
      parentCategoryId: foodParent.id,
      parentCategory: "Food & Drink",
      subcategoryId: "liquor",
      subcategory: "Liquor",
      requestedSubcategory: "Alcohol",
    },
  });
  const effective = effectiveTransactionState(source, null, [record]);
  assert.equal(effective.sourceCategory, "FOOD_AND_DRINK");
  assert.equal(effective.effectiveParentCategory, "Food & Drink");
  assert.equal(effective.effectiveSubcategory, "Liquor");
  assert.equal(record.requestedSubcategoryName, "Alcohol");
  assert.deepEqual(source, original);
});

test("saved classification immediately updates the open transaction view without changing source evidence", () => {
  const original = tx("white-horse", {
    name: "White Horse Wine",
    category: "FOOD_AND_DRINK",
    sourceCategory: "FOOD_AND_DRINK",
    effectiveParentCategory: "Food & Drink",
    effectiveSubcategory: null,
    userConfirmedMeaning: null,
  });
  const updated = applySavedClassificationToTransaction(original, {
    transactionId: original.id,
    sourceCategory: "FOOD_AND_DRINK",
    effectiveParentCategory: "Food & Drink",
    effectiveSubcategory: "Liquor",
    assignmentSource: "user_transaction",
    merchantRuleId: null,
  });
  assert.equal(original.effectiveSubcategory, null);
  assert.equal(updated.sourceCategory, "FOOD_AND_DRINK");
  assert.equal(updated.effectiveParentCategory, "Food & Drink");
  assert.equal(updated.effectiveSubcategory, "Liquor");
  assert.equal(updated.userConfirmedMeaning?.parentCategory, "Food & Drink");
  assert.equal(updated.userConfirmedMeaning?.subcategory, "Liquor");
  assert.equal(`${updated.effectiveParentCategory} → ${updated.effectiveSubcategory}`, "Food & Drink → Liquor");
});

test("saved classification mapper ignores a response for a different open transaction", () => {
  const original = tx("still-open", { effectiveSubcategory: null });
  const unchanged = applySavedClassificationToTransaction(original, {
    transactionId: "different",
    sourceCategory: "FOOD_AND_DRINK",
    effectiveParentCategory: "Food & Drink",
    effectiveSubcategory: "Liquor",
    assignmentSource: "user_transaction",
    merchantRuleId: null,
  });
  assert.equal(unchanged, original);
  assert.equal(unchanged.effectiveSubcategory, null);
});

test("shared category formatter prioritizes effective paths and humanizes source fallbacks", () => {
  const classified = tx("classified", {
    category: "FOOD_AND_DRINK",
    sourceCategory: "FOOD_AND_DRINK",
    effectiveParentCategory: "Food & Drink",
    effectiveSubcategory: "Liquor",
  });
  assert.equal(formatTransactionCategoryPath(classified), "Food & Drink → Liquor");
  assert.equal(formatCategoryPath({ parentCategory: "Food & Drink" }), "Food & Drink");
  assert.equal(formatCategoryPath({ sourceCategory: "FOOD_AND_DRINK" }), "Food & Drink");
  assert.equal(formatCategoryLabel("FOOD_AND_DRINK"), "Food & Drink");
  assert.equal(formatCategoryPath({}), "Uncategorized");
  assert.doesNotMatch(formatTransactionCategoryPath(classified), /FOOD_AND_DRINK/);
});

test("successful Undo immediately restores the prior effective row classification", () => {
  const current = tx("white-horse", {
    category: "FOOD_AND_DRINK",
    sourceCategory: "FOOD_AND_DRINK",
    effectiveParentCategory: "Food & Drink",
    effectiveSubcategory: "Liquor",
    categorySource: "user_confirmed",
  });
  const restored = restoreTransactionCategoryView(current, current.id, {
    effectiveParentCategory: "Food & Drink",
    effectiveSubcategory: null,
    categorySource: "normalized_source",
    userConfirmedMeaning: null,
  });
  assert.equal(formatTransactionCategoryPath(restored), "Food & Drink");
  assert.equal(restored.effectiveSubcategory, null);
  assert.equal(restored.categorySource, "normalized_source");
  assert.equal(restoreTransactionCategoryView(current, "other", {}).effectiveSubcategory, "Liquor");
});

test("merchant rules assign both parent and subcategory using normalized exact merchant matching", () => {
  const source = tx("white-horse", { name: "POS DEBIT WHITE HORSE WINE", category: "FOOD_AND_DRINK" });
  const rules = [{
    id: "rule", normalizedMerchantName: "WHITE HORSE WINE", parentCategoryId: foodParent.id,
    parentCategoryName: "Food & Drink", subcategoryId: "liquor", subcategoryName: "Liquor",
    ruleScope: "past_and_future", status: "active", createdAt: "2026-07-29T00:00:00Z",
  }];
  const effective = effectiveTransactionState(source, null, [], rules);
  assert.equal(effective.effectiveParentCategory, "Food & Drink");
  assert.equal(effective.effectiveSubcategory, "Liquor");
  const unrelated = effectiveTransactionState(tx("other", { name: "White Horse Tavern", category: "FOOD_AND_DRINK" }), null, [], rules);
  assert.equal(unrelated.effectiveSubcategory, null);
});

test("past-and-future merchant rules append canonical historical assignments and remain idempotent", () => {
  const source = tx("walmart-history", {
    name: "Walmart",
    category: "GENERAL_MERCHANDISE",
    sourceCategory: "GENERAL_MERCHANDISE",
  });
  const legacyIntent = parseTransactionIntent("That was groceries.", {
    selectedTransactionId: source.id,
    now,
  });
  const legacy = buildConfirmedUnderstandingRecord({
    id: "legacy",
    userId: "founder",
    confirmedBy: "founder",
    transaction: source,
    intent: legacyIntent,
    priorState: effectiveTransactionState(source, null, []),
    confirmedAt: "2026-07-29T10:00:00Z",
    matchConfidence: "high",
  });
  const rule = {
    id: "walmart-rule",
    normalizedMerchantName: "WALMART",
    parentCategoryId: foodParent.id,
    parentCategoryName: "Food & Drink",
    subcategoryId: "groceries",
    subcategoryName: "Groceries",
    ruleScope: "past_and_future",
    status: "active",
    createdAt: "2026-07-30T10:00:00Z",
  };
  const intent = parseTransactionIntent("Walmart is always for groceries", { now });
  const records = buildMerchantRuleAssignmentRecords({
    userId: "founder",
    confirmedBy: "founder",
    rule,
    intent,
    transactions: [source, tx("other-user", { name: "Walmart" })],
    history: [legacy],
    confirmedAt: "2026-07-30T10:01:00Z",
    idForTransaction: (transaction) => `assignment-${transaction.id}`,
  }).filter((record) => record.userId === "founder" && record.transactionId === source.id);
  assert.equal(records.length, 1);
  assert.equal(records[0].confirmedParentCategoryId, foodParent.id);
  assert.equal(records[0].confirmedParentCategory, "Food & Drink");
  assert.equal(records[0].confirmedSubcategoryId, "groceries");
  assert.equal(records[0].confirmedSubcategory, "Groceries");
  assert.equal(records[0].assignmentSource, "merchant_rule");
  assert.equal(records[0].merchantRuleId, rule.id);
  assert.equal(records[0].supersedesRecordId, legacy.id);
  assert.equal(records[0].priorEffectiveState.effectiveParentCategory, "Shopping");
  assert.equal(records[0].priorEffectiveState.effectiveSubcategory, null);
  assert.equal(records[0].priorEffectiveState.sourceCategory, "GENERAL_MERCHANDISE");
  const repaired = effectiveTransactionState(source, null, [legacy, ...records], [rule]);
  assert.equal(repaired.effectiveParentCategory, "Food & Drink");
  assert.equal(repaired.effectiveSubcategory, "Groceries");
  assert.equal(repaired.sourceCategory, "GENERAL_MERCHANDISE");
  const undo = buildConfirmedUnderstandingRecord({
    id: "undo-repair",
    userId: "founder",
    confirmedBy: "founder",
    transaction: source,
    intent: { ...intent, action: "remove_label", category: null },
    priorState: repaired,
    supersedesRecordId: records[0].id,
    confirmedAt: "2026-07-30T10:01:30Z",
    matchConfidence: "high",
  });
  const undone = effectiveTransactionState(source, null, [legacy, ...records, undo], [rule]);
  assert.equal(undone.effectiveParentCategory, "Shopping");
  assert.equal(undone.effectiveSubcategory, null);
  assert.equal(undone.sourceCategory, "GENERAL_MERCHANDISE");
  assert.equal(buildMerchantRuleAssignmentRecords({
    userId: "founder",
    confirmedBy: "founder",
    rule,
    intent,
    transactions: [source],
    history: [legacy, ...records],
    confirmedAt: "2026-07-30T10:02:00Z",
    idForTransaction: () => "duplicate",
  }).length, 0);
});

test("future merchant-rule application uses the same canonical pair and analytics do not double count", () => {
  const source = tx("future-walmart", {
    name: "Walmart",
    amount: 100,
    date: "2026-07-31",
    category: "GENERAL_MERCHANDISE",
    sourceCategory: "GENERAL_MERCHANDISE",
  });
  const rule = {
    id: "future-rule",
    normalizedMerchantName: "WALMART",
    parentCategoryId: foodParent.id,
    parentCategoryName: "Food & Drink",
    subcategoryId: "groceries",
    subcategoryName: "Groceries",
    ruleScope: "future",
    status: "active",
    createdAt: "2026-07-30T10:00:00Z",
  };
  const effective = applyEffectiveCategories([source], new Map(), [], [rule]);
  assert.equal(formatTransactionCategoryPath(effective[0]), "Food & Drink → Groceries");
  assert.equal(effective[0].sourceCategory, "GENERAL_MERCHANDISE");
  const period = { key: "custom", label: "Preview", start: "2026-07-01", end: "2026-07-31", priorStart: "2026-06-01", priorEnd: "2026-06-30" };
  const intelligence = buildCategoryIntelligence(effective, [], period, []);
  const food = intelligence.categories.find((category) => category.categoryId === "FOOD_AND_DRINK");
  const shopping = intelligence.categories.find((category) => category.categoryId === "SHOPPING");
  assert.equal(food?.currentAmount, 100);
  assert.equal(shopping?.currentAmount || 0, 0);
  assert.equal(intelligence.categories.reduce((sum, category) => sum + category.currentAmount, 0), 100);
});

test("undo is append-only supersession and restores prior precedence", () => {
  const source = tx("target");
  const classifyIntent = parseTransactionIntent("That was groceries.", { selectedTransactionId: source.id, now });
  const first = buildConfirmedUnderstandingRecord({
    id: "one", userId: "founder", confirmedBy: "founder", transaction: source, intent: classifyIntent,
    priorState: effectiveTransactionState(source, null, []), confirmedAt: "2026-07-28T12:00:00Z", matchConfidence: "high",
  });
  const undoIntent = parseTransactionIntent("Remove my label.", { selectedTransactionId: source.id, now });
  const undo = buildConfirmedUnderstandingRecord({
    id: "two", userId: "founder", confirmedBy: "founder", transaction: source, intent: undoIntent,
    priorState: effectiveTransactionState(source, null, [first]), supersedesRecordId: first.id,
    confirmedAt: "2026-07-28T12:01:00Z", matchConfidence: "high",
  });
  assert.equal(effectiveTransactionState(source, null, [first, undo]).effectiveCategory, source.category);
  assert.equal([first, undo].length, 2);
});

test("pending-to-posted reconciliation carries meaning only with deterministic linkage", () => {
  const pending = tx("pending", { pending: true });
  const posted = tx("posted", { pendingTransactionId: "pending", pending: false });
  const intent = parseTransactionIntent("That was groceries.", { selectedTransactionId: pending.id, now });
  const record = buildConfirmedUnderstandingRecord({
    id: "one", userId: "founder", confirmedBy: "founder", transaction: pending, intent,
    priorState: effectiveTransactionState(pending, null, []), confirmedAt: now.toISOString(), matchConfidence: "high",
  });
  const reconciled = reconcilePendingUnderstanding(pending, posted, [record]);
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].transactionId, "posted");
  assert.equal(reconciled[0].supersedesRecordId, "one");
  assert.deepEqual(reconcilePendingUnderstanding(pending, tx("wrong", { amount: 999 }), [record]), []);
});

test("effective categories update Recent Activity filtering and Category Intelligence without source mutation", () => {
  const source = tx("target");
  const other = tx("other", { name: "Restaurant", amount: 50, category: "FOOD_AND_DRINK" });
  const intent = parseTransactionIntent("That was groceries.", { selectedTransactionId: source.id, now });
  const record = buildConfirmedUnderstandingRecord({
    id: "one", userId: "founder", confirmedBy: "founder", transaction: source, intent,
    priorState: effectiveTransactionState(source, null, []), confirmedAt: now.toISOString(), matchConfidence: "high",
  });
  const effectiveRows = applyEffectiveCategories([source, other], new Map(), [record]);
  assert.equal(filterTransactions(effectiveRows, { category: "GROCERIES" }).length, 1);
  const period = { key: "custom", label: "Preview", start: "2026-07-01", end: "2026-07-31", priorStart: "2026-06-01", priorEnd: "2026-06-30" };
  const intelligence = buildCategoryIntelligence(effectiveRows, [], period, []);
  assert.equal(intelligence.categories.some((category) => category.categoryId === "GROCERIES"), true);
  assert.equal(source.category, "GENERAL_MERCHANDISE");
});

test("founder authorization fails closed for missing or expanded allowlists", () => {
  assert.equal(isExactFounderAllowlistMatch("founder", new Set(["founder"])), true);
  assert.equal(isExactFounderAllowlistMatch("other", new Set(["founder"])), false);
  assert.equal(isExactFounderAllowlistMatch("founder", new Set()), false);
  assert.equal(isExactFounderAllowlistMatch("founder", new Set(["founder", "other"])), false);
});

test("preview and persistence remain founder-only, append-only, and free of Plaid calls or source mutation", () => {
  const previewPage = readFileSync(new URL("../app/account/transaction-understanding/preview/page.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../components/account/transaction-understanding-preview.tsx", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20260728133000_transaction_understanding_v1.sql", import.meta.url), "utf8");
  const source = readFileSync(new URL("../lib/transaction-understanding.ts", import.meta.url), "utf8");
  assert.match(previewPage, /requireFounderReviewUser/);
  assert.match(previewPage, /NODE_ENV === "development"/);
  assert.match(previewPage, /capture === "founder-preview"/);
  assert.match(component, /no production writes/i);
  assert.match(migration, /append-only structured user meaning/i);
  assert.match(migration, /grant select, insert/);
  assert.match(migration, /transaction_understanding_no_update/);
  assert.match(migration, /transaction_understanding_no_delete/);
  assert.match(migration, /transaction_understanding_owned_transaction_fk/);
  assert.match(migration, /transaction_understanding_supersession_fk/);
  assert.doesNotMatch(migration, /grant (?:update|delete)/i);
  assert.doesNotMatch(source, /plaidClient|\/api\/plaid|\.from\("plaid_transactions"\)|\.(?:update|delete|upsert)\(/);
});

test("category hierarchy migration seeds system parents and subcategories with scoped duplicate and ownership protections", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260730010000_transaction_category_hierarchy.sql", import.meta.url), "utf8");
  const recurringCategories = readFileSync(new URL("../supabase/migrations/20260731013000_recurring_commitment_categories.sql", import.meta.url), "utf8");
  assert.match(migration, /create table public\.category_parents/);
  assert.match(migration, /category_type text not null default 'system' check \(category_type = 'system'\)/);
  assert.match(migration, /create table public\.category_subcategories/);
  assert.match(migration, /'Liquor', 'liquor'.*alcohol/s);
  assert.match(migration, /reject_duplicate_subcategory/);
  assert.match(migration, /existing\.user_id is null or existing\.user_id = new\.user_id/);
  assert.match(migration, /user_id is null or user_id = auth\.uid\(\)/);
  assert.match(migration, /validate_merchant_category_rule/);
  assert.match(migration, /subcategory\.user_id is null or subcategory\.user_id = new\.user_id/);
  assert.match(migration, /subcategory\.parent_category_id = new\.parent_category_id/);
  assert.match(migration, /effective_parent_category_id/);
  assert.match(migration, /effective_subcategory_id/);
  assert.match(migration, /create table public\.merchant_category_rules/);
  assert.equal(SYSTEM_CATEGORY_PARENTS.every((parent) => `${migration}\n${recurringCategories}`.includes(parent.id)), true);
});

test("production route and workspace enforce founder-only confirmation-before-append integration", () => {
  const route = readFileSync(new URL("../app/api/account/transaction-understanding/route.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/account/authenticated-workspace.tsx", import.meta.url), "utf8");
  const activity = readFileSync(new URL("../components/account/recent-activity.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/account/transaction-understanding.tsx", import.meta.url), "utf8");
  const panelStyles = readFileSync(new URL("../components/account/transaction-understanding.module.css", import.meta.url), "utf8");
  const preview = readFileSync(new URL("../components/account/transaction-understanding-preview.tsx", import.meta.url), "utf8");
  const server = readFileSync(new URL("../lib/transaction-understanding-server.ts", import.meta.url), "utf8");
  const repair = readFileSync(new URL("../scripts/repair-merchant-rule-assignments.ts", import.meta.url), "utf8");
  const activityStyles = readFileSync(new URL("../components/account/money-picture.module.css", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  assert.match(route, /getAuthorizedFounderUser/);
  assert.match(route, /status: 404/);
  assert.match(route, /operation === "interpret"/);
  assert.match(route, /\.insert\(recordToInsert\(record\)\)/);
  assert.doesNotMatch(route, /\.(?:update|delete|upsert)\(/);
  assert.doesNotMatch(route, /plaidClient|\/api\/plaid/);
  assert.match(workspace, /transactionUnderstandingEnabled/);
  assert.match(activity, /covarify:understand-transaction/);
  assert.match(activity, /mp-transaction-trigger/);
  assert.match(panel, /Source category/);
  assert.match(panel, /Main category/);
  assert.match(panel, /Subcategory/);
  assert.match(panel, /selectedParentId/);
  assert.match(panel, /selectedSubcategoryId/);
  assert.match(panel, /Apply classification/);
  assert.match(panel, /Is \{result\.obligationPrompt\.payee\} your/);
  assert.match(panel, /Expected monthly amount \(optional\)/);
  assert.match(panel, /Partial payment/);
  assert.match(panel, /Unlink from housing obligation/);
  assert.match(panel, /Edit housing obligation/);
  assert.match(route, /record_housing_obligation/);
  assert.match(route, /unlink_housing_obligation/);
  assert.match(panel, /Use \{suggestion\.displayName\}/);
  assert.match(panel, /Create \{result\.requestedSubcategory\} instead/);
  assert.match(route, /DUPLICATE_SUBCATEGORY/);
  assert.match(route, /SUBCATEGORY_MATCH_REVIEW_REQUIRED/);
  assert.match(route, /SUBCATEGORY_NOT_AVAILABLE/);
  assert.doesNotMatch(route, /\.from\("category_parents"\)\.insert/);
  assert.match(panel, /router\.refresh/);
  assert.match(route, /savedClassification/);
  assert.match(route, /\.insert\(recordToInsert\(record\)\)[\s\S]*savedClassification/);
  assert.match(panel, /applySavedClassificationToTransaction/);
  assert.match(panel, /setSelected[\s\S]*setResult\(confirmed\)/);
  assert.match(panel, /resultRegion\.current/);
  assert.match(panel, /region\.focus\(\{ preventScroll: true \}\)/);
  assert.match(panel, /suggestionRegion\.current/);
  assert.match(panel, /scrollContainer\.scrollTo/);
  assert.doesNotMatch(panel, /window\.scrollTo/);
  assert.match(panel, /prefers-reduced-motion: reduce/);
  assert.match(panel, /reduceMotion \? "auto" : "smooth"/);
  assert.match(panel, /tabIndex=\{-1\}/);
  assert.match(panel, /role="status" aria-live="polite"/);
  assert.match(panel, /"Updated"/);
  assert.match(panel, /This transaction has been updated/);
  assert.match(panel, /window\.setTimeout\(close, 900\)/);
  assert.match(panel, /if \(!response\.ok\) throw new Error\(\);[\s\S]*savedClassification[\s\S]*window\.setTimeout\(close, 900\)/);
  assert.match(panel, /catch \{[\s\S]*setResult\(\{ kind: "no_match"[\s\S]*\} finally/);
  assert.match(panel, /setText\(""\)/);
  assert.match(panel, /setRuleScope\("transaction_only"\)/);
  assert.match(panel, /trigger\.current\?\.isConnected/);
  assert.match(panel, /formatCategoryLabel/);
  assert.match(panel, /formatCategoryPath/);
  assert.match(panel, /Understand this/);
  assert.doesNotMatch(panel, /Interpret safely/);
  assert.match(preview, /Understand this/);
  assert.doesNotMatch(preview, /Interpret safely/);
  assert.match(route, /intent\.intentType === "merchant_rule"/);
  assert.match(route, /exactMerchantTransactions/);
  assert.match(route, /confirm_merchant_rule/);
  assert.match(route, /MERCHANT_RULE_CONFLICT/);
  assert.match(route, /MERCHANT_RULE_ARCHIVED/);
  assert.match(route, /You already have this rule/);
  assert.match(panel, /Let me classify \{result\.merchant\} purchases individually/);
  assert.match(panel, /Walmart|household items, clothing, electronics/);
  assert.match(panel, /I don’t see \{result\.merchant\} in your connected activity yet/);
  assert.match(panel, /One transaction/);
  assert.match(panel, /Future \{result\.merchant\} purchases/);
  assert.match(server, /replaceOrReactivateMerchantCategoryRule/);
  assert.match(server, /\.eq\("user_id", input\.userId\)/);
  assert.match(route, /buildMerchantRuleAssignmentRecords/);
  assert.match(route, /historicalAssignmentsApplied/);
  assert.match(repair, /EXPECTED_MERCHANT = "WALMART"/);
  assert.match(repair, /EXPECTED_PARENT_ID = "10000000-0000-4000-8000-000000000001"/);
  assert.match(repair, /\.eq\("user_id", ruleRow\.user_id\)/);
  assert.match(repair, /ruleRow\.user_id !== allowedUsers\[0\]/);
  assert.match(repair, /process\.argv\.includes\("--apply"\)/);
  assert.match(repair, /if \(apply && rows\.length\)/);
  assert.doesNotMatch(repair, /\.(?:update|delete|upsert)\(/);
  assert.match(panel, /subcategoryDecision \? \{ \.\.\.subcategoryDecision, ruleScope \}/);
  assert.match(panelStyles, /@media\(max-width:700px\)/);
  assert.match(panelStyles, /\.suggestionResult/);
  assert.match(activity, /mp-classification-notice/);
  assert.match(activity, /updated to \$\{formatCategoryPath/);
  assert.match(activity, /operation: "undo"/);
  assert.match(activity, /applySavedClassificationToTransaction/);
  assert.match(activity, /formatTransactionCategoryPath\(transaction\)/);
  assert.doesNotMatch(activity, /displaySeparated\([\s\S]{0,300}transaction\.category,/);
  assert.match(activity, /setRows\(\(current\) => current\.map/);
  assert.match(activity, /restoreTransactionCategoryView/);
  assert.match(activity, /restored to \$\{formatCategoryPath/);
  assert.match(activity, /setClassificationNotice\(\{ detail, state: "error" \}\)/);
  assert.match(activity, /window\.setTimeout\(\(\) => setClassificationNotice\(null\), 10000\)/);
  assert.match(activityStyles, /\.mp-classification-notice/);
  assert.match(activityStyles, /@media\(max-width:480px\).*mp-classification-notice/s);
  assert.match(activityStyles, /overflow-wrap:anywhere/);
  assert.match(route, /createMerchantCategoryRule/);
  assert.match(page, /applyFounderTransactionUnderstanding/);
});

test("Financial Event source provenance stays separate from user context", () => {
  const source = tx("target");
  const eventEvidence = { relatedTransactionIds: [source.id], sourceAmount: source.amount, sourceDate: source.date, sourceCategory: source.category };
  const intent = parseTransactionIntent("That was groceries.", { selectedTransactionId: source.id, now });
  buildConfirmedUnderstandingRecord({
    id: "one", userId: "founder", confirmedBy: "founder", transaction: source, intent,
    priorState: effectiveTransactionState(source, null, []), confirmedAt: now.toISOString(), matchConfidence: "high",
  });
  assert.deepEqual(eventEvidence, { relatedTransactionIds: ["target"], sourceAmount: 148.72, sourceDate: "2026-07-24", sourceCategory: "GENERAL_MERCHANDISE" });
});
