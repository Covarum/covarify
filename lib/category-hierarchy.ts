export type CategoryParent = {
  id: string;
  displayName: string;
  normalizedName: string;
  sourceKeys: string[];
};

export type CategorySubcategory = {
  id: string;
  userId: string | null;
  parentCategoryId: string;
  displayName: string;
  normalizedName: string;
  aliases: string[];
  categoryType: "system" | "user";
  status: "active" | "archived";
};

export const SYSTEM_CATEGORY_PARENTS: CategoryParent[] = [
  { id: "10000000-0000-4000-8000-000000000001", displayName: "Food & Drink", normalizedName: "food and drink", sourceKeys: ["FOOD_AND_DRINK"] },
  { id: "10000000-0000-4000-8000-000000000002", displayName: "Transportation", normalizedName: "transportation", sourceKeys: ["TRANSPORTATION"] },
  { id: "10000000-0000-4000-8000-000000000003", displayName: "Shopping", normalizedName: "shopping", sourceKeys: ["GENERAL_MERCHANDISE", "HOME_IMPROVEMENT"] },
  { id: "10000000-0000-4000-8000-000000000004", displayName: "Medical", normalizedName: "medical", sourceKeys: ["MEDICAL"] },
  { id: "10000000-0000-4000-8000-000000000005", displayName: "Travel", normalizedName: "travel", sourceKeys: ["TRAVEL"] },
  { id: "10000000-0000-4000-8000-000000000006", displayName: "Personal Care", normalizedName: "personal care", sourceKeys: ["PERSONAL_CARE"] },
  { id: "10000000-0000-4000-8000-000000000007", displayName: "Entertainment", normalizedName: "entertainment", sourceKeys: ["ENTERTAINMENT"] },
  { id: "10000000-0000-4000-8000-000000000008", displayName: "Housing", normalizedName: "housing", sourceKeys: ["RENT_AND_UTILITIES"] },
  { id: "10000000-0000-4000-8000-000000000009", displayName: "Income", normalizedName: "income", sourceKeys: ["INCOME"] },
  { id: "10000000-0000-4000-8000-000000000010", displayName: "Transfers", normalizedName: "transfers", sourceKeys: ["TRANSFER_IN", "TRANSFER_OUT"] },
  { id: "10000000-0000-4000-8000-000000000011", displayName: "Loan Payments", normalizedName: "loan payments", sourceKeys: ["LOAN_PAYMENTS"] },
  { id: "10000000-0000-4000-8000-000000000012", displayName: "Other", normalizedName: "other", sourceKeys: ["GENERAL_SERVICES", "GOVERNMENT_AND_NON_PROFIT", "BANK_FEES", "OTHER", "UNCATEGORIZED"] },
  { id: "10000000-0000-4000-8000-000000000013", displayName: "Insurance", normalizedName: "insurance", sourceKeys: ["INSURANCE"] },
];

const protectedDistinctPairs = new Set([
  "bar|liquor", "liquor|bar",
  "restaurant|fast food", "fast food|restaurant",
  "food|grocery", "grocery|food",
]);

const singularize = (value: string) => {
  const words = value.split(" ");
  const last = words.at(-1) || "";
  const singular = last === "groceries" ? "grocery"
    : last.endsWith("ies") && last.length > 4 ? `${last.slice(0, -3)}y`
      : last.endsWith("s") && !last.endsWith("ss") && last.length > 3 ? last.slice(0, -1)
        : last;
  return [...words.slice(0, -1), singular].join(" ");
};

export const normalizeCategoryName = (value: string) => singularize(value
  .normalize("NFKD")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim());

export const normalizeMerchantName = (value: string) => value
  .normalize("NFKD")
  .toUpperCase()
  .replace(/[^A-Z0-9 ]/g, " ")
  .replace(/\b(PURCHASE|AUTHORIZATION|DEBIT|POS|PENDING|PAYMENT|THE)\b/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export function parentForSourceCategory(sourceCategory: string) {
  const normalized = sourceCategory.toUpperCase().replace(/[\s-]+/g, "_");
  return SYSTEM_CATEGORY_PARENTS.find((parent) => parent.sourceKeys.includes(normalized))
    || SYSTEM_CATEGORY_PARENTS.at(-1)!;
}

export function categoryKeyForParent(parent: CategoryParent) {
  return parent.sourceKeys[0] || "OTHER";
}

export function suggestSubcategories(
  requestedName: string,
  parentCategoryId: string,
  available: CategorySubcategory[],
) {
  const requested = normalizeCategoryName(requestedName);
  return available
    .filter((category) => category.parentCategoryId === parentCategoryId && category.status === "active")
    .map((category) => {
      const name = normalizeCategoryName(category.normalizedName || category.displayName);
      const aliases = category.aliases.map(normalizeCategoryName);
      const exact = requested === name;
      const alias = aliases.includes(requested);
      const distinct = protectedDistinctPairs.has(`${requested}|${name}`);
      return { category, score: exact ? 100 : alias && !distinct ? 90 : 0, match: exact ? "exact" as const : "alias" as const };
    })
    .filter((suggestion) => suggestion.score > 0)
    .sort((a, b) => b.score - a.score || a.category.displayName.localeCompare(b.category.displayName))
    .slice(0, 3);
}

export function requestedSubcategoryFromText(text: string) {
  const trimmed = text.trim().replace(/[.!?]+$/, "");
  const patterns = [
    /\b(?:classify|understand|treat)\s+(?:it|this|that)?\s*(?:more specifically\s+)?as\s+(.+)$/i,
    /\b(?:was|is)\s+(.+)$/i,
    /^that was\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return normalizeRequestedCategoryPhrase(match[1]);
  }
  return trimmed.split(/\s+/).length <= 4
    ? normalizeRequestedCategoryPhrase(trimmed)
    : null;
}

export function normalizeRequestedCategoryPhrase(value: string) {
  const normalized = value
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/^(?:from now on,?\s+|always\s+|usually\s+)+/i, "")
    .replace(/\s+(?:from now on|every time|in the future|going forward)$/i, "")
    .trim();
  return normalized || null;
}
