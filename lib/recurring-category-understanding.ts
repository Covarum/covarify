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

export const BUSINESS_CATEGORY = {
  parentCategoryId: "10000000-0000-4000-8000-000000000014",
  parentCategory: "Business",
  subcategoryId: "20000000-0000-4000-8000-000000000026",
  subcategory: "Software & Services",
} as const;
export const GIFTS_CATEGORY = { parentCategoryId: "10000000-0000-4000-8000-000000000003", parentCategory: "Shopping", subcategoryId: "20000000-0000-4000-8000-000000000015", subcategory: "Gifts" } as const;

export type RecurringContextProposal = {
  evidence: string;
  service: "Calendar booking software/service" | null;
  namedEntity: string | null;
  contextType: "person" | "business" | "project" | "other";
  purpose: string | null;
  proposedType: "software_service" | null;
  proposedCategory: typeof BUSINESS_CATEGORY | typeof GIFTS_CATEGORY | null;
  nextQuestion: "entity_relationship" | "person_relationship" | "business_use" | "classification" | "supporting_transactions" | "merchant_memory" | null;
};

const generalNote = /^(?:check this later|called customer service|not sure why this increased)[.!]?$/i;

export function recurringContextProposal(
  commitment: Pick<RecurringCommitment, "displayName" | "decision">,
): RecurringContextProposal | null {
  const note = commitment.decision?.userNote?.trim();
  if (!note || generalNote.test(note) || commitment.decision?.contextComplete) return null;
  const calendly = /\bcalendly\b/i.test(commitment.displayName) || /\bcalendar booking (?:app|software|service)\b/i.test(note);
  const gift = /\b(?:(birthday|christmas|holiday|anniversary|wedding|graduation|baby shower)\s+)?gift\s+for\s+([A-Z][A-Za-z'’-]{1,40})\b/i.exec(note);
  const possessivePerson = /\b([A-Z][A-Za-z'’-]{1,40})[’']s\s+(?:shoes|subscription)\b/.exec(note);
  const relationshipPerson = /\bfor my\s+(son|daughter|child|spouse|partner|friend)\b/i.exec(note);
  const project = /\bfor\s+(?:my side project|a personal project|my hobby|school)\b/i.test(note);
  const explicitBusiness = /\b(?:for my business|for work|business software|company expense|client expense|office expense|for .+? LLC|for the (?:business|company))\b/i.test(note);
  const entity = gift?.[2] || possessivePerson?.[1] || relationshipPerson?.[1] || note.match(/\bfor\s+([A-Z][A-Za-z0-9&.' -]{1,60})[.!]?$/)?.[1]?.trim() || null;
  const contextType = gift || possessivePerson || relationshipPerson ? "person" as const : project ? "project" as const : explicitBusiness || calendly ? "business" as const : "other" as const;
  const descriptive = calendly || project || Boolean(gift || possessivePerson || relationshipPerson) || /\b(?:business software|booking app|software|service subscription)\b/i.test(note) || Boolean(entity);
  if (!descriptive) return null;
  const decision = commitment.decision;
  const nextQuestion = entity && !decision?.contextRelationship
    ? contextType === "person" ? "person_relationship" : contextType === "business" ? "entity_relationship" : "business_use"
    : contextType === "business" && decision?.businessUse == null
      ? "business_use"
      : !decision?.effectiveParentCategory
        ? "classification"
        : !decision.supportingTransactionsClassified
          ? "supporting_transactions"
          : "merchant_memory";
  return {
    evidence: note,
    service: calendly ? "Calendar booking software/service" : null,
    namedEntity: entity || decision?.contextEntityName || null,
    contextType,
    purpose: gift ? `${gift[1] ? `${gift[1][0].toUpperCase()}${gift[1].slice(1).toLowerCase()} ` : ""}gift` : calendly ? "Calendar booking" : decision?.contextPurpose || null,
    proposedType: calendly ? "software_service" : null,
    proposedCategory: gift ? GIFTS_CATEGORY : calendly ? BUSINESS_CATEGORY : null,
    nextQuestion,
  };
}

export function assistedContextProposalBoundary(
  proposal: RecurringContextProposal | null,
) {
  return proposal;
}

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
