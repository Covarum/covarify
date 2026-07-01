import { shouldShowMoneyByDefault } from "./classifiers";
import type { Discovery, DocumentRecord, EventSummary, FinancialEvent, NextBestMove, Transaction } from "./types";

function currency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function getEventSummary(
  event: FinancialEvent,
  transactions: Transaction[],
  documents: DocumentRecord[],
): EventSummary {
  const linkedTransactions = transactions.filter((transaction) => event.transactionIds.includes(transaction.id));
  const linkedDocuments = documents.filter((document) => event.documentIds.includes(document.id));
  const showMoney = shouldShowMoneyByDefault(event);
  const totalAmount = linkedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    title: event.title,
    lifeBucket: event.lifeBucket,
    purpose: event.purpose,
    transactionCount: linkedTransactions.length,
    documentCount: linkedDocuments.length,
    moneyVisibility: showMoney ? "shown" : "hidden",
    totalAmount: showMoney ? totalAmount : undefined,
    contextLine: showMoney
      ? `${event.title} is money-forward because ${event.lifeBucket.toLowerCase()} decisions depend on financial context.`
      : `${event.title} is meaning-forward, so money can stay secondary until it helps.`,
  };
}

export function generateNextBestMove(discovery: Discovery): NextBestMove {
  return {
    id: "move-organize-business-records",
    title: "Create a business records folder",
    description:
      `Because "${discovery.title}" is supported by sample business and tax-relevant records, the next useful move is to keep invoices, receipts, and notes grouped before tax time.`,
    actionLabel: "Review Sample Records",
    riskLevel: "low",
    category: "organize",
    disclaimer: "Sample preview only. Covarify will personalize next moves once real account and document data are connected.",
  };
}

export function generateSampleDiscovery(events: FinancialEvent[], transactions: Transaction[]): Discovery {
  const businessEvents = events.filter((event) => event.businessRelevant || event.taxRelevant);
  const relatedTransactionIds = transactions
    .filter((transaction) => businessEvents.some((event) => event.transactionIds.includes(transaction.id)))
    .map((transaction) => transaction.id);

  const discovery: Discovery = {
    id: "discovery-business-records",
    title: "Some financial events need better records than transactions alone can provide.",
    description:
      "In the sample data, business setup expenses are connected to invoices and a business event. That makes the records easier to explain later without treating every personal memory as a spreadsheet.",
    evidence: [
      `${businessEvents.length} sample business or tax-relevant event is grouped by meaning.`,
      `${relatedTransactionIds.length} linked sample transaction records support that event.`,
      "The same model keeps personal memories, like travel and relationships, money-light by default.",
    ],
    confidence: businessEvents.length > 0 ? "medium" : "low",
    relatedEventIds: businessEvents.map((event) => event.id),
    relatedTransactionIds,
  };

  return {
    ...discovery,
    nextBestMove: generateNextBestMove(discovery),
  };
}

export function formatEventAmount(summary: EventSummary) {
  return summary.totalAmount === undefined ? "Hidden by default" : currency(summary.totalAmount);
}
