import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizedFounderUser } from "@/lib/founder-review-auth";
import { displaySeparated } from "@/lib/presentation-separators";
import { normalizePersistedPlaidCategory } from "@/lib/plaid/category-normalization";
import type { MoneyTransaction } from "@/lib/money-picture";
import {
  buildConfirmedUnderstandingRecord,
  effectiveTransactionState,
  parseTransactionIntent,
  resolveTransactionIntent,
  sourceConditionSignature,
  type InputModality,
  type TransactionIntent,
} from "@/lib/transaction-understanding";
import {
  loadTransactionUnderstandingHistory,
  recordToInsert,
} from "@/lib/transaction-understanding-server";

export const dynamic = "force-dynamic";

async function loadTransactions(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: items, error: itemError } = await supabase
    .from("plaid_items")
    .select("id")
    .eq("user_id", userId)
    .eq("environment", "production")
    .eq("status", "active");
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
        name: String(row.merchant_name || row.transaction_name),
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

export async function POST(request: Request) {
  const user = await getAuthorizedFounderUser();
  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  try {
    const body = (await request.json()) as {
      operation?: "interpret" | "confirm" | "undo";
      text?: string;
      modality?: InputModality;
      selectedTransactionId?: string | null;
      transactionId?: string;
      intent?: TransactionIntent;
      sourceSignature?: string;
      confirmationId?: string;
    };
    const transactions = await loadTransactions(user.id);
    const history = await loadTransactionUnderstandingHistory(user.id);

    if (body.operation === "interpret") {
      const text = String(body.text || "").trim();
      if (!text || text.length > 500) return NextResponse.json({ error: "INVALID_INTENT" }, { status: 400 });
      const intent = parseTransactionIntent(text, {
        modality: body.modality || (body.selectedTransactionId ? "selected_transaction" : "typed"),
        selectedTransactionId: body.selectedTransactionId || null,
      });
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
      return NextResponse.json({
        kind: "clear",
        message: intent.action === "remove_label"
          ? `I found the ${transaction.name} transaction. Remove the current user-confirmed meaning and return to the next available category source?`
          : `I found the ${transaction.name} transaction for ${new Intl.NumberFormat("en-US", { style: "currency", currency: transaction.currency }).format(Math.abs(transaction.amount))} on ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${transaction.date}T00:00:00Z`))}. Treat it as ${intent.category || sourceCategory}?`,
        transaction: safeTransaction(transaction),
        proposedCategory: intent.category,
        intent,
        sourceSignature: sourceConditionSignature(transaction),
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
    });
    const { error } = await createSupabaseAdminClient()
      .from("transaction_understanding_confirmations")
      .insert(recordToInsert(record));
    if (error) throw new Error("CONFIRMATION_APPEND_FAILED");
    return NextResponse.json({
      kind: "confirmed",
      message: `Got it. Covarify will treat that ${transaction.name} purchase as ${intent.category || transaction.category} while preserving the original bank category.`,
    });
  } catch {
    return NextResponse.json({ error: "TRANSACTION_UNDERSTANDING_UNAVAILABLE" }, { status: 503 });
  }
}
