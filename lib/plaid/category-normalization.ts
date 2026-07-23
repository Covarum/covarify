export type PersistedPlaidCategory = {
  primary: string | null;
  detailed: string | null;
  source:
    | "personal_finance_category"
    | "legacy_category"
    | "legacy_persisted_primary";
  legacy: string[] | null;
};

export function categoryFromPlaidTransaction(transaction: {
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
  category?: string[] | null;
}): PersistedPlaidCategory | null {
  const personal = transaction.personal_finance_category;
  if (personal?.primary || personal?.detailed) {
    return {
      primary: personal.primary || null,
      detailed: personal.detailed || null,
      source: "personal_finance_category",
      legacy: transaction.category?.length ? [...transaction.category] : null,
    };
  }

  if (transaction.category?.length) {
    return {
      primary: transaction.category[0] || null,
      detailed: transaction.category[1] || null,
      source: "legacy_category",
      legacy: [...transaction.category],
    };
  }

  return null;
}

export function normalizePersistedPlaidCategory(
  value: unknown,
): PersistedPlaidCategory | null {
  if (typeof value === "string" && value.trim()) {
    return {
      primary: value.trim(),
      detailed: null,
      source: "legacy_persisted_primary",
      legacy: null,
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const primary =
    typeof record.primary === "string" && record.primary.trim()
      ? record.primary.trim()
      : null;
  const detailed =
    typeof record.detailed === "string" && record.detailed.trim()
      ? record.detailed.trim()
      : null;
  const legacy = Array.isArray(record.legacy)
    ? record.legacy.filter((entry): entry is string => typeof entry === "string")
    : null;
  const source =
    record.source === "personal_finance_category" ||
    record.source === "legacy_category" ||
    record.source === "legacy_persisted_primary"
      ? record.source
      : "legacy_persisted_primary";

  return primary || detailed || legacy?.length
    ? { primary, detailed, source, legacy }
    : null;
}
