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
  const result = useMemo(() => allocateNextDollar({ fixture, repairRequiredForWork: repairRequired, protectUtility }), [fixture, protectUtility, repairRequired]);
  const simulation = useMemo(() => simulationOpen ? simulateAllocation(result, 240) : null, [result, simulationOpen]);
  const correction = correctionOpen ? correctIncomeReliability(result, "That commission is not guaranteed.") : null;
  const selected = result.options.find((option) => option.id === result.recommendedId) || null;

  if (paused) return <section className={styles.workspace} aria-labelledby="allocation-heading"><div><p className={styles.eyebrow}><CircleDollarSign size={16}/> Flow C</p><h2 id="allocation-heading">Whole-picture priority preview</h2></div><aside className={styles.resume} role="status"><PauseCircle size={20}/><div><strong>Temporary progress paused</strong><p>We were comparing the car repair, required card minimum, utility payment, current rent, and rent arrears. {repairRequired == null ? "The remaining question was whether the repair is required for work." : "Your preliminary allocation is ready to resume."}</p><button type="button" onClick={() => setPaused(false)}>Resume this session</button></div></aside></section>;

  return <section className={styles.workspace} aria-labelledby="allocation-heading">
    <div><p className={styles.eyebrow}><CircleDollarSign size={16}/> Flow C</p><h2 id="allocation-heading">Whole-picture priority and allocation</h2><p className={styles.fact}><strong>Fixture window:</strong> {money(result.availableBeforeNextIncome)} is available before the scheduled August 20 paycheck. Possible commission, investments, and available credit are excluded.</p></div>
    <div className={styles.pathChoice} aria-label="Review depth"><button type="button">Help me decide quickly</button><details><summary>Let me review everything</summary><p>Inspect the cash timeline, evidence, consequences, assumptions, and allocation trace below.</p></details><button type="button" onClick={() => setPaused(true)}><PauseCircle size={16}/> I need a break</button></div>
    <section className={styles.knownNeeds} aria-labelledby="known-needs-heading"><h3 id="known-needs-heading">Known financial needs</h3><div>{fixture.needs.map((need) => <article key={need.id}><strong>{need.title}</strong><span>{need.fullAmount ? money(need.fullAmount) : "Protected"}</span><small>{need.type === "current_housing" ? "Current obligation" : need.type === "housing_arrears" ? "Past-due balance · separate from current rent" : need.type === "debt_minimum" ? `Required minimum · full balance ${money(need.fullAmount || 0)}` : need.partialPaymentUsefulness.replaceAll("_", " ")}</small></article>)}</div></section>
    {result.blockingQuestion ? <section className={styles.singleQuestion} aria-live="polite"><small>One blocking question · recognition before recall</small><h3>{result.blockingQuestion.prompt}</h3><p>I found {result.blockingQuestion.recognizedFacts.join(", ")}. You do not need to list them again.</p><div className={styles.modeActions}><button type="button" onClick={() => setRepairRequired(true)}>Yes — I need it to get to work</button><button type="button" onClick={() => setRepairRequired(false)}>No — it does not affect work</button></div><p><strong>Why I’m asking:</strong> This changes whether income protection should outrank arrears.</p></section> : <p className={styles.confirmed}><strong>Confirmed for this session:</strong> {repairRequired ? "The repair is required to keep working." : "The repair is not required for work."}</p>}
    {selected ? <>
      <aside className={styles.preliminary} role="status"><small>Preliminary recommendation</small><h3>{selected.title}</h3><p>{result.simpleExplanation}</p><p><strong>Why preliminary:</strong> {result.limitation}</p></aside>
      <div className={styles.allocationGrid} aria-label="Preliminary allocation">{selected.allocations.map((allocation) => <article key={allocation.needId}><div><strong>{allocation.title}</strong><span>{money(allocation.allocated)}</span></div><progress max={Math.max(1, allocation.allocated + allocation.unfunded)} value={allocation.allocated}>{allocation.allocated}</progress><p>{allocation.reason}</p>{allocation.consequenceDeferred ? <small>Deferred: {allocation.consequenceDeferred}</small> : null}</article>)}</div>
      <label className={styles.constraint}><input type="checkbox" checked={protectUtility} onChange={(event) => setProtectUtility(event.target.checked)}/> Protect the full {money(180)} utility payment too <small>Temporary scenario constraint</small></label>
      <section aria-labelledby="goal-discovery-heading"><h3 id="goal-discovery-heading">What would be most helpful right now?</h3><div className={styles.goalChoices}>{goals.map((choice) => <button type="button" key={choice[0]} aria-pressed={goal === choice[0]} onClick={() => setGoal(choice[0])}><strong>{choice[1]}</strong><span>{choice[2]}</span></button>)}</div>{goal ? <p className={styles.confirmed}><strong>Goal proposed, not confirmed:</strong> {goals.find((item) => item[0] === goal)?.[1]}. Any confirmation must name this exact goal.</p> : null}</section>
      <div className={styles.scenarioActions}><button type="button" onClick={() => setSimulationOpen(true)}>What if I work two extra shifts?</button><button type="button" onClick={() => setCorrectionOpen(true)}>That commission is not guaranteed.</button></div>
      {simulation ? <section className={styles.simulated} aria-label="Simulated what-if"><small>Simulated · baseline unchanged · not active</small><h3>{simulation.title}</h3><p>Only one assumption changed: {simulation.changedAssumptions[0]}</p><p>Expected position after the next paycheck changes from {money(selected.expectedAfterNextIncome)} to {money(simulation.result.options[0].expectedAfterNextIncome)}.</p><button type="button" onClick={() => setSimulationOpen(false)}><RotateCcw size={16}/> Reset to baseline</button></section> : null}
      {correction ? <section className={styles.correction} aria-live="polite"><h3>Correction accepted for this preview</h3><p><strong>Disputed assumption:</strong> {correction.disputedAssumption}</p><p>{correction.acceptedCorrection} The allocation did not depend on it, so the recommended amounts remain unchanged.</p><p>The original baseline remains available. This correction was not written to Financial Memory.</p></section> : null}
      <details className={styles.audit}><summary>Full explanation and evidence</summary><h3>Cash timeline</h3>{result.timeline.map((event) => <p key={event.id}>{event.date}: {event.title} · {money(event.amount)} · projected {money(event.projectedBalance)} · {event.confidence} confidence</p>)}<h3>Consequences and verification</h3>{result.consequences.map((item) => <p key={item.needId}><strong>{fixture.needs.find((need) => need.id === item.needId)?.title}:</strong> {item.description} <small>{item.basis.replaceAll("_", " ")}{item.verificationStep ? ` · ${item.verificationStep}` : ""}</small></p>)}<h3>Evidence and exclusions</h3>{fixture.resources.map((resource) => <p key={resource.id}>{resource.title}: {money(resource.amount)} · {resource.included ? "included" : `excluded — ${resource.exclusionReason}`} · {resource.evidenceIds.join(", ")}</p>)}</details>
      <aside className={styles.next} aria-label="Flow C next step"><small>Flow C next step</small><strong>{result.nextBestStep}</strong><p>Nothing is moved, saved, activated, or written to Financial Memory.</p></aside>
    </> : <aside className={styles.next} aria-label="Flow C next step"><small>Flow C next step</small><strong>{result.nextBestStep}</strong><p>{result.simpleExplanation}</p></aside>}
    <OffAccountResourcePreview />
    <footer><strong>Fixture-only allocation preview</strong><p>Needs, consequences, resources, allocations, corrections, goals, and simulations remain temporary conversation context.</p><button className={styles.primary} type="button" disabled>Confirm allocation — not available</button></footer>
  </section>;
}
