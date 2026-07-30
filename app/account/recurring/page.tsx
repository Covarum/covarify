import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { loadRecurringCommitments } from "@/lib/recurring-commitments-server";
import {
  amountDescription,
  money,
  type RecurringCommitment,
} from "@/lib/recurring-commitments";
import { formatTransactionDisplayAmount } from "@/lib/money-picture";
import { saveRecurringCommitmentDecision } from "./actions";
import styles from "./recurring.module.css";

export const dynamic = "force-dynamic";

const typeLabel: Record<RecurringCommitment["type"], string> = {
  subscription: "Subscription",
  utility: "Utility",
  insurance: "Insurance",
  membership: "Membership",
  software_service: "Software or service",
  installment_loan: "Possible installment payment",
  buy_now_pay_later: "Possible installment payment",
  loan_payment: "Loan payment",
  recurring_transfer: "Recurring transfer",
  other_recurring: "Other recurring",
  unknown_recurring: "Unknown recurring",
};

function DecisionButton({
  commitment,
  name,
  value,
  children,
}: {
  commitment: RecurringCommitment;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <form action={saveRecurringCommitmentDecision}>
      <input type="hidden" name="patternKey" value={commitment.patternKey} />
      <input type="hidden" name={name} value={value} />
      <button type="submit">{children}</button>
    </form>
  );
}

function CommitmentCard({ commitment }: { commitment: RecurringCommitment }) {
  const identityEligible = [
    "subscription",
    "membership",
    "software_service",
  ].includes(commitment.type);
  const installment = ["installment_loan", "buy_now_pay_later"].includes(
    commitment.type,
  );
  return (
    <article className={styles.card}>
      <header>
        <div>
          <span className={styles.kind}>{typeLabel[commitment.type]}</span>
          <h3>{commitment.displayName}</h3>
          <p>{amountDescription(commitment)}</p>
        </div>
        <span className={styles.status}>{commitment.status.replace("_", " ")}</span>
      </header>
      <dl className={styles.facts}>
        <div><dt>Last charge</dt><dd>{commitment.lastObserved} · {money(commitment.lastAmount)}</dd></div>
        <div><dt>Payment account</dt><dd>{commitment.paymentAccountLabel}</dd></div>
        <div><dt>Category</dt><dd>{commitment.effectiveCategory}</dd></div>
        {commitment.nextExpected ? <div><dt>Next</dt><dd>Expected around {commitment.nextExpected}</dd></div> : null}
        {commitment.decision?.ownerLabel ? <div><dt>Owner</dt><dd>{commitment.decision.ownerLabel}</dd></div> : null}
      </dl>
      {commitment.attentionReasons.length ? (
        <div className={styles.attention}>
          <strong>Why this may need attention</strong>
          {commitment.attentionReasons.map((reason) => <p key={reason}>{reason}</p>)}
        </div>
      ) : null}
      <details>
        <summary>Review commitment</summary>
        <div className={styles.detail}>
          <section>
            <h4>What Covarify noticed</h4>
            <p>{commitment.confidenceExplanation}</p>
            <p>
              This is a detected pattern, not a user-confirmed fact.
              {installment ? " It may represent one or more installment plans." : ""}
            </p>
          </section>
          <section>
            <h4>What it may mean</h4>
            <p>
              {installment
                ? "Connected transaction history supports observed payments only. Covarify does not know the live balance, payoff amount, fees, payments remaining, or payoff date."
                : `This may be a ${typeLabel[commitment.type].toLowerCase()}. Confirm or correct it below.`}
            </p>
          </section>
          <div className={styles.quickActions}>
            <DecisionButton commitment={commitment} name="recurringStatus" value="confirmed">Confirm recurring</DecisionButton>
            <DecisionButton commitment={commitment} name="recurringStatus" value="not_recurring">Not recurring</DecisionButton>
            <DecisionButton commitment={commitment} name="recognitionStatus" value="recognized">I recognize this</DecisionButton>
            <DecisionButton commitment={commitment} name="recognitionStatus" value="unrecognized">I don&apos;t recognize this</DecisionButton>
            <DecisionButton commitment={commitment} name="disposition" value="keep">Keep</DecisionButton>
            <DecisionButton commitment={commitment} name="disposition" value="review">Review</DecisionButton>
            <DecisionButton commitment={commitment} name="disposition" value="cancellation_requested">I want to cancel this</DecisionButton>
            <a href={`#transactions-${commitment.patternKey}`}>View supporting transactions</a>
          </div>
          <p className={styles.caution}>“I want to cancel this” only marks cancellation intent. Covarify does not cancel the service.</p>
          <form action={saveRecurringCommitmentDecision} className={styles.editor}>
            <input type="hidden" name="patternKey" value={commitment.patternKey} />
            <input type="hidden" name="mode" value="editor" />
            <label>
              Commitment type
              <select name="commitmentType" defaultValue={commitment.decision?.commitmentType || commitment.type}>
                {Object.entries(typeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Owner
              <select name="ownerLabel" defaultValue={commitment.decision?.ownerLabel || "Not sure"}>
                {["Mine", "Household", "Business", "Someone else", "Not sure"].map((owner) => <option key={owner}>{owner}</option>)}
              </select>
            </label>
            <label className={styles.wide}>
              Note
              <textarea name="userNote" maxLength={1000} defaultValue={commitment.decision?.userNote || ""} />
            </label>
            {identityEligible ? (
              <fieldset className={styles.wide}>
                <legend>Need help identifying the account?</legend>
                <p>Covarify can help you keep track of which account this charge belongs to.</p>
                <label>
                  Login or account status
                  <select name="loginStatus" defaultValue={commitment.decision?.loginStatus || "unsure"}>
                    <option value="known">I know the account</option>
                    <option value="cannot_find">I can&apos;t find the login</option>
                    <option value="belongs_to_someone_else">Belongs to someone else</option>
                    <option value="unsure">Not sure</option>
                  </select>
                </label>
                <label>
                  Email, username, or account description
                  <input name="identityNote" maxLength={500} defaultValue={commitment.decision?.identityNote || ""} autoComplete="off" />
                </label>
                <small>Do not enter a password or security code.</small>
              </fieldset>
            ) : null}
            {installment ? (
              <fieldset className={styles.wide}>
                <legend>Optional installment details</legend>
                <p>These values are labeled “Provided by you” and are not treated as live provider data.</p>
                <label>Purchase or purpose<input name="manualOriginalPurpose" defaultValue={commitment.decision?.manualOriginalPurpose || ""} /></label>
                <label>Current balance<input name="manualCurrentBalance" type="number" min="0" step="0.01" defaultValue={commitment.decision?.manualCurrentBalance ?? ""} /></label>
                <label>Original financed amount<input name="manualOriginalAmount" type="number" min="0" step="0.01" defaultValue={commitment.decision?.manualOriginalAmount ?? ""} /></label>
                <label>Payments remaining<input name="manualPaymentsRemaining" type="number" min="0" step="1" defaultValue={commitment.decision?.manualPaymentsRemaining ?? ""} /></label>
                <label>Next payment date<input name="manualNextPaymentDate" type="date" defaultValue={commitment.decision?.manualNextPaymentDate || ""} /></label>
                {commitment.decision &&
                [
                  commitment.decision.manualOriginalPurpose,
                  commitment.decision.manualCurrentBalance,
                  commitment.decision.manualOriginalAmount,
                  commitment.decision.manualPaymentsRemaining,
                  commitment.decision.manualNextPaymentDate,
                ].some((value) => value !== null && value !== "") ? (
                  <div>
                    <strong>Provided by you</strong>
                    <ul>
                      {commitment.decision.manualOriginalPurpose ? <li>Purpose: {commitment.decision.manualOriginalPurpose}</li> : null}
                      {commitment.decision.manualCurrentBalance !== null ? <li>Current balance: {money(commitment.decision.manualCurrentBalance)}</li> : null}
                      {commitment.decision.manualOriginalAmount !== null ? <li>Original financed amount: {money(commitment.decision.manualOriginalAmount)}</li> : null}
                      {commitment.decision.manualPaymentsRemaining !== null ? <li>Payments remaining: {commitment.decision.manualPaymentsRemaining}</li> : null}
                      {commitment.decision.manualNextPaymentDate ? <li>Next payment date: {commitment.decision.manualNextPaymentDate}</li> : null}
                    </ul>
                  </div>
                ) : null}
              </fieldset>
            ) : null}
            {commitment.attentionReasons.some((reason) => reason.toLowerCase().includes("duplicate")) ? (
              <label>
                Possible duplicate
                <select name="duplicateDecision" defaultValue={commitment.decision?.duplicateDecision || "review"}>
                  <option value="separate">These are separate</option>
                  <option value="review">Review</option>
                  <option value="unrecognized_one">I don&apos;t recognize one</option>
                </select>
              </label>
            ) : null}
            <button type="submit" className={styles.primary}>Save understanding</button>
          </form>
          <section id={`transactions-${commitment.patternKey}`} className={styles.transactions}>
            <h4>Supporting transactions</h4>
            <p>{commitment.supportingTransactions.length} posted charges from {commitment.firstObserved} through {commitment.lastObserved}.</p>
            <ul>
              {commitment.supportingTransactions.map((transaction) => (
                <li key={transaction.id}>
                  <span><strong>{transaction.name}</strong><small>{transaction.date} · {transaction.accountLabel}</small></span>
                  <strong>
                    <span className="sr-only">{formatTransactionDisplayAmount(transaction).accessibleText}</span>
                    <span aria-hidden="true">{formatTransactionDisplayAmount(transaction).displayAmount}</span>
                  </strong>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </details>
    </article>
  );
}

function CommitmentSection({
  title,
  items,
}: {
  title: string;
  items: RecurringCommitment[];
}) {
  if (!items.length) return null;
  return (
    <section className={styles.section}>
      <header><h2>{title}</h2><span>{items.length}</span></header>
      <div className={styles.cards}>{items.map((item) => <CommitmentCard key={item.patternKey} commitment={item} />)}</div>
    </section>
  );
}

export default async function RecurringCommitmentsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account/recurring");
  const data = await loadRecurringCommitments(user.id);
  const attention = data.commitments.filter((item) => item.status === "needs_attention");
  const confirmed = data.commitments.filter((item) => item.status === "confirmed");
  const possible = data.commitments.filter((item) => item.status === "possible");
  return (
    <main className={styles.page}>
      <nav><Link href="/account">← Back to Money Picture</Link></nav>
      <header className={styles.hero}>
        <p>Based on your connected accounts.</p>
        <h1>Recurring Commitments</h1>
        <span>See the charges and obligations that keep coming back, what they usually cost, and what may need your attention.</span>
      </header>
      {data.syncPending ? <p className={styles.notice}>Your recurring commitments are still updating as transactions finish syncing.</p> : null}
      <section className={styles.summary} aria-label="Recurring commitments summary">
        <article><strong>{data.summary.confirmed}</strong><span>Confirmed recurring</span></article>
        <article><strong>{data.summary.possible}</strong><span>Possible recurring</span></article>
        <article><strong>{data.summary.needsAttention}</strong><span>Needs attention</span></article>
        {data.summary.monthlyEquivalent !== null ? <article><strong>{money(data.summary.monthlyEquivalent)}</strong><span>Estimated monthly equivalent</span><small>Fixed confirmed weekly, biweekly, and monthly commitments only.</small></article> : null}
      </section>
      {!data.commitments.length ? (
        <section className={styles.empty}>
          <h2>We&apos;re still learning which charges repeat.</h2>
          <p>{data.coverage}</p>
        </section>
      ) : (
        <>
          {!confirmed.length && possible.length ? <p className={styles.notice}>We found a few charges that may repeat. Review them to help Covarify understand.</p> : null}
          <CommitmentSection title="Needs Attention" items={attention} />
          <CommitmentSection title="Confirmed Recurring" items={confirmed} />
          <CommitmentSection title="Possible Recurring" items={possible} />
        </>
      )}
    </main>
  );
}
