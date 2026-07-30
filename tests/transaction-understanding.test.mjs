import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCategoryIntelligence } from "../lib/category-intelligence.ts";
import { isExactFounderAllowlistMatch } from "../lib/financial-event-confirmations.ts";
import { filterTransactions } from "../lib/money-picture.ts";
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
  buildConfirmedUnderstandingRecord,
  effectiveTransactionState,
  parseTransactionIntent,
  reconcilePendingUnderstanding,
  resolveTransactionIntent,
  sourceConditionSignature,
} from "../lib/transaction-understanding.ts";

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
  assert.equal(SYSTEM_CATEGORY_PARENTS.every((parent) => migration.includes(parent.id)), true);
});

test("production route and workspace enforce founder-only confirmation-before-append integration", () => {
  const route = readFileSync(new URL("../app/api/account/transaction-understanding/route.ts", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/account/authenticated-workspace.tsx", import.meta.url), "utf8");
  const activity = readFileSync(new URL("../components/account/recent-activity.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/account/transaction-understanding.tsx", import.meta.url), "utf8");
  const panelStyles = readFileSync(new URL("../components/account/transaction-understanding.module.css", import.meta.url), "utf8");
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
  assert.match(panel, /scrollIntoView/);
  assert.match(panel, /prefers-reduced-motion: reduce/);
  assert.match(panel, /reduceMotion \? "auto" : "smooth"/);
  assert.match(panel, /tabIndex=\{-1\}/);
  assert.match(panel, /The original bank category remains/);
  assert.match(panel, /merchantMemory\.scope/);
  assert.match(panelStyles, /@media\(max-width:700px\)/);
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
