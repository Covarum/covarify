"use client";

import { useMemo, useState } from "react";
import { CircleDollarSign, PauseCircle, RotateCcw } from "lucide-react";
import { allocateNextDollar, correctIncomeReliability, founderAllocationFixture, simulateAllocation } from "@/lib/conversation/allocation-intelligence";
import styles from "./conversation-strategy-preview.module.css";
import { OffAccountResourcePreview } from "./off-account-resource-preview";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const goals = [
  ["current_first", "Keep upcoming payments current first", "Protects current obligations before directing remaining capacity toward past-due balances."],
  ["protect_work", "Protect my ability to work", "Prioritizes needs that preserve reliable income."],
  ["protect_minimums", "Protect required minimums", "Covers verified required minimums before optional balance reduction."],
  ["realistic_first", "Show me what is realistic first", "Starts with preliminary guidance and clearly labels missing facts."],
] as const;

export function WholePictureAllocationPreview() {
  const fixture = useMemo(() => founderAllocationFixture(), []);
  const [repairRequired, setRepairRequired] = useState<boolean | null>(null);
  const [protectUtility, setProtectUtility] = useState(false);
  const [goal, setGoal] = useState<string | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reviewPath, setReviewPath] = useState<"fast" | "details" | null>(null);
  const result = useMemo(() => allocateNextDollar({ fixture, repairRequiredForWork: repairRequired, protectUtility }), [fixture, protectUtility, repairRequired]);
  const simulation = useMemo(() => simulationOpen ? simulateAllocation(result, 240) : null, [result, simulationOpen]);
  const correction = correctionOpen ? correctIncomeReliability(result, "That commission is not guaranteed.") : null;
  const selected = result.options.find((option) => option.id === result.recommendedId) || null;

  if (paused) return <section className={styles.workspace} aria-labelledby="allocation-heading"><div><p className={styles.eyebrow}><CircleDollarSign size={16}/> Flow C</p><h2 id="allocation-heading">Whole-picture priority preview</h2></div><aside className={styles.resume} role="status"><PauseCircle size={20}/><div><strong>Your place is saved for this session.</strong><p>We were reviewing the money available now. {repairRequired == null ? "We were waiting to confirm whether the repair is required for work." : "Your preliminary recommendation is ready."}</p><button type="button" onClick={() => setPaused(false)}>Resume</button></div></aside></section>;

  return <section className={styles.workspace} aria-labelledby="allocation-heading">
    <div><p className={styles.eyebrow}><CircleDollarSign size={16}/> Flow C</p><h2 id="allocation-heading">Decide what the available money should do first</h2><p className={styles.fact}><strong>What matters now:</strong> {money(result.availableBeforeNextIncome)} is available before the August 20 paycheck. Possible commission, investments, and available credit are not counted.</p></div>
    <div className={styles.pathChoice} aria-label="Review depth"><button className={styles.primary} type="button" aria-pressed={reviewPath === "fast"} onClick={() => setReviewPath("fast")}>{reviewPath === "fast" ? "Quick review selected" : "Help me decide quickly"}<span>Use what is known and ask only what could change the recommendation.</span></button><button className={styles.tertiary} type="button" aria-pressed={reviewPath === "details"} onClick={() => setReviewPath("details")}>Review the details</button><button className={styles.tertiary} type="button" onClick={() => setPaused(true)}><PauseCircle size={16}/> Pause for now</button></div>
    {reviewPath === "details" ? <section className={styles.knownNeeds} aria-labelledby="known-needs-heading"><h3 id="known-needs-heading">Known financial needs</h3><div>{fixture.needs.map((need) => <p key={need.id}><strong>{need.title}</strong><span>{need.fullAmount ? money(need.fullAmount) : "Protected"}</span>{need.id === "repair" ? <small>Relevant now because it may protect income.</small> : null}</p>)}</div></section> : null}
    {reviewPath && result.blockingQuestion ? <section className={styles.singleQuestion} aria-live="polite"><small>One blocking question</small><h3>{result.blockingQuestion.prompt}</h3><p>I found the known needs already. You do not need to list them again.</p><div className={styles.modeActions}><button type="button" onClick={() => setRepairRequired(true)}>Yes — I need it to get to work</button><button type="button" onClick={() => setRepairRequired(false)}>No — it does not affect work</button></div><p><strong>Why I’m asking:</strong> This changes whether income protection should outrank arrears.</p></section> : reviewPath ? <p className={styles.confirmed}><strong>Confirmed for this session:</strong> {repairRequired ? "The repair is required to keep working." : "The repair is not required for work."}</p> : null}
    {selected ? <>
      <aside className={styles.preliminary} role="status"><small>Recommended for the {money(result.availableBeforeNextIncome)} available now</small><h3>{selected.title}</h3><p>{result.simpleExplanation}</p></aside>
      <div className={styles.allocationList} aria-label="Preliminary allocation">{selected.allocations.filter((allocation) => allocation.allocated > 0).map((allocation) => <p key={allocation.needId}><strong>{allocation.title}</strong><span>{money(allocation.allocated)}</span></p>)}</div>
      <p><strong>Why:</strong> This protects the ability to work, covers the required minimum, and reserves the remainder for current rent.</p><div className={styles.deferred}><strong>Deferred</strong><p>Utility timing needs confirmation.</p><p>Rent arrears receive $0 for now.</p></div><div className={styles.recommendationActions}><button className={styles.primary} type="button" onClick={() => setReviewPath("details")}>Review this recommendation</button><button className={styles.tertiary} type="button" onClick={() => setReviewPath("details")}>Show another approach</button></div>
      {reviewPath === "details" ? <><label className={styles.constraint}><input type="checkbox" checked={protectUtility} onChange={(event) => setProtectUtility(event.target.checked)}/> Protect the full {money(180)} utility payment too <small>Temporary scenario constraint</small></label>
      <section className={styles.recommendedGoal} aria-labelledby="goal-discovery-heading"><small>Recommended goal</small><h3 id="goal-discovery-heading">Keep upcoming rent current while making steady progress on the past-due balance.</h3><p><strong>Why Covarify suggested this:</strong> Protects the next housing payment while reducing the arrears balance at a sustainable pace.</p><button className={styles.primary} type="button" onClick={() => setGoal("current_first")}>Use this exact goal: keep upcoming rent current while making steady progress on the past-due balance</button><details><summary>See other housing goals</summary><div className={styles.goalChoices}>{goals.slice(1).map((choice) => <button type="button" key={choice[0]} aria-pressed={goal === choice[0]} onClick={() => setGoal(choice[0])}><strong>{choice[1]}</strong><span>{choice[2]}</span></button>)}</div></details><button className={styles.tertiary} type="button">Describe my own goal</button>{goal ? <p className={styles.confirmed}><strong>Goal proposed, not confirmed:</strong> {goal === "current_first" ? "Keep upcoming rent current while making steady progress on the past-due balance." : goals.find((item) => item[0] === goal)?.[1]} Nothing has been saved.</p> : null}</section>
      <div className={styles.scenarioActions}><button type="button" onClick={() => setSimulationOpen(true)}>What if I work two extra shifts?</button><button type="button" onClick={() => setCorrectionOpen(true)}>That commission is not guaranteed.</button></div>
      {simulation ? <section className={styles.simulated} aria-label="Simulated what-if"><small>Simulated · baseline unchanged · not active</small><h3>{simulation.title}</h3><p>Only one assumption changed: {simulation.changedAssumptions[0]}</p><p>Expected position after the next paycheck changes from {money(selected.expectedAfterNextIncome)} to {money(simulation.result.options[0].expectedAfterNextIncome)}.</p><button type="button" onClick={() => setSimulationOpen(false)}><RotateCcw size={16}/> Reset to baseline</button></section> : null}
      {correction ? <section className={styles.correction} aria-live="polite"><h3>Correction accepted for this preview</h3><p><strong>Disputed assumption:</strong> {correction.disputedAssumption}</p><p>{correction.acceptedCorrection} The allocation did not depend on it, so the recommended amounts remain unchanged.</p><p>The original baseline remains available. This correction was not written to Financial Memory.</p></section> : null}</> : null}
      {reviewPath === "details" ? <details className={styles.audit}><summary>Show full calculation</summary><h3>Cash timeline</h3>{result.timeline.map((event) => <p key={event.id}>{event.date}: {event.title} · {money(event.amount)} · projected {money(event.projectedBalance)}</p>)}<h3>Consequences and verification</h3>{result.consequences.map((item) => <p key={item.needId}><strong>{fixture.needs.find((need) => need.id === item.needId)?.title}:</strong> {item.description}</p>)}</details> : null}
      <aside className={styles.next} aria-label="Flow C next step"><small>Flow C next step</small><strong>{result.nextBestStep}</strong><p>Nothing is moved, saved, activated, or written to Financial Memory.</p></aside>
    </> : <aside className={styles.next} aria-label="Flow C next step"><small>Flow C next step</small><strong>{result.nextBestStep}</strong><p>{result.simpleExplanation}</p></aside>}
    {reviewPath === "details" ? <OffAccountResourcePreview /> : null}
    <footer className={styles.previewBoundary}><strong>Preview only</strong><p>Nothing has been saved, activated, or moved.</p></footer>
    <details className={styles.founderTools}><summary>Founder testing tools</summary><p><strong>Fixture state:</strong> {repairRequired == null ? "repair question open" : "allocation ready"}</p><p><strong>Evidence IDs:</strong> {fixture.resources.flatMap((resource) => resource.evidenceIds).join(", ")}</p><p><strong>Parser context:</strong> money amount</p><p><strong>Memory disposition:</strong> temporary session context; no durable write</p><p><strong>Reconciliation:</strong> fixture keys remain deduplicated</p></details>
  </section>;
}
