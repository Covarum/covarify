import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizedFounderUser } from "@/lib/founder-review-auth";
import { displaySeparated } from "@/lib/presentation-separators";
import { normalizePersistedPlaidCategory } from "@/lib/plaid/category-normalization";
import type { MoneyTransaction } from "@/lib/money-picture";
import { formatCategoryPath } from "@/lib/money-picture";
import {
  buildConfirmedUnderstandingRecord,
  buildMerchantRuleAssignmentRecords,
  checkMerchantCategoryRule,
  exactMerchantTransactions,
  effectiveTransactionState,
  merchantBreadthForName,
  parseTransactionIntent,
  resolveTransactionIntent,
  sourceConditionSignature,
  type InputModality,
  type TransactionIntent,
} from "@/lib/transaction-understanding";
import {
  parentForSourceCategory,
  normalizeMerchantName,
  suggestSubcategories,
  SYSTEM_CATEGORY_PARENTS,
} from "@/lib/category-hierarchy";
import {
  createMerchantCategoryRule,
  appendTransactionUnderstandingRecords,
  createUserSubcategory,
  loadAvailableSubcategories,
  loadMerchantCategoryRules,
  loadTransactionUnderstandingHistory,
  recordToInsert,
  replaceOrReactivateMerchantCategoryRule,
} from "@/lib/transaction-understanding-server";
import {
  housingObligationType,
  recurringObligationInput,
  type ObligationPaymentType,
} from "@/lib/recurring-obligations";
import { ambiguousHistoryMerchantNames, answerTransactionHistoryQuery, parseTransactionHistoryQuery } from "@/lib/transaction-history-query";
import { formatFinancialPeriodDateRange, type ResolvedFinancialPeriod } from "@/lib/financial-periods";
import { orchestrateConversation } from "@/lib/conversation/orchestrator";
import type { ConversationContext } from "@/lib/conversation/types";

export const dynamic = "force-dynamic";

async function loadTransactions(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: items, error: itemError } = await supabase
    .from("plaid_items")
    .select("id")
    .eq("user_id", userId)
    .eq("environment", "production")
    .in("status", ["active", "pending"]);
  if (itemError || !items?.length) throw new Error("ACTIVITY_UNAVAILABLE");
  const itemIds = items.map((item) => item.id);
  const [accounts, transactions] = await Promise.all([
    supabase
      .from("plaid_accounts")
      .select("id,name,official_name,mask")
      .eq("user_id", userId)
      .in("plaid_item_id", itemIds)
      .eq("active_status", "active"),
    supabase
      .from("plaid_transactions")
      .select("id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data")
      .eq("user_id", userId)
      .in("plaid_item_id", itemIds)
      .is("removed_at", null)
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(5000),
  ]);
  if (accounts.error || transactions.error) throw new Error("ACTIVITY_UNAVAILABLE");
  const labels = new Map(
    (accounts.data || []).map((account) => [
      account.id,
      displaySeparated(
        account.official_name || account.name,
        account.mask ? `•••• ${account.mask}` : null,
      ),
    ]),
  );
  return (transactions.data || [])
    .filter((row) => labels.has(row.plaid_account_id))
    .map((row): MoneyTransaction => {
      const category = normalizePersistedPlaidCategory(row.category_data);
      const amount = Number(row.amount);
      return {
        id: String(row.id),
        plaidAccountId: String(row.plaid_account_id),
        accountLabel: labels.get(row.plaid_account_id) || "Connected account",
        merchantName: row.merchant_name ? String(row.merchant_name) : null,
        name: String(row.merchant_name || row.transaction_name),
        description: String(row.transaction_name || ""),
        amount,
        currency: String(row.currency || "USD"),
        date: String(row.transaction_date),
        pending: Boolean(row.pending),
        pendingTransactionId: row.pending_transaction_id ? String(row.pending_transaction_id) : null,
        category: category?.primary || "Uncategorized",
        sourceCategory: category?.primary || "Uncategorized",
        detailedCategory: category?.detailed || null,
        direction: amount < 0 ? "inflow" : amount > 0 ? "outflow" : "neutral",
        transferRelationship: null,
      };
    });
}

const safeTransaction = (transaction: MoneyTransaction) => ({
  id: transaction.id,
  name: transaction.name,
  amount: transaction.amount,
  currency: transaction.currency,
  date: transaction.date,
  pending: transaction.pending,
  accountLabel: transaction.accountLabel,
  sourceCategory: transaction.sourceCategory || transaction.category,
});

const hierarchyForRequest = (
  requestedSubcategory: string,
  availableSubcategories: Awaited<ReturnType<typeof loadAvailableSubcategories>>,
  fallbackSourceCategory = "Uncategorized",
  requestedParentName?: string | null,
) => {
  const rankedAcrossParents = SYSTEM_CATEGORY_PARENTS.flatMap((parent) =>
    suggestSubcategories(requestedSubcategory, parent.id, availableSubcategories)
      .map((suggestion) => ({ ...suggestion, parent })))
    .sort((a, b) => b.score - a.score);
  const explicitParent = requestedParentName
    ? SYSTEM_CATEGORY_PARENTS.find((candidate) => candidate.displayName === requestedParentName)
    : null;
  const parent = explicitParent || rankedAcrossParents[0]?.parent || parentForSourceCategory(fallbackSourceCategory);
  const suggestions = suggestSubcategories(requestedSubcategory, parent.id, availableSubcategories);
  return {
    parent,
    suggestions,
    parentSubcategories: availableSubcategories
      .filter((subcategory) => subcategory.parentCategoryId === parent.id && subcategory.status === "active")
      .map((subcategory) => ({ id: subcategory.id, displayName: subcategory.displayName })),
  };
};

export async function POST(request: Request) {
  const user = await getAuthorizedFounderUser();
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    const body = (await request.json()) as {
      operation?: "interpret" | "confirm" | "undo" | "confirm_merchant_rule" | "save_housing_obligation" | "unlink_housing_obligation";
      text?: string;
      modality?: InputModality;
      selectedTransactionId?: string | null;
      transactionId?: string;
      intent?: TransactionIntent;
      sourceSignature?: string;
      confirmationId?: string;
      subcategoryDecision?: {
        action: "use_existing" | "create_new";
        parentCategoryId?: string;
        subcategoryId?: string;
        displayName?: string;
        reviewedSuggestionIds?: string[];
        ruleScope?: "transaction_only" | "future" | "past_and_future";
        replaceExisting?: boolean;
        reactivateArchived?: boolean;
      };
      obligation?: {
        transactionId: string;
        expectedAmount?: number | null;
        dueDay?: number | null;
        ongoingStatus: "ongoing" | "ended" | "unsure";
        paymentType: ObligationPaymentType;
        remainingDue?: number | null;
      };
      obligationTransactionId?: string;
      activePeriod?: ResolvedFinancialPeriod;
      sessionId?: string;
      conversationContext?: ConversationContext | null;
      conversationProposalReview?: boolean;
    };
    const transactions = await loadTransactions(user.id);
    const [history, availableSubcategories, merchantRules] = await Promise.all([
      loadTransactionUnderstandingHistory(user.id),
      loadAvailableSubcategories(user.id),
      loadMerchantCategoryRules(user.id, true),
    ]);

    if (body.operation === "save_housing_obligation") {
      const transaction = transactions.find((row) => row.id === body.obligation?.transactionId);
      if (!transaction || !body.obligation) {
        return NextResponse.json({ error: "OWNED_TRANSACTION_REQUIRED" }, { status: 403 });
      }
      const effective = effectiveTransactionState(transaction, null, history, merchantRules);
      const type = housingObligationType(
        effective.effectiveParentCategory,
        effective.effectiveSubcategory,
      );
      if (!type) {
        return NextResponse.json({ error: "HOUSING_CLASSIFICATION_REQUIRED" }, { status: 409 });
      }
      const normalized = recurringObligationInput({
        userId: user.id,
        transactionId: transaction.id,
        payee: transaction.name,
        type,
        actualPaymentAmount: Math.abs(transaction.amount),
        paymentDate: transaction.date,
        expectedAmount: body.obligation.expectedAmount,
        dueDay: body.obligation.dueDay,
        ongoingStatus: body.obligation.ongoingStatus,
        paymentType: body.obligation.paymentType,
        remainingDue: body.obligation.remainingDue,
      });
      const { data, error } = await createSupabaseAdminClient().rpc("record_housing_obligation", {
        p_user_id: user.id,
        p_transaction_id: normalized.transactionId,
        p_obligation_type: normalized.type,
        p_payee_display_name: normalized.payee,
        p_normalized_payee_name: normalized.normalizedPayee,
        p_expected_amount: normalized.expectedAmount,
        p_due_day: normalized.dueDay,
        p_ongoing_status: normalized.ongoingStatus,
        p_payment_type: normalized.paymentType,
        p_remaining_due: normalized.remainingDue,
      });
      if (error) {
        if (error.code === "23505" || error.code === "40001" || error.code === "55P03") {
          return NextResponse.json({
            error: "OBLIGATION_CONFLICT_RETRY",
            retryable: true,
          }, { status: 409 });
        }
        throw new Error("OBLIGATION_APPEND_FAILED");
      }
      return NextResponse.json({
        kind: "obligation_saved",
        obligationVersionId: data.obligationVersionId,
        paymentRecordId: data.paymentRecordId,
        linkStatus: data.linkStatus,
        message: `${transaction.name} is now recorded as a ${type} obligation. The bank transaction remains unchanged.`,
      });
    }

    if (body.operation === "unlink_housing_obligation") {
      const transaction = transactions.find((row) => row.id === body.obligationTransactionId);
      if (!transaction) {
        return NextResponse.json({ error: "OWNED_TRANSACTION_REQUIRED" }, { status: 403 });
      }
      const { data, error } = await createSupabaseAdminClient().rpc("unlink_housing_obligation", {
        p_user_id: user.id,
        p_transaction_id: transaction.id,
      });
      if (error) {
        if (error.code === "23505" || error.code === "40001" || error.code === "55P03") {
          return NextResponse.json({
            error: "OBLIGATION_CONFLICT_RETRY",
            retryable: true,
          }, { status: 409 });
        }
        throw new Error("OBLIGATION_UNLINK_FAILED");
      }
      return NextResponse.json({
        kind: "obligation_unlinked",
        obligationVersionId: data.obligationVersionId,
        paymentRecordId: data.paymentRecordId,
        linkStatus: data.linkStatus,
        message: "The payment is no longer linked to the housing obligation. Its source transaction and classification remain unchanged.",
      });
    }

    if (body.operation === "interpret") {
      const text = String(body.text || "").trim();
      if (!text || text.length > 500) return NextResponse.json({ error: "INVALID_INTENT" }, { status: 400 });
      const conversation = orchestrateConversation({
        text,
        userId: user.id,
        sessionId: String(body.sessionId || "default"),
        selectedTransactionId: body.selectedTransactionId,
        context: body.conversationContext,
        activePeriod: body.activePeriod,
        transactions,
      });
      console.info("conversation_core", {
        intent: conversation.intent.type,
        scope: conversation.scope.type,
        tool: conversation.intent.capability,
        clarificationRequired: conversation.kind === "clarification_question",
        evidenceCount: conversation.evidence?.transactionIds.length || 0,
        proposalGenerated: Boolean(conversation.proposal),
      });
      if (!body.conversationProposalReview && conversation.intent.type !== "ambiguous" && conversation.intent.type !== "merchant_rule" && conversation.intent.type !== "transaction_correction") {
        return NextResponse.json(conversation);
      }
      const historyQuery = parseTransactionHistoryQuery(text);
      if (historyQuery) {
        if (!historyQuery.merchant) return NextResponse.json({ kind: "no_match", message: "Which merchant or category should I look for?" });
        if (!body.activePeriod) return NextResponse.json({ error: "ACTIVE_PERIOD_REQUIRED" }, { status: 400 });
        const variants = ambiguousHistoryMerchantNames(historyQuery.merchant, transactions);
        if (variants.length) return NextResponse.json({ kind: "no_match", message: `I found ${variants.join(" and ")}. Should I include both?` });
        const answer = answerTransactionHistoryQuery({ query: historyQuery, transactions, activePeriod: body.activePeriod });
        const range = answer.period ? formatFinancialPeriodDateRange(answer.period) : "all connected history";
        const merchant = historyQuery.merchant;
        const count = answer.purchases.length;
        const total = new Intl.NumberFormat("en-US", { style: "currency", currency: answer.purchases[0]?.currency || "USD" }).format(answer.total);
        const base = count === 0
          ? `I didn’t find any ${merchant} payments from ${range}.${answer.hasEarlierActivity ? ` ${merchant} appears in an earlier period.` : ""}`
          : historyQuery.intentType === "transaction_total_query"
            ? `You paid ${merchant} ${total} across ${count} ${count === 1 ? "transaction" : "transactions"} from ${range}.`
            : `I found ${count} ${count === 1 ? "payment" : "payments"} to ${merchant} from ${range}. Total paid: ${total}.`;
        const refundCopy = answer.refunds.length ? ` ${answer.refunds.length} ${answer.refunds.length === 1 ? "refund" : "refunds"} totaling ${new Intl.NumberFormat("en-US", { style: "currency", currency: answer.refunds[0].currency }).format(answer.refundTotal)} were kept separate.` : "";
        return NextResponse.json({ kind: "history_query", message: base + refundCopy, merchant, transactionIds: answer.purchases.map((row) => row.id), periodStart: answer.period?.start || null, periodEnd: answer.period?.end || null, accounts: answer.accounts });
      }
      const intent = parseTransactionIntent(text, {
        modality: body.modality || (body.selectedTransactionId ? "selected_transaction" : "typed"),
        selectedTransactionId: body.selectedTransactionId || null,
      });
      if (
        intent.intentType === "category_instruction" ||
        intent.intentType === "ambiguous_transaction_request"
      ) {
        return NextResponse.json({
          kind: "intent_clarification",
          message: `Do you mean one ${intent.merchant || "merchant"} purchase, or should Covarify remember this for ${intent.merchant || "that merchant"} purchases?`,
          merchant: intent.merchant,
          requestedSubcategory: intent.requestedSubcategory || intent.category,
          originalText: text,
          intent,
        });
      }
      if (intent.intentType === "merchant_rule" && intent.merchant) {
        const requestedSubcategory = intent.requestedSubcategory || intent.category;
        if (!requestedSubcategory) {
          return NextResponse.json({
            kind: "no_match",
            message: `I understood this as a rule for ${intent.merchant}, but I need the category you want Covarify to remember.`,
          });
        }
        const matching = exactMerchantTransactions(intent.merchant, transactions);
        const { parent, suggestions, parentSubcategories } = hierarchyForRequest(
          requestedSubcategory,
          availableSubcategories,
          matching[0]?.sourceCategory || matching[0]?.category,
          intent.requestedParentCategory,
        );
        const selectedSuggestion = suggestions[0]?.category || null;
        const ruleCheck = selectedSuggestion
          ? checkMerchantCategoryRule(
              merchantRules,
              intent.merchant,
              parent.id,
              selectedSuggestion.id,
            )
          : { kind: "none" as const };
        const dates = matching.map((transaction) => transaction.date).sort();
        const categoryMix = [...new Set(matching.map((transaction) => {
          const state = effectiveTransactionState(transaction, null, history, merchantRules);
          return formatCategoryPath({
            parentCategory: state.effectiveParentCategory,
            subcategory: state.effectiveSubcategory,
            sourceCategory: transaction.sourceCategory || transaction.category,
          });
        }))];
        return NextResponse.json({
          kind: "merchant_rule",
          message: `I understood this as a rule for ${intent.merchant}.`,
          merchant: intent.merchant,
          requestedSubcategory,
          parentCategory: { id: parent.id, displayName: parent.displayName },
          suggestions: suggestions.map(({ category, match }) => ({
            id: category.id,
            displayName: category.displayName,
            match,
          })),
          parentSubcategories,
          breadth: merchantBreadthForName(intent.merchant),
          activity: {
            count: matching.length,
            firstDate: dates[0] || null,
            lastDate: dates.at(-1) || null,
            categoryMix,
          },
          existingRule: ruleCheck.kind === "none" ? null : {
            kind: ruleCheck.kind,
            id: ruleCheck.rule.id,
            category: formatCategoryPath({
              parentCategory: ruleCheck.rule.parentCategoryName,
              subcategory: ruleCheck.rule.subcategoryName,
            }),
          },
          intent,
        });
      }
      const resolution = resolveTransactionIntent(intent, transactions);
      if (resolution.kind === "no_match") {
        return NextResponse.json({
          kind: "no_match",
          message: "I couldn’t find that transaction in your connected activity. Try adding the date or account.",
        });
      }
      if (resolution.kind === "ambiguous") {
        return NextResponse.json({
          kind: "ambiguous",
          message: "I found more than one transaction that may match. Which one did you mean?",
          candidates: resolution.candidates.map(({ transaction }) => safeTransaction(transaction)),
          intent,
        });
      }
      const transaction = resolution.candidate.transaction;
      const sourceCategory = transaction.sourceCategory || transaction.category;
      const conflictsWithEvidence =
        (/TRANSFER/i.test(sourceCategory) && intent.category !== "Transfer") ||
        (/REFUND/i.test(sourceCategory) && intent.category !== "Refund");
      if (conflictsWithEvidence) {
        return NextResponse.json({
          kind: "no_match",
          message: "This request conflicts with transfer or refund evidence. Review the transaction detail before confirming.",
        });
      }
      const requestedSubcategory = intent.requestedSubcategory || intent.category;
      const sourceParent = parentForSourceCategory(sourceCategory);
      const rankedAcrossParents = requestedSubcategory
        ? SYSTEM_CATEGORY_PARENTS.flatMap((parent) => suggestSubcategories(requestedSubcategory, parent.id, availableSubcategories)
          .map((suggestion) => ({ ...suggestion, parent })))
          .sort((a, b) => b.score - a.score)
        : [];
      const requestedParent = intent.requestedParentCategory
        ? SYSTEM_CATEGORY_PARENTS.find((candidate) => candidate.displayName === intent.requestedParentCategory)
        : null;
      const parent = requestedParent || rankedAcrossParents[0]?.parent || sourceParent;
      const suggestions = requestedSubcategory
        ? suggestSubcategories(requestedSubcategory, parent.id, availableSubcategories)
        : [];
      const parentSubcategories = availableSubcategories
        .filter((subcategory) => subcategory.parentCategoryId === parent.id && subcategory.status === "active")
        .map((subcategory) => ({ id: subcategory.id, displayName: subcategory.displayName }));
      const foundMessage = `I found the ${transaction.name} transaction for ${new Intl.NumberFormat("en-US", { style: "currency", currency: transaction.currency }).format(Math.abs(transaction.amount))} on ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${transaction.date}T00:00:00Z`))}.`;
      return NextResponse.json({
        kind: "clear",
        message: intent.action === "remove_label"
          ? `I found the ${transaction.name} transaction. Remove the current user-confirmed meaning and return to the next available category source?`
          : requestedSubcategory
            ? `${foundMessage} ${parent.displayName} is the main category. You asked Covarify to classify it more specifically as ${requestedSubcategory}.`
            : foundMessage,
        transaction: safeTransaction(transaction),
        proposedCategory: intent.category,
        parentCategory: { id: parent.id, displayName: parent.displayName },
        requestedSubcategory,
        suggestions: suggestions.map(({ category, match }) => ({ id: category.id, displayName: category.displayName, match })),
        parentSubcategories,
        sourceParentCategory: { id: sourceParent.id, displayName: sourceParent.displayName },
        categoryOptions: SYSTEM_CATEGORY_PARENTS.map((categoryParent) => ({
          id: categoryParent.id,
          displayName: categoryParent.displayName,
          subcategories: availableSubcategories
            .filter((subcategory) => subcategory.parentCategoryId === categoryParent.id && subcategory.status === "active")
            .map((subcategory) => ({ id: subcategory.id, displayName: subcategory.displayName })),
        })),
        intent,
        sourceSignature: sourceConditionSignature(transaction),
      });
    }

    if (body.operation === "confirm_merchant_rule") {
      const intent = body.intent;
      const merchant = intent?.merchant;
      const requestedSubcategory = intent?.requestedSubcategory || intent?.category;
      const decision = body.subcategoryDecision;
      if (!intent || intent.intentType !== "merchant_rule" || !merchant || !requestedSubcategory || !decision) {
        return NextResponse.json({ error: "MERCHANT_RULE_CONFIRMATION_REQUIRED" }, { status: 400 });
      }
      if (decision.ruleScope === "transaction_only") {
        return NextResponse.json({
          kind: "merchant_rule_confirmed",
          message: `No blanket rule was created for ${merchant}. You can classify ${merchant} purchases individually.`,
          merchantMemory: { scope: "transaction_only", saved: false },
        });
      }
      if (decision.ruleScope !== "future" && decision.ruleScope !== "past_and_future") {
        return NextResponse.json({ error: "MERCHANT_RULE_SCOPE_REQUIRED" }, { status: 400 });
      }
      const { parent, suggestions } = hierarchyForRequest(requestedSubcategory, availableSubcategories, "Uncategorized", intent.requestedParentCategory);
      let selectedSubcategory = decision.action === "use_existing"
        ? availableSubcategories.find((subcategory) =>
          subcategory.id === decision.subcategoryId &&
          subcategory.parentCategoryId === parent.id &&
          subcategory.status === "active")
        : null;
      if (decision.action === "use_existing" && !selectedSubcategory) {
        return NextResponse.json({ error: "SUBCATEGORY_NOT_AVAILABLE" }, { status: 403 });
      }
      if (decision.action === "create_new") {
        const exact = suggestions.find((suggestion) => suggestion.match === "exact");
        if (exact) return NextResponse.json({ error: "DUPLICATE_SUBCATEGORY", existing: exact.category.displayName }, { status: 409 });
        const reviewed = new Set(decision.reviewedSuggestionIds || []);
        if (suggestions.some((suggestion) => !reviewed.has(suggestion.category.id))) {
          return NextResponse.json({ error: "SUBCATEGORY_MATCH_REVIEW_REQUIRED" }, { status: 409 });
        }
        selectedSubcategory = await createUserSubcategory(
          user.id,
          parent.id,
          decision.displayName || requestedSubcategory,
        );
      }
      if (!selectedSubcategory) {
        return NextResponse.json({ error: "SUBCATEGORY_DECISION_REQUIRED" }, { status: 400 });
      }
      const existing = checkMerchantCategoryRule(
        merchantRules,
        merchant,
        parent.id,
        selectedSubcategory.id,
      );
      if (existing.kind === "conflict" && !decision.replaceExisting) {
        return NextResponse.json({
          error: "MERCHANT_RULE_CONFLICT",
          existingCategory: formatCategoryPath({
            parentCategory: existing.rule.parentCategoryName,
            subcategory: existing.rule.subcategoryName,
          }),
        }, { status: 409 });
      }
      if (existing.kind === "archived" && !decision.reactivateArchived) {
        return NextResponse.json({ error: "MERCHANT_RULE_ARCHIVED" }, { status: 409 });
      }
      const ruleId = existing.kind === "none" ? randomUUID() : existing.rule.id;
      const confirmedAt = new Date().toISOString();
      if (existing.kind === "conflict" || existing.kind === "archived") {
        await replaceOrReactivateMerchantCategoryRule({
          userId: user.id,
          existingRuleId: existing.rule.id,
          parentCategoryId: parent.id,
          subcategoryId: selectedSubcategory.id,
          ruleScope: decision.ruleScope,
        });
      } else {
        if (existing.kind === "none") await createMerchantCategoryRule({
          id: ruleId,
          userId: user.id,
          merchantName: merchant,
          parentCategoryId: parent.id,
          subcategoryId: selectedSubcategory.id,
          ruleScope: decision.ruleScope,
        });
      }
      const canonicalRule = {
        id: ruleId,
        merchantIdentifier: existing.kind === "none" ? null : existing.rule.merchantIdentifier,
        normalizedMerchantName: normalizeMerchantName(merchant),
        parentCategoryId: parent.id,
        parentCategoryName: parent.displayName,
        subcategoryId: selectedSubcategory.id,
        subcategoryName: selectedSubcategory.displayName,
        ruleScope: decision.ruleScope,
        status: "active" as const,
        createdAt: existing.kind === "none" ? confirmedAt : existing.rule.createdAt,
      };
      const historicalRecords = buildMerchantRuleAssignmentRecords({
        userId: user.id,
        confirmedBy: user.id,
        rule: canonicalRule,
        intent,
        transactions,
        history,
        priorMerchantRules: merchantRules,
        confirmedAt,
        idForTransaction: () => randomUUID(),
      });
      await appendTransactionUnderstandingRecords(historicalRecords);
      return NextResponse.json({
        kind: "merchant_rule_confirmed",
        message: existing.kind === "identical" && !historicalRecords.length
          ? `You already have this rule for ${merchant}.`
          : `Covarify will remember ${formatCategoryPath({
          parentCategory: parent.displayName,
          subcategory: selectedSubcategory.displayName,
        })} for ${decision.ruleScope === "future" ? "future" : "past and future"} ${merchant} purchases.`,
        categoryPath: formatCategoryPath({
          parentCategory: parent.displayName,
          subcategory: selectedSubcategory.displayName,
        }),
        merchantMemory: { scope: decision.ruleScope, saved: true },
        historicalAssignmentsApplied: historicalRecords.length,
      });
    }

    const transaction = transactions.find((row) => row.id === body.transactionId);
    if (!transaction || !body.intent || sourceConditionSignature(transaction) !== body.sourceSignature) {
      return NextResponse.json({ error: "STALE_TRANSACTION" }, { status: 409 });
    }
    const priorState = effectiveTransactionState(transaction, null, history);
    const supersedesRecordId =
      body.operation === "undo" ? priorState.activeRecordId : null;
    if (body.operation === "undo" && !supersedesRecordId) {
      return NextResponse.json({ error: "NOTHING_TO_UNDO" }, { status: 409 });
    }
    const intent =
      body.operation === "undo"
        ? { ...body.intent, action: "remove_label" as const, category: null }
        : body.intent;
    let categoryAssignment = null;
    let merchantRuleInput: Parameters<typeof createMerchantCategoryRule>[0] | null = null;
    const requestedSubcategory = intent.requestedSubcategory || intent.category;
    if (body.operation !== "undo" && requestedSubcategory) {
      const sourceParent = parentForSourceCategory(transaction.sourceCategory || transaction.category);
      const rankedAcrossParents = SYSTEM_CATEGORY_PARENTS.flatMap((parent) => suggestSubcategories(requestedSubcategory, parent.id, availableSubcategories)
        .map((suggestion) => ({ ...suggestion, parent })))
        .sort((a, b) => b.score - a.score);
      const requestedParent = body.subcategoryDecision?.parentCategoryId
        ? SYSTEM_CATEGORY_PARENTS.find((candidate) => candidate.id === body.subcategoryDecision?.parentCategoryId)
        : null;
      if (body.subcategoryDecision?.parentCategoryId && !requestedParent) {
        return NextResponse.json({ error: "PARENT_CATEGORY_NOT_AVAILABLE" }, { status: 403 });
      }
      const intentParent = intent.requestedParentCategory
        ? SYSTEM_CATEGORY_PARENTS.find((candidate) => candidate.displayName === intent.requestedParentCategory)
        : null;
      const parent = requestedParent || intentParent || rankedAcrossParents[0]?.parent || sourceParent;
      const suggestions = suggestSubcategories(requestedSubcategory, parent.id, availableSubcategories);
      const decision = body.subcategoryDecision;
      if (!decision) return NextResponse.json({ error: "SUBCATEGORY_DECISION_REQUIRED" }, { status: 400 });
      let selectedSubcategory = decision.action === "use_existing"
        ? availableSubcategories.find((subcategory) =>
          subcategory.id === decision.subcategoryId &&
          subcategory.parentCategoryId === parent.id &&
          subcategory.status === "active")
        : null;
      if (decision.action === "use_existing" && !selectedSubcategory) {
        return NextResponse.json({ error: "SUBCATEGORY_NOT_AVAILABLE" }, { status: 403 });
      }
      if (decision.action === "create_new") {
        const exact = suggestions.find((suggestion) => suggestion.match === "exact");
        if (exact) return NextResponse.json({ error: "DUPLICATE_SUBCATEGORY", existing: exact.category.displayName }, { status: 409 });
        const reviewed = new Set(decision.reviewedSuggestionIds || []);
        if (suggestions.some((suggestion) => !reviewed.has(suggestion.category.id))) {
          return NextResponse.json({ error: "SUBCATEGORY_MATCH_REVIEW_REQUIRED" }, { status: 409 });
        }
        selectedSubcategory = await createUserSubcategory(user.id, parent.id, decision.displayName || requestedSubcategory);
      }
      if (!selectedSubcategory) return NextResponse.json({ error: "SUBCATEGORY_DECISION_REQUIRED" }, { status: 400 });
      categoryAssignment = {
        parentCategoryId: parent.id,
        parentCategory: parent.displayName,
        subcategoryId: selectedSubcategory.id,
        subcategory: selectedSubcategory.displayName,
        requestedSubcategory,
        assignmentSource: "user_transaction" as const,
        merchantRuleId: null,
      };
      if (decision.ruleScope === "future" || decision.ruleScope === "past_and_future") {
        merchantRuleInput = {
          id: randomUUID(),
          userId: user.id,
          merchantName: transaction.name,
          parentCategoryId: parent.id,
          subcategoryId: selectedSubcategory.id,
          ruleScope: decision.ruleScope,
        };
      }
    }
    const record = buildConfirmedUnderstandingRecord({
      id: String(body.confirmationId || ""),
      userId: user.id,
      confirmedBy: user.id,
      transaction,
      intent,
      priorState,
      supersedesRecordId,
      confirmedAt: new Date().toISOString(),
      matchConfidence: "high",
      categoryAssignment,
    });
    const { error } = await createSupabaseAdminClient()
      .from("transaction_understanding_confirmations")
      .insert(recordToInsert(record));
    if (error) throw new Error("CONFIRMATION_APPEND_FAILED");
    let ruleSaved = true;
    if (merchantRuleInput) {
      try { await createMerchantCategoryRule(merchantRuleInput); }
      catch { ruleSaved = false; }
    }
    return NextResponse.json({
      kind: "confirmed",
      message: categoryAssignment
        ? `Got it. Covarify will classify that ${transaction.name} purchase as ${categoryAssignment.parentCategory} → ${categoryAssignment.subcategory} while preserving the original bank category.${ruleSaved ? "" : " The transaction was saved, but the merchant rule could not be added."}`
        : `Got it. Covarify will preserve the original bank category and save your transaction context.`,
      savedClassification: categoryAssignment
        ? {
            transactionId: transaction.id,
            sourceCategory: transaction.sourceCategory || transaction.category,
            effectiveParentCategory: categoryAssignment.parentCategory,
            effectiveSubcategory: categoryAssignment.subcategory,
            assignmentSource: categoryAssignment.assignmentSource,
            merchantRuleId: categoryAssignment.merchantRuleId,
          }
        : null,
      merchantMemory: {
        scope: body.subcategoryDecision?.ruleScope || "transaction_only",
        saved: ruleSaved,
      },
      obligationPrompt: categoryAssignment && housingObligationType(
        categoryAssignment.parentCategory,
        categoryAssignment.subcategory,
      ) ? {
        type: housingObligationType(categoryAssignment.parentCategory, categoryAssignment.subcategory),
        transactionId: transaction.id,
        payee: transaction.name,
        actualPaymentAmount: Math.abs(transaction.amount),
      } : null,
    });
  } catch {
    return NextResponse.json({ error: "TRANSACTION_UNDERSTANDING_UNAVAILABLE" }, { status: 503 });
  }
}
