import { normalizeMerchantName } from "./category-hierarchy.ts";

export const HOUSING_OBLIGATION_SUBCATEGORIES = ["Rent", "Mortgage"] as const;
export type HousingObligationType = "rent" | "mortgage";
export type ObligationPaymentType =
  | "full"
  | "partial"
  | "catch_up"
  | "late"
  | "extra"
  | "unsure";

export function housingObligationType(
  parentCategory: string | null | undefined,
  subcategory: string | null | undefined,
): HousingObligationType | null {
  if (parentCategory !== "Housing") return null;
  if (subcategory === "Rent") return "rent";
  if (subcategory === "Mortgage") return "mortgage";
  return null;
}

export function recurringObligationInput(input: {
  userId: string;
  transactionId: string;
  payee: string;
  type: HousingObligationType;
  actualPaymentAmount: number;
  paymentDate: string;
  expectedAmount?: number | null;
  dueDay?: number | null;
  ongoingStatus: "ongoing" | "ended" | "unsure";
  paymentType: ObligationPaymentType;
  remainingDue?: number | null;
}) {
  return {
    ...input,
    payee: input.payee.trim(),
    normalizedPayee: normalizeMerchantName(input.payee),
    expectedAmount: input.expectedAmount ?? null,
    dueDay: input.dueDay ?? null,
    remainingDue: input.remainingDue ?? null,
  };
}

export function summarizeObligationPayments(
  expectedAmount: number | null,
  payments: Array<{ actualPaymentAmount: number; remainingDue: number | null }>,
) {
  return {
    expectedAmount,
    actualPayments: payments.reduce((total, payment) => total + payment.actualPaymentAmount, 0),
    remainingDue: payments.some((payment) => payment.remainingDue != null)
      ? payments.at(-1)?.remainingDue ?? null
      : null,
  };
}
