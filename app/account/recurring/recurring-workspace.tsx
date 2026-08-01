"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  amountDescription,
  filterRecurringCommitments,
  money,
  reconcileSupportingTransactions,
  recurringCommitmentSummary,
  type RecurringCommitment,
  type RecurringCommitmentDecision,
  type RecurringCommitmentStatusFilter,
} from "@/lib/recurring-commitments";
import type { ResolvedFinancialPeriod } from "@/lib/financial-periods";
import {
  formatCategoryLabel,
  formatTransactionCategoryPath,
  formatTransactionDisplayAmount,
  type MoneyTransaction,
} from "@/lib/money-picture";
import {
  saveRecurringCommitmentDecision,
  saveRecurringCommitmentCategoryDecision,
  saveRecurringCommitmentContextDecision,
  undoRecurringCommitmentDecision,
  type RecurringReviewActionState,
} from "./actions";
import {
  INSURANCE_SUBCATEGORIES,
  BUSINESS_CATEGORY,
  type RecurringCategoryProposal,
  type RecurringContextProposal,
} from "@/lib/recurring-category-understanding";
import styles from "./recurring.module.css";

type RecurringData = {
  commitments: RecurringCommitment[];
  summary: ReturnType<typeof recurringCommitmentSummary>;
  syncPending: boolean;
  coverage: string;
  period: ResolvedFinancialPeriod;
};

type Notice = {
  title: "Saved" | "Undone" | "Undo unavailable";
  patternKey: string;
  message: string;
  labels: string[];
};

const typeLabel: Record<RecurringCommitment["type"], string> = {
  subscription: "Subscription",
  utility: "Utility",
  insurance: "Insurance",
  membership: "Membership",
  software_service: "Software or service",
  installment_loan: "Installment payment",
  buy_now_pay_later: "Buy now, pay later",
  loan_payment: "Loan payment",
  recurring_transfer: "Recurring transfer",
  other_recurring: "Other recurring",
  unknown_recurring: "Unknown recurring",
};

const detectedTypeLabel = (commitment: RecurringCommitment) => {
  if (
    !commitment.decision?.commitmentType &&
    ["installment_loan", "buy_now_pay_later"].includes(commitment.detectedType)
  ) {
    return "Possible installment payment";
  }
  return typeLabel[commitment.type];
};

const initialRecurringReviewActionState: RecurringReviewActionState = {
  status: "idle",
  error: null,
  patternKey: null,
  decision: null,
  commitment: null,
  destination: null,
  message: null,
  savedLabels: [],
  categoryProposal: null,
  contextProposal: null,
};

const defaultDecision = (
  commitment: RecurringCommitment,
): RecurringCommitmentDecision => ({
  recurringStatus: commitment.decision?.recurringStatus || "possible",
  recognitionStatus: commitment.decision?.recognitionStatus || "unsure",
  disposition: commitment.decision?.disposition || "unsure",
  commitmentType: commitment.decision?.commitmentType || null,
  ownerLabel: commitment.decision?.ownerLabel || "Not sure",
  userNote: commitment.decision?.userNote || null,
  identityNote: commitment.decision?.identityNote || null,
  loginStatus: commitment.decision?.loginStatus || "unsure",
  duplicateDecision: commitment.decision?.duplicateDecision || null,
  manualOriginalPurpose: commitment.decision?.manualOriginalPurpose || null,
  manualCurrentBalance: commitment.decision?.manualCurrentBalance ?? null,
  manualOriginalAmount: commitment.decision?.manualOriginalAmount ?? null,
  manualPaymentsRemaining: commitment.decision?.manualPaymentsRemaining ?? null,
  manualNextPaymentDate: commitment.decision?.manualNextPaymentDate || null,
  effectiveParentCategoryId: commitment.decision?.effectiveParentCategoryId || null,
  effectiveSubcategoryId: commitment.decision?.effectiveSubcategoryId || null,
  effectiveParentCategory: commitment.decision?.effectiveParentCategory || null,
  effectiveSubcategory: commitment.decision?.effectiveSubcategory || null,
  categoryResolution: commitment.decision?.categoryResolution || null,
  supportingTransactionsClassified:
    commitment.decision?.supportingTransactionsClassified || false,
  contextOwnerKind: commitment.decision?.contextOwnerKind || null,
  contextEntityName: commitment.decision?.contextEntityName || null,
  contextRelationship: commitment.decision?.contextRelationship || null,
  contextPurpose: commitment.decision?.contextPurpose || null,
  businessUse: commitment.decision?.businessUse ?? null,
  contextComplete: commitment.decision?.contextComplete || false,
  merchantMemoryCreated: commitment.decision?.merchantMemoryCreated || false,
});

const decisionSignature = (decision: RecurringCommitmentDecision) =>
  JSON.stringify(decision);

function ChoiceGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: Array<{ value: T; label: string; help?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.stage}>
      <legend>{legend}</legend>
      <div className={styles.choices}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={selected ? styles.selectedChoice : undefined}
              onClick={() => onChange(option.value)}
            >
              <span aria-hidden="true">{selected ? "✓" : "○"}</span>
              <span>
                <strong>{option.label}</strong>
                {option.help ? <small>{option.help}</small> : null}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function ReviewForm({
  commitment,
  onSaved,
}: {
  commitment: RecurringCommitment;
  onSaved: (state: RecurringReviewActionState) => void;
}) {
  const initial = useMemo(() => defaultDecision(commitment), [commitment]);
  const [draft, setDraft] = useState(initial);
  const [typeChoice, setTypeChoice] = useState<"suggested" | "other" | "unsure">(
    commitment.decision?.commitmentType
      ? commitment.decision.commitmentType === commitment.detectedType
        ? "suggested"
        : "other"
      : "unsure",
  );
  const [touched, setTouched] = useState(false);
  const [categoryChoice, setCategoryChoice] = useState<string>("");
  const [transactionScope, setTransactionScope] =
    useState<"transactions" | "commitment" | "not_now">("not_now");
  const [categorySaving, startCategorySave] = useTransition();
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [contextFollowup, setContextFollowup] = useState<RecurringContextProposal | null>(null);
  const [contextSaving, startContextSave] = useTransition();
  const [contextError, setContextError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    saveRecurringCommitmentDecision,
    initialRecurringReviewActionState,
  );
  const handledState = useRef<RecurringReviewActionState | null>(null);
  const categoryProposal: RecurringCategoryProposal | null =
    state.categoryProposal;
  const contextProposal = contextFollowup || state.contextProposal;
  const selectedCategoryId =
    categoryChoice || categoryProposal?.subcategoryId || "";
  const changed = touched || decisionSignature(draft) !== decisionSignature(initial);
  const identityEligible = ["subscription", "membership", "software_service"].includes(
    commitment.type,
  );
  const installment = ["installment_loan", "buy_now_pay_later"].includes(
    commitment.type,
  );

  useEffect(() => {
    if (state.status !== "saved" || handledState.current === state) return;
    handledState.current = state;
    if (state.categoryProposal || state.contextProposal) {
      return;
    }
    onSaved(state);
  }, [onSaved, state]);

  const resolveCategory = (resolution: "accepted" | "kept_current") => {
    if (!categoryProposal) return;
    const selected =
      INSURANCE_SUBCATEGORIES.find((item) => item.id === selectedCategoryId) ||
      INSURANCE_SUBCATEGORIES[0];
    setCategoryError(null);
    startCategorySave(async () => {
      const result = await saveRecurringCommitmentCategoryDecision({
        patternKey: commitment.patternKey,
        resolution,
        parentCategoryId: categoryProposal.parentCategoryId,
        parentCategory: categoryProposal.parentCategory,
        subcategoryId: selected.id,
        subcategory: selected.name,
        applyToSupportingTransactions:
          resolution === "accepted" && transactionScope === "transactions",
      });
      if (result.status === "saved") {
        onSaved(result);
      } else {
        setCategoryError(result.error);
      }
    });
  };

  const answerContext = (
    answer: Omit<Parameters<typeof saveRecurringCommitmentContextDecision>[0], "patternKey">,
  ) => {
    setContextError(null);
    startContextSave(async () => {
      const result = await saveRecurringCommitmentContextDecision({ ...answer, patternKey: commitment.patternKey });
      if (result.status !== "saved") setContextError(result.error);
      else if (result.contextProposal?.nextQuestion) setContextFollowup(result.contextProposal);
      else onSaved(result);
    });
  };

  const answerSupportingTransactions = (apply: boolean) => {
    startContextSave(async () => {
      const result = await saveRecurringCommitmentCategoryDecision({
        patternKey: commitment.patternKey,
        resolution: "accepted",
        ...BUSINESS_CATEGORY,
        applyToSupportingTransactions: apply,
      });
      if (result.status !== "saved") setContextError(result.error);
      else if (contextProposal) setContextFollowup({ ...contextProposal, nextQuestion: "merchant_memory" });
    });
  };

  const update = <K extends keyof RecurringCommitmentDecision>(
    key: K,
    value: RecurringCommitmentDecision[K],
  ) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <form action={formAction} className={styles.reviewForm}>
      <input type="hidden" name="patternKey" value={commitment.patternKey} />
      <input type="hidden" name="recurringStatus" value={draft.recurringStatus} />
      <input type="hidden" name="recognitionStatus" value={draft.recognitionStatus} />
      <input type="hidden" name="disposition" value={draft.disposition} />

      {contextProposal ? (
        <section className={styles.categoryProposal} aria-live="polite">
          <p>You told Covarify that {commitment.displayName} is {contextProposal.evidence}.</p>
          {contextProposal.service ? <strong>Possible service: {contextProposal.service}</strong> : null}
          {contextProposal.nextQuestion === "entity_relationship" ? (
            <fieldset><legend>Is {contextProposal.namedEntity} a business you own or work for?</legend>
              <button type="button" disabled={contextSaving} onClick={() => answerContext({ relationship: "owner" })}>My business</button>
              <button type="button" disabled={contextSaving} onClick={() => answerContext({ relationship: "employee" })}>A business I work for</button>
              <button type="button" disabled={contextSaving} onClick={() => answerContext({ relationship: "other", businessUse: false })}>Personal project</button>
              <button type="button" disabled={contextSaving} onClick={() => answerContext({ relationship: "other" })}>Something else</button>
              <button type="button" disabled={contextSaving} onClick={() => answerContext({ relationship: "other" })}>Not sure</button>
            </fieldset>
          ) : null}
          {contextProposal.nextQuestion === "business_use" ? (
            <fieldset><legend>Should {commitment.displayName} be treated as a business-related expense?</legend>
              <button type="button" disabled={contextSaving} onClick={() => answerContext({ businessUse: true })}>Yes</button>
              <button type="button" disabled={contextSaving} onClick={() => answerContext({ businessUse: false })}>No</button>
            </fieldset>
          ) : null}
          {contextProposal.nextQuestion === "classification" && contextProposal.proposedCategory ? (
            <fieldset><legend>Would you like Covarify to classify this as business software?</legend>
              <strong>{BUSINESS_CATEGORY.parentCategory} → {BUSINESS_CATEGORY.subcategory}</strong>
              <button type="button" disabled={contextSaving} onClick={() => answerContext({ acceptBusinessClassification: true })}>Use this classification</button>
              <button type="button" disabled={contextSaving} onClick={() => answerContext({ acceptBusinessClassification: false })}>Keep current classification</button>
            </fieldset>
          ) : null}
          {contextProposal.nextQuestion === "supporting_transactions" ? <fieldset><legend>Use this business classification for the supporting {commitment.displayName} transactions too?</legend>
            <button type="button" disabled={contextSaving} onClick={() => answerSupportingTransactions(true)}>Yes, update these transactions</button>
            <button type="button" disabled={contextSaving} onClick={() => answerSupportingTransactions(false)}>Use only for this commitment</button>
          </fieldset> : null}
          {contextProposal.nextQuestion === "merchant_memory" ? <fieldset><legend>Remember this for future {commitment.displayName} charges?</legend>
            <button type="button" disabled={contextSaving} onClick={() => answerContext({ rememberMerchant: true, complete: true })}>Yes, remember it</button>
            <button type="button" disabled={contextSaving} onClick={() => answerContext({ rememberMerchant: false, complete: true })}>Not now</button>
          </fieldset> : null}
          {contextError ? <p className={styles.inlineError}>{contextError}</p> : null}
        </section>
      ) : null}
      {categoryProposal ? (
        <section className={styles.categoryProposal} aria-live="polite">
          <p>
            {categoryProposal.source === "deterministic_note"
              ? `You described this as ${categoryProposal.evidence}.`
              : `This is marked as Insurance, but its category is still ${commitment.effectiveCategory}.`}
          </p>
          <strong>
            Suggested classification: {categoryProposal.parentCategory} →{" "}
            {INSURANCE_SUBCATEGORIES.find((item) => item.id === selectedCategoryId)?.name}
          </strong>
          <label>
            Choose another category
            <select
              value={selectedCategoryId}
              onChange={(event) => setCategoryChoice(event.target.value)}
            >
              {INSURANCE_SUBCATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>
              Use this classification for the supporting{" "}
              {commitment.displayName} transactions too?
            </legend>
            <label><input type="radio" name={`scope-${commitment.patternKey}`} checked={transactionScope === "transactions"} onChange={() => setTransactionScope("transactions")} /> Yes, apply to these transactions</label>
            <label><input type="radio" name={`scope-${commitment.patternKey}`} checked={transactionScope === "commitment"} onChange={() => setTransactionScope("commitment")} /> Use only for this commitment</label>
            <label><input type="radio" name={`scope-${commitment.patternKey}`} checked={transactionScope === "not_now"} onChange={() => setTransactionScope("not_now")} /> Not now</label>
          </fieldset>
          {categoryError ? <p className={styles.inlineError}>{categoryError}</p> : null}
          <div className={styles.quickActions}>
            <button type="button" className={styles.primary} disabled={categorySaving} onClick={() => resolveCategory("accepted")}>
              Use this classification
            </button>
            <button type="button" disabled={categorySaving} onClick={() => resolveCategory("kept_current")}>
              Keep current classification
            </button>
          </div>
        </section>
      ) : null}

      <ChoiceGroup
        legend="1. What is this charge?"
        value={typeChoice}
        onChange={(value) => {
          setTouched(true);
          setTypeChoice(value);
          if (value === "suggested") update("commitmentType", commitment.detectedType);
          if (value === "unsure") update("commitmentType", null);
        }}
        options={[
          {
            value: "suggested",
            label: `Use ${typeLabel[commitment.detectedType]}`,
            help: "Suggested from posted-payment evidence.",
          },
          { value: "other", label: "Choose another type" },
          { value: "unsure", label: "Not sure" },
        ]}
      />
      <p className={styles.caution}>
        Suggested type: <strong>{typeLabel[commitment.detectedType]}</strong>
      </p>
      {typeChoice === "other" ? (
        <label className={styles.typePicker}>
          Choose a type
          <select
            name="commitmentType"
            value={draft.commitmentType || "unknown_recurring"}
            onChange={(event) =>
              update(
                "commitmentType",
                event.target.value as RecurringCommitmentDecision["commitmentType"],
              )
            }
          >
            {Object.entries(typeLabel)
              .filter(([value]) => value !== "unknown_recurring")
              .map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
          </select>
        </label>
      ) : (
        <input
          type="hidden"
          name="commitmentType"
          value={draft.commitmentType || ""}
        />
      )}

      <ChoiceGroup
        legend="2. Does this payment still repeat?"
        value={draft.recurringStatus}
        onChange={(value) => {
          update("recurringStatus", value);
          if (value === "completed") update("disposition", "unsure");
        }}
        options={[
          { value: "confirmed", label: "Yes, it is active" },
          { value: "completed", label: "No, it is finished" },
          { value: "possible", label: "I’m not sure" },
        ]}
      />

      <ChoiceGroup
        legend="3. Do you recognize it?"
        value={draft.recognitionStatus}
        onChange={(value) => {
          update("recognitionStatus", value);
          if (value === "unsure") {
            update("disposition", "unsure");
          } else if (value === "unrecognized" && draft.disposition === "keep") {
            update("disposition", "unsure");
          }
        }}
        options={[
          { value: "recognized", label: "Yes, I recognize it" },
          { value: "unrecognized", label: "No, I don’t recognize it" },
          { value: "unsure", label: "Not sure" },
        ]}
      />

      {draft.recognitionStatus === "recognized" ? (
        <ChoiceGroup
          legend="4. What would you like to do?"
          value={draft.disposition}
          onChange={(value) => update("disposition", value)}
          options={[
            { value: "keep", label: "Keep" },
            { value: "review", label: "Review later" },
            ...(draft.recurringStatus === "completed"
              ? []
              : [{
                  value: "cancellation_requested" as const,
                  label: "Mark for cancellation",
                  help: "Covarify will not cancel the service.",
                }]),
            { value: "unsure", label: "Not sure" },
          ]}
        />
      ) : null}

      {draft.recognitionStatus === "unrecognized" ? (
        <ChoiceGroup
          legend="4. What would you like to do next?"
          value={draft.disposition}
          onChange={(value) => update("disposition", value)}
          options={[
            { value: "review", label: "I may need to investigate this" },
            ...(draft.recurringStatus === "completed"
              ? []
              : [{
                  value: "cancellation_requested" as const,
                  label: "Mark for cancellation",
                  help: "This records intent only and does not report fraud or cancel anything.",
                }]),
            { value: "unsure", label: "Not sure" },
          ]}
        />
      ) : null}

      <div className={styles.editor}>
        <label>
          Owner
          <select
            name="ownerLabel"
            value={draft.ownerLabel || "Not sure"}
            onChange={(event) =>
              update(
                "ownerLabel",
                event.target.value as RecurringCommitmentDecision["ownerLabel"],
              )
            }
          >
            {["Mine", "Household", "Business", "Someone else", "Not sure"].map(
              (owner) => (
                <option key={owner}>{owner}</option>
              ),
            )}
          </select>
        </label>
        <label className={styles.wide}>
          Note
          <textarea
            name="userNote"
            maxLength={1000}
            value={draft.userNote || ""}
            onChange={(event) => update("userNote", event.target.value || null)}
          />
        </label>
        {identityEligible ? (
          <fieldset className={styles.wide}>
            <legend>Need help identifying the account?</legend>
            <p>Covarify can help you keep track of which account this charge belongs to.</p>
            <label>
              Login or account status
              <select
                name="loginStatus"
                value={draft.loginStatus || "unsure"}
                onChange={(event) =>
                  update(
                    "loginStatus",
                    event.target.value as RecurringCommitmentDecision["loginStatus"],
                  )
                }
              >
                <option value="known">I know the account</option>
                <option value="cannot_find">I can’t find the login</option>
                <option value="belongs_to_someone_else">Belongs to someone else</option>
                <option value="unsure">Not sure</option>
              </select>
            </label>
            <label>
              Email, username, or account description
              <input
                name="identityNote"
                maxLength={500}
                value={draft.identityNote || ""}
                onChange={(event) => update("identityNote", event.target.value || null)}
                autoComplete="off"
              />
            </label>
            <small>Do not enter a password or security code.</small>
          </fieldset>
        ) : null}
        {installment ? (
          <details className={`${styles.wide} ${styles.installmentDetails}`}>
            <summary>Add installment details</summary>
            <div>
              <p>These values are labeled “Provided by you” and are not treated as live provider data.</p>
              <label>
                Purchase or purpose
                <input
                  name="manualOriginalPurpose"
                  value={draft.manualOriginalPurpose || ""}
                  onChange={(event) =>
                    update("manualOriginalPurpose", event.target.value || null)
                  }
                />
              </label>
              <label>
                Current balance
                <input
                  name="manualCurrentBalance"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.manualCurrentBalance ?? ""}
                  onChange={(event) =>
                    update(
                      "manualCurrentBalance",
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                />
              </label>
              <label>
                Original financed amount
                <input
                  name="manualOriginalAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.manualOriginalAmount ?? ""}
                  onChange={(event) =>
                    update(
                      "manualOriginalAmount",
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                />
              </label>
              <label>
                Payments remaining
                <input
                  name="manualPaymentsRemaining"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.manualPaymentsRemaining ?? ""}
                  onChange={(event) =>
                    update(
                      "manualPaymentsRemaining",
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                />
              </label>
              <label>
                Next payment date
                <input
                  name="manualNextPaymentDate"
                  type="date"
                  value={draft.manualNextPaymentDate || ""}
                  onChange={(event) =>
                    update("manualNextPaymentDate", event.target.value || null)
                  }
                />
              </label>
            </div>
          </details>
        ) : null}
        {commitment.attentionReasons.some((reason) =>
          reason.toLowerCase().includes("duplicate"),
        ) ? (
          <label>
            Possible duplicate
            <select
              name="duplicateDecision"
              value={draft.duplicateDecision || ""}
              onChange={(event) =>
                update(
                  "duplicateDecision",
                  event.target.value as RecurringCommitmentDecision["duplicateDecision"],
                )
              }
            >
              <option value="">Not answered</option>
              <option value="separate">These are separate</option>
              <option value="review">Review</option>
              <option value="unrecognized_one">I don’t recognize one</option>
            </select>
          </label>
        ) : null}
      </div>

      {state.status === "error" ? (
        <p className={styles.inlineError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.status === "saved" ? (
        <div className={styles.savedConfirmation} role="status">
          <strong>Saved</strong>
          <ul>{state.savedLabels.map((label) => <li key={label}>{label}</li>)}</ul>
          <p>{state.message}</p>
        </div>
      ) : null}
      <button
        type="submit"
        className={styles.primary}
        disabled={!changed || pending || state.status === "saved" || Boolean(categoryProposal) || Boolean(contextProposal)}
      >
        {pending ? "Saving…" : state.status === "saved" ? "Saved" : "Save"}
      </button>
    </form>
  );
}

function CommitmentCard({
  commitment,
  onSaved,
}: {
  commitment: RecurringCommitment;
  onSaved: (state: RecurringReviewActionState) => void;
}) {
  const { available, missingCount } = reconcileSupportingTransactions(commitment);
  const [selectedTransaction, setSelectedTransaction] =
    useState<MoneyTransaction | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const row = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selectedTransaction) closeButton.current?.focus();
  }, [selectedTransaction]);

  const closeTransaction = () => {
    setSelectedTransaction(null);
    requestAnimationFrame(() => opener.current?.focus());
  };

  const completeSave = (state: RecurringReviewActionState) => {
    setSelectedTransaction(null);
    window.setTimeout(() => {
      setOpen(false);
      onSaved(state);
      requestAnimationFrame(() => row.current?.focus());
    }, 900);
  };

  return (
    <article ref={row} tabIndex={-1} className={styles.card} id={`commitment-${commitment.patternKey}`}>
      <header>
        <div>
          <span className={styles.kind}>{detectedTypeLabel(commitment)}</span>
          <h3>{commitment.displayName}</h3>
          <p>{amountDescription(commitment)}</p>
        </div>
        <span className={styles.status}>
          {commitment.status === "confirmed"
            ? "Active"
            : commitment.status === "completed"
              ? "Completed"
              : commitment.status.replace("_", " ")}
        </span>
      </header>
      <dl className={styles.facts}>
        <div><dt>Last charge</dt><dd>{commitment.lastObserved} · {money(commitment.lastAmount)}</dd></div>
        <div><dt>Payment account</dt><dd>{commitment.paymentAccountLabel}</dd></div>
        <div><dt>Type</dt><dd>{detectedTypeLabel(commitment)}</dd></div>
        <div><dt>Category</dt><dd>{commitment.effectiveCategory}</dd></div>
        <div>
          <dt>Evidence</dt>
          <dd>Detected from {commitment.supportingTransactionIds.length} posted payments</dd>
        </div>
        {commitment.nextExpected ? <div><dt>Next</dt><dd>Expected around {commitment.nextExpected}</dd></div> : null}
        {commitment.decision?.ownerLabel ? <div><dt>Owner</dt><dd>{commitment.decision.ownerLabel}</dd></div> : null}
      </dl>
      {commitment.attentionReasons.length ? (
        <div className={styles.attention}>
          <strong>Why this may need attention</strong>
          {commitment.attentionReasons.map((reason) => <p key={reason}>{reason}</p>)}
        </div>
      ) : null}
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>Review commitment</summary>
        {open ? <div className={styles.detail}>
          <section>
            <h4>What Covarify noticed</h4>
            <p>{commitment.confidenceExplanation}</p>
            <p>This is a detected pattern, not a user-confirmed fact.</p>
          </section>
          <ReviewForm commitment={commitment} onSaved={completeSave} />
          <section id={`transactions-${commitment.patternKey}`} className={styles.transactions}>
            <h4>Supporting transactions</h4>
            <p>
              Supporting charges for {commitment.displayName} ({commitment.cadence}) from{" "}
              {commitment.firstObserved} through {commitment.lastObserved}.
            </p>
            {available.length ? <ul>
              {available.map((transaction) => {
                const amount = formatTransactionDisplayAmount(transaction);
                return (
                  <li key={transaction.id}>
                    <span><strong>{transaction.name}</strong><small>{transaction.date} · {transaction.accountLabel}</small></span>
                    <span className={styles.transactionActions}>
                      <strong>
                        <span className="sr-only">{amount.accessibleText}</span>
                        <span aria-hidden="true">{amount.displayAmount}</span>
                      </strong>
                      <button
                        type="button"
                        onClick={(event) => {
                          opener.current = event.currentTarget;
                          setSelectedTransaction(transaction);
                        }}
                      >
                        Review transaction
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul> : null}
            {missingCount ? (
              <p className={styles.unavailable} role="status">
                {missingCount === 1
                  ? "This supporting transaction is no longer available."
                  : "One or more supporting transactions are no longer available."}
              </p>
            ) : null}
            {selectedTransaction ? (
              <div
                className={styles.transactionDialog}
                role="dialog"
                aria-modal="false"
                aria-labelledby={`transaction-title-${selectedTransaction.id}`}
              >
                <div className={styles.transactionDialogHeader}>
                  <div>
                    <span>Supporting transaction</span>
                    <h5 id={`transaction-title-${selectedTransaction.id}`}>
                      {selectedTransaction.name}
                    </h5>
                  </div>
                  <button ref={closeButton} type="button" onClick={closeTransaction}>
                    Close
                  </button>
                </div>
                <dl>
                  <div><dt>Amount</dt><dd>{formatTransactionDisplayAmount(selectedTransaction).displayAmount}</dd></div>
                  <div><dt>Date</dt><dd>{selectedTransaction.date}</dd></div>
                  <div><dt>Account</dt><dd>{selectedTransaction.accountLabel}</dd></div>
                  <div>
                    <dt>Source category</dt>
                    <dd>{formatCategoryLabel(selectedTransaction.sourceCategory || selectedTransaction.category) || "Uncategorized"}</dd>
                  </div>
                  <div>
                    <dt>Effective classification</dt>
                    <dd>{formatTransactionCategoryPath(selectedTransaction)}</dd>
                  </div>
                </dl>
                <button type="button" onClick={closeTransaction}>
                  Back to {commitment.displayName}
                </button>
              </div>
            ) : null}
          </section>
        </div> : null}
      </details>
    </article>
  );
}

function CommitmentSection({
  id,
  title,
  items,
  onSaved,
}: {
  id: string;
  title: string;
  items: RecurringCommitment[];
  onSaved: (state: RecurringReviewActionState) => void;
}) {
  if (!items.length) return null;
  return (
    <section className={styles.section} id={id} tabIndex={-1}>
      <header><h2>{title}</h2><span>{items.length}</span></header>
      <div className={styles.cards}>
        {items.map((item) => (
          <CommitmentCard key={item.patternKey} commitment={item} onSaved={onSaved} />
        ))}
      </div>
    </section>
  );
}

export function RecurringCommitmentsWorkspace({
  initialData,
  initialQuery,
}: {
  initialData: RecurringData;
  initialQuery: { search: string; status: string; commitment: string | null };
}) {
  const router = useRouter();
  const [commitments, setCommitments] = useState(initialData.commitments);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState(initialQuery.search);
  const [status, setStatus] = useState<RecurringCommitmentStatusFilter>(
    ["needs_attention", "confirmed", "possible", "completed"].includes(initialQuery.status)
      ? initialQuery.status as RecurringCommitmentStatusFilter
      : "all",
  );
  const [undoing, startUndo] = useTransition();
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summary = useMemo(
    () => recurringCommitmentSummary(commitments),
    [commitments],
  );
  const attention = commitments.filter((item) => item.status === "needs_attention");
  const confirmed = commitments.filter((item) => item.status === "confirmed");
  const possible = commitments.filter((item) => item.status === "possible");
  const completed = commitments.filter((item) => item.status === "completed");
  const filtered = useMemo(() => filterRecurringCommitments(commitments, {
    period: initialData.period,
    search,
    status,
  }), [commitments, initialData.period, search, status]);
  const filtering = Boolean(search.trim()) || status !== "all";

  useEffect(
    () => () => {
      if (moveTimer.current) clearTimeout(moveTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 9000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!initialQuery.commitment) return;
    requestAnimationFrame(() =>
      document.getElementById(`commitment-${initialQuery.commitment}`)?.focus(),
    );
  }, [initialQuery.commitment]);

  const applyResult = (state: RecurringReviewActionState) => {
    if (state.status !== "saved" || !state.patternKey || !state.message) return;
    setNotice({
      title: "Saved",
      patternKey: state.patternKey,
      message: state.message,
      labels: state.savedLabels,
    });
    setCommitments((current) => {
      const remaining = current.filter((item) => item.patternKey !== state.patternKey);
      return state.commitment ? [...remaining, state.commitment] : remaining;
    });
    const destinationId =
        state.destination === "confirmed"
          ? "confirmed-recurring"
          : state.destination === "completed"
            ? "completed-plans"
          : state.destination === "attention"
            ? "needs-attention"
            : state.destination === "possible"
              ? "possible-recurring"
              : "recurring-summary";
    requestAnimationFrame(() =>
      document.getElementById(`commitment-${state.patternKey}`)?.focus() ||
      document.getElementById(destinationId)?.focus(),
    );
  };

  const undo = () => {
    if (!notice) return;
    startUndo(async () => {
      const result = await undoRecurringCommitmentDecision(notice.patternKey);
      if (result.status === "saved") {
        if (moveTimer.current) clearTimeout(moveTimer.current);
        setCommitments((current) => {
          const remaining = current.filter(
            (item) => item.patternKey !== result.patternKey,
          );
          return result.commitment ? [...remaining, result.commitment] : remaining;
        });
        setNotice({
          title: "Undone",
          patternKey: result.patternKey || notice.patternKey,
          message: "Previous understanding restored. Decision history was preserved.",
          labels: result.savedLabels,
        });
      } else {
        setNotice({
          ...notice,
          title: "Undo unavailable",
          message: result.error || "Undo could not be completed.",
        });
      }
    });
  };

  return (
    <main className={styles.page}>
      <nav><Link href="/account">← Back to Money Picture</Link></nav>
      <header className={styles.hero}>
        <p>Based on your connected accounts.</p>
        <h1>Recurring Commitments</h1>
        <span>See the charges and obligations that keep coming back, what they usually cost, and what may need your attention.</span>
      </header>
      {notice ? (
        <section className={styles.pageNotice} role="status" aria-live="polite">
          <div>
            <strong>{notice.title}</strong>
            <span>{notice.labels.join(" · ")}</span>
            <p>{notice.message}</p>
          </div>
          <div className={styles.noticeActions}>
            <button type="button" onClick={undo} disabled={undoing}>
              {undoing ? "Undoing…" : "Undo"}
            </button>
            <button type="button" aria-label="Dismiss saved notice" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        </section>
      ) : null}
      {initialData.syncPending ? <p className={styles.notice}>Your recurring commitments are still updating as transactions finish syncing.</p> : null}
      <section className={styles.summary} id="recurring-summary" tabIndex={-1} aria-label="Recurring commitments summary">
        <article><strong>{summary.confirmed}</strong><span>Confirmed recurring</span></article>
        <article><strong>{summary.possible}</strong><span>Possible recurring</span></article>
        <article><strong>{summary.needsAttention}</strong><span>Needs attention</span></article>
        {summary.completed ? <article><strong>{summary.completed}</strong><span>Completed plans</span></article> : null}
        {summary.monthlyEquivalent !== null ? <article><strong>{money(summary.monthlyEquivalent)}</strong><span>Estimated monthly equivalent</span><small>Fixed confirmed weekly, biweekly, and monthly commitments only.</small></article> : null}
      </section>
      <form className={styles.searchControls} onSubmit={(event) => {
        event.preventDefault();
        const query = new URLSearchParams({ period: initialData.period.key });
        if (initialData.period.key === "custom") {
          query.set("start", initialData.period.start);
          query.set("end", initialData.period.end);
        }
        if (search.trim()) query.set("search", search.trim());
        if (status !== "all") query.set("status", status);
        router.replace(`/account/recurring?${query.toString()}`, { scroll: false });
      }}>
        <label>
          Search recurring commitments
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Merchant, note, category, or supporting charge" />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as RecurringCommitmentStatusFilter)}>
            <option value="all">All statuses</option>
            <option value="needs_attention">Needs Attention</option>
            <option value="confirmed">Confirmed</option>
            <option value="possible">Possible</option>
            <option value="completed">Completed Plans</option>
          </select>
        </label>
        <button type="submit">Search</button>
        <span>{initialData.period.label}: supporting activity from {initialData.period.start} through {initialData.period.end}</span>
      </form>
      {!commitments.length ? (
        <section className={styles.empty}>
          <h2>We’re still learning which charges repeat.</h2>
          <p>{initialData.coverage}</p>
        </section>
      ) : filtering ? (
        filtered.length ? (
          <CommitmentSection id="recurring-search-results" title="Search Results" items={filtered} onSaved={applyResult} />
        ) : (
          <section className={styles.empty}>
            <h2>No recurring commitments match ‘{search.trim()}’ in this period.</h2>
            <p>Try another search, status, or Money Picture period.</p>
          </section>
        )
      ) : (
        <>
          {!confirmed.length && possible.length ? <p className={styles.notice}>We found a few charges that may repeat. Review them to help Covarify understand.</p> : null}
          <CommitmentSection id="needs-attention" title="Needs Attention" items={attention} onSaved={applyResult} />
          <CommitmentSection id="confirmed-recurring" title="Confirmed Recurring" items={confirmed} onSaved={applyResult} />
          <CommitmentSection id="possible-recurring" title="Possible Recurring" items={possible} onSaved={applyResult} />
          <CommitmentSection id="completed-plans" title="Completed Plans" items={completed} onSaved={applyResult} />
        </>
      )}
    </main>
  );
}
