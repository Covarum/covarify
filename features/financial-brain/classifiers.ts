import type { FinancialEvent, LifeBucket, Transaction } from "./types";

const bucketRules: Array<{ bucket: LifeBucket; keywords: string[] }> = [
  { bucket: "Home", keywords: ["home depot", "garden", "warranty", "repair"] },
  { bucket: "Travel", keywords: ["hotel", "las vegas", "airline", "resort"] },
  { bucket: "Transportation", keywords: ["lyft", "uber", "fuel", "parking"] },
  { bucket: "Food", keywords: ["restaurant", "dinner", "cafe", "best friend"] },
  { bucket: "Debt", keywords: ["payment", "capital one", "credit card", "loan"] },
  { bucket: "Business", keywords: ["workspace", "domain", "invoice", "software", "namecheap"] },
  { bucket: "Relationships", keywords: ["flower", "anniversary", "gift"] },
  { bucket: "Taxes", keywords: ["tax", "irs", "state tax"] },
  { bucket: "Education", keywords: ["tuition", "course", "books"] },
  { bucket: "Health", keywords: ["pharmacy", "doctor", "medical"] },
  { bucket: "Savings", keywords: ["transfer to savings", "brokerage", "investment"] },
];

export function classifyLifeBucket(transaction: Transaction): LifeBucket {
  const searchable = `${transaction.merchant} ${transaction.rawDescription} ${transaction.categoryGuess}`.toLowerCase();
  const match = bucketRules.find((rule) => rule.keywords.some((keyword) => searchable.includes(keyword)));

  return match?.bucket ?? transaction.categoryGuess ?? "Other";
}

export function shouldShowMoneyByDefault(event: FinancialEvent): boolean {
  if (event.showMoneyByDefault) {
    return true;
  }

  return event.lifeBucket === "Debt" || event.taxRelevant || event.businessRelevant;
}

export function groupTransactionsByEvent(transactions: Transaction[], events: FinancialEvent[]) {
  return events.map((event) => ({
    event,
    transactions: transactions.filter((transaction) => event.transactionIds.includes(transaction.id)),
  }));
}
