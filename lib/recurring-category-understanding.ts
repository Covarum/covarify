import type {
  RecurringCommitment,
  RecurringCommitmentType,
} from "./recurring-commitments.ts";

export const INSURANCE_PARENT = {
  id: "10000000-0000-4000-8000-000000000013",
  name: "Insurance",
} as const;

export const INSURANCE_SUBCATEGORIES = [
  { id: "20000000-0000-4000-8000-000000000018", name: "Renters Insurance", aliases: ["renter insurance", "renters", "rental insurance", "renters policy"] },
  { id: "20000000-0000-4000-8000-000000000019", name: "Homeowners Insurance", aliases: ["homeowner insurance", "home insurance"] },
  { id: "20000000-0000-4000-8000-000000000020", name: "Auto Insurance", aliases: ["car insurance", "vehicle insurance"] },
  { id: "20000000-0000-4000-8000-000000000021", name: "Life Insurance", aliases: [] },
  { id: "20000000-0000-4000-8000-000000000022", name: "Health Insurance", aliases: ["medical insurance"] },
  { id: "20000000-0000-4000-8000-000000000023", name: "Disability Insurance", aliases: [] },
  { id: "20000000-0000-4000-8000-000000000024", name: "Pet Insurance", aliases: [] },
  { id: "20000000-0000-4000-8000-000000000025", name: "Other Insurance", aliases: ["insurance"] },
] as const;

export type RecurringCategoryProposal = {
  source: "deterministic_note" | "confirmed_type";
  evidence: string;
  parentCategoryId: string;
  parentCategory: string;
  subcategoryId: string;
  subcategory: string;
};

const normalize = (value: string) => value
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[’']/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/\brenters?\s+insurance\b/, "renters insurance");

export function deterministicInsuranceProposal(
  note?: string | null,
): RecurringCategoryProposal | null {
  const normalized = normalize(note || "");
  if (!normalized) return null;
  const matched = INSURANCE_SUBCATEGORIES.find((category) =>
    [category.name, ...category.aliases]
      .map(normalize)
      .some((phrase) => normalized === phrase),
  );
  if (!matched || matched.name === "Other Insurance") return null;
  return {
    source: "deterministic_note",
    evidence: note!.trim(),
    parentCategoryId: INSURANCE_PARENT.id,
    parentCategory: INSURANCE_PARENT.name,
    subcategoryId: matched.id,
    subcategory: matched.name,
  };
}

const weakCategory = (category: string) =>
  !category.trim() || /^(Other|Uncategorized)$/i.test(category.trim());

export function recurringCategoryProposal(
  commitment: Pick<
    RecurringCommitment,
    "decision" | "effectiveCategory" | "type"
  >,
): RecurringCategoryProposal | null {
  if (
    commitment.decision?.categoryResolution === "accepted" ||
    commitment.decision?.categoryResolution === "kept_current"
  ) return null;
  if (commitment.decision?.effectiveParentCategory) return null;
  const noteProposal = deterministicInsuranceProposal(
    commitment.decision?.userNote,
  );
  if (noteProposal && commitment.type === "insurance") return noteProposal;
  if (commitment.type === "insurance" && weakCategory(commitment.effectiveCategory)) {
    const other = INSURANCE_SUBCATEGORIES.at(-1)!;
    return {
      source: "confirmed_type",
      evidence: "Confirmed commitment type: Insurance",
      parentCategoryId: INSURANCE_PARENT.id,
      parentCategory: INSURANCE_PARENT.name,
      subcategoryId: other.id,
      subcategory: other.name,
    };
  }
  return null;
}

export const categoryParentForCommitmentType = (
  type: RecurringCommitmentType,
) => type === "insurance" ? INSURANCE_PARENT.name
  : type === "utility" ? "Housing"
    : type === "installment_loan" || type === "buy_now_pay_later" || type === "loan_payment"
      ? "Loan Payments"
      : null;

export const assistedCategoryProposalBoundary = (
  proposal: RecurringCategoryProposal | null,
) => proposal;
