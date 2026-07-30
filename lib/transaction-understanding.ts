import type { MoneyTransaction } from "./money-picture.ts";
import {
  categoryKeyForParent,
  normalizeMerchantName,
  parentForSourceCategory,
  requestedSubcategoryFromText,
  SYSTEM_CATEGORY_PARENTS,
} from "./category-hierarchy.ts";

export const TRANSACTION_UNDERSTANDING_RULE_VERSION =
  "transaction-understanding-v2-hierarchy-2026-07-30";

export const USER_TRANSACTION_CATEGORIES = [
  "Groceries",
  "Dining",
  "Personal care",
  "Medical",
  "Business expense",
  "Travel",
  "Transfer",
  "Refund",
  "Other",
] as const;

export type UserTransactionCategory =
  (typeof USER_TRANSACTION_CATEGORIES)[number];
export type TransactionTreatment = "personal" | "business" | "split" | "unsure";
export type InputModality = "typed" | "spoken" | "selected_transaction";
export type TransactionUnderstandingAction =
  | "classify"
  | "add_note"
  | "undo"
  | "remove_label";

export type TransactionIntent = {
  action: TransactionUnderstandingAction;
  merchant: string | null;
  amount: number | null;
  approximateDate: string | null;
  accountLabel: string | null;
  direction: "inflow" | "outflow" | null;
  category: UserTransactionCategory | null;
  requestedSubcategory: string | null;
  treatment: TransactionTreatment | null;
  split: Array<{ treatment: "personal" | "business"; percentage: number }> | null;
  contextLabel: string | null;
  note: string | null;
  reimbursable: boolean;
  receiptNeeded: boolean;
  modality: InputModality;
  selectedTransactionId: string | null;
};

export type TransactionCandidate = {
  transaction: MoneyTransaction;
  score: number;
  confidence: "high" | "medium" | "low";
  evidence: string[];
};

export type TransactionResolution =
  | { kind: "clear"; candidate: TransactionCandidate; requiresConfirmation: true }
  | { kind: "ambiguous"; candidates: TransactionCandidate[] }
  | { kind: "no_match"; similar: TransactionCandidate[] };

export type TransactionUnderstandingRecord = {
  id: string;
  userId: string;
  transactionId: string;
  sourceConditionSignature: string;
  parsedIntent: TransactionIntent;
  priorEffectiveState: TransactionEffectiveState;
  confirmedCategory: UserTransactionCategory | null;
  confirmedParentCategoryId: string | null;
  confirmedParentCategory: string | null;
  confirmedSubcategoryId: string | null;
  confirmedSubcategory: string | null;
  requestedSubcategoryName: string | null;
  assignmentSource: "user_transaction" | "merchant_rule" | null;
  merchantRuleId: string | null;
  treatment: TransactionTreatment | null;
  split: TransactionIntent["split"];
  contextLabel: string | null;
  note: string | null;
  reimbursable: boolean;
  receiptNeeded: boolean;
  confirmedAt: string;
  confirmedBy: string;
  supersedesRecordId: string | null;
  ruleVersion: string;
  inputModality: InputModality;
  matchConfidence: "high" | "medium";
};

export type TransactionEffectiveState = {
  sourceCategory: string;
  inferredCategory: string | null;
  effectiveCategory: string;
  effectiveParentCategoryId: string | null;
  effectiveParentCategory: string;
  effectiveSubcategoryId: string | null;
  effectiveSubcategory: string | null;
  categorySource: "user_confirmed" | "covarify_inference" | "normalized_source";
  treatment: TransactionTreatment | null;
  split: TransactionIntent["split"];
  contextLabel: string | null;
  note: string | null;
  reimbursable: boolean;
  receiptNeeded: boolean;
  activeRecordId: string | null;
};

const CATEGORY_PATTERNS: Array<[RegExp, UserTransactionCategory]> = [
  [/\bgrocer(?:y|ies)\b/i, "Groceries"],
  [/\b(dining|dinner|restaurant)\b/i, "Dining"],
  [/\bpersonal care\b/i, "Personal care"],
  [/\b(medical|health care)\b/i, "Medical"],
  [/\b(business expense|for (?:my )?(?:business|work))\b/i, "Business expense"],
  [/\b(travel|vacation)\b/i, "Travel"],
  [/\btransfer\b/i, "Transfer"],
  [/\b(refund|reimbursement)\b/i, "Refund"],
  [/\bother\b/i, "Other"],
];

const merchantFromText = (text: string) => {
  const atMatch = text.match(/\bat\s+([A-Za-z][A-Za-z0-9'&.\- ]+?)(?=\s+(?:was|for|on|yesterday|today|from)\b|[.!?,]|$)/i);
  if (atMatch) return atMatch[1].trim();
  const leading = text.match(/(?:that|the)\s+([A-Za-z][A-Za-z0-9'&.\- ]+?)\s+(?:charge|purchase|payment|transaction|transfer)\b/i);
  return leading?.[1]?.trim() || null;
};

const parseAmount = (text: string) => {
  const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
};

const parseDate = (text: string, now: Date) => {
  if (/\byesterday\b/i.test(text)) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    return date.toISOString().slice(0, 10);
  }
  if (/\btoday\b/i.test(text)) return now.toISOString().slice(0, 10);
  const match = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match?.[1] || null;
};

const parseSplit = (text: string): TransactionIntent["split"] => {
  if (!/\bsplit\b/i.test(text)) return null;
  if (/\b(equal|equally|half)\b/i.test(text)) {
    return [
      { treatment: "business", percentage: 50 },
      { treatment: "personal", percentage: 50 },
    ];
  }
  const business = text.match(/(\d+(?:\.\d+)?)%\s*business/i);
  const personal = text.match(/(\d+(?:\.\d+)?)%\s*personal/i);
  if (!business || !personal) return null;
  return [
    { treatment: "business", percentage: Number(business[1]) },
    { treatment: "personal", percentage: Number(personal[1]) },
  ];
};

export function parseTransactionIntent(
  text: string,
  options: {
    modality?: InputModality;
    selectedTransactionId?: string | null;
    now?: Date;
  } = {},
): TransactionIntent {
  const split = parseSplit(text);
  const category = CATEGORY_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] || null;
  const action: TransactionUnderstandingAction = /\b(undo|revert)\b/i.test(text)
    ? "undo"
    : /\b(remove|clear)\s+(?:my\s+)?(?:label|classification)\b/i.test(text)
      ? "remove_label"
      : /\b(add a note|note that|receipt|tax(?:es)?|reimbursable)\b/i.test(text) && !category
        ? "add_note"
        : "classify";
  const noteMatch = text.match(/(?:add a note that|note that)\s+(.+?)[.!]?$/i);
  const context = /\bfor my child\b/i.test(text)
    ? "For my child"
    : /\bfor (?:the )?household\b/i.test(text)
      ? "For household"
      : /\bfor (?:my )?(?:work|business)\b/i.test(text)
        ? "For work"
        : /\bfor (?:a )?vacation\b/i.test(text)
          ? "For vacation"
          : /\bfor (?:a )?goal\b/i.test(text)
            ? "For a goal"
            : null;
  const treatment: TransactionTreatment | null = split
    ? "split"
    : /\b(?:my )?(?:business|for work)\b/i.test(text)
      ? "business"
      : /\bpersonal\b/i.test(text)
        ? "personal"
        : /\bunsure\b/i.test(text)
          ? "unsure"
          : null;
  return {
    action,
    merchant: options.selectedTransactionId ? null : merchantFromText(text),
    amount: parseAmount(text),
    approximateDate: parseDate(text, options.now || new Date()),
    accountLabel: null,
    direction: /\b(refund|reimbursement|money in)\b/i.test(text)
      ? "inflow"
      : /\b(charge|purchase|payment|money out)\b/i.test(text)
        ? "outflow"
        : null,
    category,
    requestedSubcategory: action === "classify" ? requestedSubcategoryFromText(text) : null,
    treatment,
    split,
    contextLabel: context,
    note: noteMatch?.[1]?.trim() || (/\breceipt\b/i.test(text) ? "Receipt needed for taxes" : null),
    reimbursable: /\breimburs(?:able|ement)\b/i.test(text),
    receiptNeeded: /\breceipt\b/i.test(text),
    modality: options.modality || "typed",
    selectedTransactionId: options.selectedTransactionId || null,
  };
}

const merchantSimilarity = (intentMerchant: string, transactionName: string) => {
  const requested = normalizeMerchantName(intentMerchant);
  const candidate = normalizeMerchantName(transactionName);
  if (requested === candidate) return 1;
  if (candidate.includes(requested) || requested.includes(candidate)) return 0.85;
  const requestedWords = new Set(requested.split(" "));
  const candidateWords = new Set(candidate.split(" "));
  const shared = [...requestedWords].filter((word) => candidateWords.has(word)).length;
  return shared / Math.max(requestedWords.size, candidateWords.size, 1);
};

export function resolveTransactionIntent(
  intent: TransactionIntent,
  eligibleTransactions: MoneyTransaction[],
): TransactionResolution {
  if (intent.split && Math.abs(intent.split.reduce((sum, part) => sum + part.percentage, 0) - 100) > 0.001) {
    return { kind: "no_match", similar: [] };
  }
  const ranked = eligibleTransactions
    .map((transaction): TransactionCandidate | null => {
      if (intent.selectedTransactionId) {
        if (transaction.id !== intent.selectedTransactionId) return null;
        return { transaction, score: 100, confidence: "high", evidence: ["selected transaction context"] };
      }
      let score = 0;
      const evidence: string[] = [];
      if (intent.amount !== null) {
        if (Math.abs(Math.abs(transaction.amount) - intent.amount) <= 0.005) {
          score += 45;
          evidence.push("exact amount");
        } else return null;
      }
      if (intent.merchant) {
        const similarity = merchantSimilarity(intent.merchant, transaction.name);
        if (similarity >= 0.99) {
          score += 40;
          evidence.push("normalized merchant");
        } else if (similarity >= 0.6) {
          score += 40;
          evidence.push("fuzzy merchant");
        } else return null;
      }
      if (intent.approximateDate) {
        if (transaction.date === intent.approximateDate) {
          score += 15;
          evidence.push("date");
        } else return null;
      }
      if (intent.accountLabel) {
        if (transaction.accountLabel !== intent.accountLabel) return null;
        score += 10;
        evidence.push("account");
      }
      if (intent.direction) {
        if (transaction.direction !== intent.direction) return null;
        score += 5;
        evidence.push("direction");
      }
      if (!intent.amount && !intent.merchant && !intent.approximateDate) return null;
      const confidence = score >= 55 ? "high" : score >= 40 ? "medium" : "low";
      return { transaction, score, confidence, evidence };
    })
    .filter((candidate): candidate is TransactionCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score || b.transaction.date.localeCompare(a.transaction.date) || b.transaction.id.localeCompare(a.transaction.id));
  const plausible = ranked.filter((candidate) => candidate.confidence !== "low");
  if (!plausible.length) return { kind: "no_match", similar: ranked.slice(0, 3) };
  if (plausible.length === 1 && plausible[0].confidence === "high") {
    return { kind: "clear", candidate: plausible[0], requiresConfirmation: true };
  }
  return { kind: "ambiguous", candidates: plausible.slice(0, 4) };
}

export function sourceConditionSignature(transaction: MoneyTransaction) {
  return [
    transaction.id,
    transaction.pendingTransactionId || "",
    transaction.name,
    transaction.amount.toFixed(2),
    transaction.date,
    transaction.plaidAccountId,
    transaction.category,
    transaction.pending ? "pending" : "posted",
  ].join("|");
}

export function effectiveTransactionState(
  transaction: MoneyTransaction,
  inferredCategory: string | null,
  history: TransactionUnderstandingRecord[],
  merchantRules: MerchantCategoryRule[] = [],
): TransactionEffectiveState {
  const superseded = new Set(history.map((record) => record.supersedesRecordId).filter(Boolean));
  const active = [...history]
    .filter((record) => record.transactionId === transaction.id && !superseded.has(record.id))
    .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))[0] || null;
  const confirmedCategory =
    active?.parsedIntent.action === "remove_label" ? null : active?.confirmedCategory || null;
  const merchantRule = !active ? merchantRules
    .filter((rule) => rule.status === "active" && rule.normalizedMerchantName === normalizeMerchantName(transaction.name))
    .filter((rule) => rule.ruleScope === "past_and_future" || transaction.date >= rule.createdAt.slice(0, 10))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null : null;
  const sourceParent = parentForSourceCategory(transaction.sourceCategory || transaction.category);
  const confirmedParent = active?.confirmedParentCategoryId
    ? SYSTEM_CATEGORY_PARENTS.find((parent) => parent.id === active.confirmedParentCategoryId) || null
    : null;
  const effectiveParent = confirmedParent || (merchantRule
    ? SYSTEM_CATEGORY_PARENTS.find((parent) => parent.id === merchantRule.parentCategoryId) || sourceParent
    : sourceParent);
  const effectiveSubcategoryId = active?.confirmedSubcategoryId || merchantRule?.subcategoryId || null;
  const effectiveSubcategory = active?.confirmedSubcategory || merchantRule?.subcategoryName || null;
  return {
    sourceCategory: transaction.category,
    inferredCategory,
    effectiveCategory: active?.confirmedParentCategory || confirmedCategory || merchantRule?.parentCategoryName || inferredCategory || transaction.category,
    effectiveParentCategoryId: effectiveParent.id,
    effectiveParentCategory: effectiveParent.displayName,
    effectiveSubcategoryId,
    effectiveSubcategory,
    categorySource: active?.confirmedParentCategoryId || confirmedCategory
      ? "user_confirmed"
      : merchantRule
        ? "user_confirmed"
      : inferredCategory
        ? "covarify_inference"
        : "normalized_source",
    treatment: active?.treatment || null,
    split: active?.split || null,
    contextLabel: active?.contextLabel || null,
    note: active?.note || null,
    reimbursable: active?.reimbursable || false,
    receiptNeeded: active?.receiptNeeded || false,
    activeRecordId: active?.id || null,
  };
}

export function buildConfirmedUnderstandingRecord(input: {
  id: string;
  userId: string;
  confirmedBy: string;
  transaction: MoneyTransaction;
  intent: TransactionIntent;
  priorState: TransactionEffectiveState;
  supersedesRecordId?: string | null;
  confirmedAt: string;
  matchConfidence: "high" | "medium";
  categoryAssignment?: {
    parentCategoryId: string;
    parentCategory: string;
    subcategoryId: string;
    subcategory: string;
    requestedSubcategory: string;
    assignmentSource?: "user_transaction" | "merchant_rule";
    merchantRuleId?: string | null;
  } | null;
}): TransactionUnderstandingRecord {
  if (input.intent.split && Math.abs(input.intent.split.reduce((sum, part) => sum + part.percentage, 0) - 100) > 0.001) {
    throw new Error("SPLIT_DOES_NOT_RECONCILE");
  }
  if (input.matchConfidence !== "high" && !input.intent.selectedTransactionId) {
    throw new Error("WEAK_MATCH_REQUIRES_SELECTION");
  }
  return {
    id: input.id,
    userId: input.userId,
    transactionId: input.transaction.id,
    sourceConditionSignature: sourceConditionSignature(input.transaction),
    parsedIntent: input.intent,
    priorEffectiveState: input.priorState,
    confirmedCategory: input.intent.action === "remove_label" ? null : input.intent.category,
    confirmedParentCategoryId: input.intent.action === "remove_label" ? null : input.categoryAssignment?.parentCategoryId || null,
    confirmedParentCategory: input.intent.action === "remove_label" ? null : input.categoryAssignment?.parentCategory || null,
    confirmedSubcategoryId: input.intent.action === "remove_label" ? null : input.categoryAssignment?.subcategoryId || null,
    confirmedSubcategory: input.intent.action === "remove_label" ? null : input.categoryAssignment?.subcategory || null,
    requestedSubcategoryName: input.intent.action === "remove_label" ? null : input.categoryAssignment?.requestedSubcategory || null,
    assignmentSource: input.intent.action === "remove_label" ? null : input.categoryAssignment?.assignmentSource || (input.categoryAssignment ? "user_transaction" : null),
    merchantRuleId: input.intent.action === "remove_label" ? null : input.categoryAssignment?.merchantRuleId || null,
    treatment: input.intent.treatment,
    split: input.intent.split,
    contextLabel: input.intent.contextLabel,
    note: input.intent.note,
    reimbursable: input.intent.reimbursable,
    receiptNeeded: input.intent.receiptNeeded,
    confirmedAt: input.confirmedAt,
    confirmedBy: input.confirmedBy,
    supersedesRecordId: input.supersedesRecordId || null,
    ruleVersion: TRANSACTION_UNDERSTANDING_RULE_VERSION,
    inputModality: input.intent.modality,
    matchConfidence: input.matchConfidence,
  };
}

export function reconcilePendingUnderstanding(
  pending: MoneyTransaction,
  posted: MoneyTransaction,
  records: TransactionUnderstandingRecord[],
) {
  const sameAccount = pending.plaidAccountId === posted.plaidAccountId;
  const sameAmount = Math.abs(pending.amount - posted.amount) <= 0.005;
  const sameMerchant = merchantSimilarity(pending.name, posted.name) >= 0.85;
  const linked = posted.pendingTransactionId === pending.id;
  if (!sameAccount || !sameAmount || (!linked && !sameMerchant)) return [];
  return records
    .filter((record) => record.transactionId === pending.id)
    .map((record) => ({
      ...record,
      id: `${record.id}:posted`,
      transactionId: posted.id,
      sourceConditionSignature: sourceConditionSignature(posted),
      supersedesRecordId: record.id,
    }));
}

export function applyEffectiveCategories(
  transactions: MoneyTransaction[],
  inferredCategories: ReadonlyMap<string, string>,
  history: TransactionUnderstandingRecord[],
  merchantRules: MerchantCategoryRule[] = [],
) {
  return transactions.map((transaction) => {
    const state = effectiveTransactionState(
      transaction,
      inferredCategories.get(transaction.id) || null,
      history,
      merchantRules,
    );
    const parent = state.effectiveParentCategoryId
      ? SYSTEM_CATEGORY_PARENTS.find((candidate) => candidate.id === state.effectiveParentCategoryId)
      : null;
    return {
      ...transaction,
      sourceCategory: transaction.sourceCategory || state.sourceCategory,
      category: state.effectiveSubcategory && parent
        ? categoryKeyForParent(parent)
        : state.effectiveCategory.toUpperCase().replace(/\s+/g, "_"),
      effectiveParentCategory: state.effectiveParentCategory,
      effectiveSubcategory: state.effectiveSubcategory,
      categorySource: state.categorySource,
      userConfirmedMeaning: state.activeRecordId
        ? {
            category: state.effectiveCategory,
            parentCategory: state.effectiveParentCategory,
            subcategory: state.effectiveSubcategory,
            treatment: state.treatment,
            contextLabel: state.contextLabel,
            note: state.note,
            receiptNeeded: state.receiptNeeded,
          }
        : null,
    };
  });
}

export type MerchantCategoryRule = {
  id: string;
  normalizedMerchantName: string;
  parentCategoryId: string;
  parentCategoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  ruleScope: "future" | "past_and_future";
  status: "active" | "archived";
  createdAt: string;
};

export type SavedTransactionClassification = {
  transactionId: string;
  sourceCategory: string;
  effectiveParentCategory: string;
  effectiveSubcategory: string;
  assignmentSource: "user_transaction";
  merchantRuleId: string | null;
};

export function applySavedClassificationToTransaction(
  transaction: MoneyTransaction,
  saved: SavedTransactionClassification,
): MoneyTransaction {
  if (transaction.id !== saved.transactionId) return transaction;
  return {
    ...transaction,
    sourceCategory: saved.sourceCategory,
    effectiveParentCategory: saved.effectiveParentCategory,
    effectiveSubcategory: saved.effectiveSubcategory,
    categorySource: "user_confirmed",
    userConfirmedMeaning: {
      category: saved.effectiveParentCategory,
      parentCategory: saved.effectiveParentCategory,
      subcategory: saved.effectiveSubcategory,
      treatment: transaction.userConfirmedMeaning?.treatment || null,
      contextLabel: transaction.userConfirmedMeaning?.contextLabel || null,
      note: transaction.userConfirmedMeaning?.note || null,
      receiptNeeded: transaction.userConfirmedMeaning?.receiptNeeded || false,
    },
  };
}
