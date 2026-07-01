export type LifeBucket =
  | "Home"
  | "Family"
  | "Relationships"
  | "Business"
  | "Health"
  | "Transportation"
  | "Food"
  | "Travel"
  | "Lifestyle"
  | "Debt"
  | "Savings"
  | "Giving"
  | "Education"
  | "Taxes"
  | "Other";

export type DocumentType = "receipt" | "warranty" | "invoice" | "policy" | "tax_document" | "manual" | "photo" | "note";

export type DiscoveryConfidence = "low" | "medium" | "high";

export type NextBestMoveRiskLevel = "low" | "medium" | "high";

export type NextBestMoveCategory = "organize" | "review" | "plan" | "protect" | "simplify";

export interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  date: string;
  accountName: string;
  paymentMethod: string;
  rawDescription: string;
  categoryGuess: LifeBucket;
  linkedEventId?: string;
  receiptId?: string;
}

export interface FinancialEvent {
  id: string;
  title: string;
  eventType: string;
  lifeBucket: LifeBucket;
  people: string[];
  project: string;
  purpose: string;
  notes: string;
  startDate: string;
  endDate?: string;
  transactionIds: string[];
  documentIds: string[];
  tags: string[];
  showMoneyByDefault: boolean;
  taxRelevant: boolean;
  businessRelevant: boolean;
}

export interface Person {
  id: string;
  name: string;
  relationship: string;
  notes?: string;
}

export interface DocumentRecord {
  id: string;
  type: DocumentType;
  title: string;
  date: string;
  linkedEventId?: string;
  linkedTransactionId?: string;
  tags: string[];
  retentionReason: string;
}

export interface NextBestMove {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  riskLevel: NextBestMoveRiskLevel;
  category: NextBestMoveCategory;
  disclaimer?: string;
}

export interface Discovery {
  id: string;
  title: string;
  description: string;
  evidence: string[];
  confidence: DiscoveryConfidence;
  relatedEventIds: string[];
  relatedTransactionIds: string[];
  nextBestMove?: NextBestMove;
}

export interface EventSummary {
  title: string;
  lifeBucket: LifeBucket;
  purpose: string;
  transactionCount: number;
  documentCount: number;
  moneyVisibility: "shown" | "hidden";
  totalAmount?: number;
  contextLine: string;
}
