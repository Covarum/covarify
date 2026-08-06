"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allocateNextDollar, founderAllocationFixture } from "@/lib/conversation/allocation-intelligence";
import { buildJourneyPresentation, guidanceModeFromStatement, type GuidanceMode, type JourneyStep, type RepairAnswer, type UtilityTimingAnswer } from "@/lib/conversation/journey-presentation";
import { useBrowserSpeech } from "./use-browser-speech";
import styles from "./adaptive-journey-preview.module.css";

const modes: Array<{ id: GuidanceMode; label: string; description: string }> = [
  { id: "guided", label: "Step by step", description: "One important question at a time" },
  { id: "concise", label: "Keep it concise", description: "Key facts and recommendation" },
  { id: "expert", label: "Show me everything", description: "Assumptions, evidence, and calculations" },
];
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function AdaptiveJourneyPreview() {
  const [mode, setMode] = useState<GuidanceMode>("guided");
  const [journeyStep, setJourneyStep] = useState<JourneyStep>("repair_question");
  const [repairAnswer, setRepairAnswer] = useState<RepairAnswer>(null);
  const [priorRepairAnswer, setPriorRepairAnswer] = useState<RepairAnswer>(null);
  const [utilityTimingAnswer, setUtilityTimingAnswer] = useState<UtilityTimingAnswer>(null);
  const [priorUtilityAnswer, setPriorUtilityAnswer] = useState<UtilityTimingAnswer>(null);
  const [activatingAnswer, setActivatingAnswer] = useState<RepairAnswer | UtilityTimingAnswer>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [command, setCommand] = useState("");
  const [announcement, setAnnouncement] = useState("Ready for your next answer.");
  const repairQuestionRef = useRef<HTMLHeadingElement>(null);
  const utilityQuestionRef = useRef<HTMLHeadingElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const transitionLockRef = useRef(false);
  const modeLabel = modes.find((item) => item.id === mode)?.label || "Step by step";
  const presentation = useMemo(() => buildJourneyPresentation({ mode, repairAnswer, utilityTimingAnswer, step: journeyStep, stopped }), [mode, repairAnswer, utilityTimingAnswer, journeyStep, stopped]);
  const allocation = useMemo(() => allocateNextDollar({ fixture: founderAllocationFixture(), repairRequiredForWork: repairAnswer === "yes" ? true : repairAnswer === "no" ? false : null, protectUtility: utilityTimingAnswer === "yes" }), [repairAnswer, utilityTimingAnswer]);
  const recommendation = allocation.options.find((option) => option.id === allocation.recommendedId) || null;

  useEffect(() => {
    if (journeyStep === "utility_timing_question") {
      const heading = utilityQuestionRef.current;
      heading?.focus();
      heading?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      requestAnimationFrame(() => { transitionLockRef.current = false; setTransitioning(false); });
    } else if (journeyStep.endsWith("_review")) confirmationRef.current?.focus();
  }, [journeyStep]);

  const recordRepairAnswer = useCallback((answer: Exclude<RepairAnswer, null>) => {
    setPriorRepairAnswer((current) => repairAnswer ?? current); setRepairAnswer(answer); setJourneyStep("repair_review"); setStopped(false);
    setAnnouncement(answer === "unsure" ? "You confirmed that the repair consequence is uncertain. Guidance remains preliminary." : `You confirmed that the repair ${answer === "yes" ? "is" : "is not"} required for work. The recommendation was recalculated.`);
  }, [repairAnswer]);
  const recordUtilityAnswer = useCallback((answer: Exclude<UtilityTimingAnswer, null>) => {
    setPriorUtilityAnswer((current) => utilityTimingAnswer ?? current); setUtilityTimingAnswer(answer); setJourneyStep("utility_timing_review");
    setAnnouncement(answer === "yes" ? "You confirmed that the utility is due before the next paycheck. The approved allocation was recalculated." : answer === "no" ? "You confirmed that the utility can wait until after the next paycheck. The recommendation was updated." : "You confirmed that utility timing is uncertain. The recommendation remains preliminary.");
  }, [utilityTimingAnswer]);
  const selectAnswer = (answer: "yes" | "no" | "unsure") => {
    setActivatingAnswer(answer); setAnnouncement(`${answer === "yes" ? "Yes" : answer === "no" ? "No" : "I’m not sure"} selected.`);
    window.setTimeout(() => { setActivatingAnswer(null); if (journeyStep === "utility_timing_question") recordUtilityAnswer(answer); else recordRepairAnswer(answer); }, 120);
  };
  const openUtilityQuestion = () => {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true; setTransitioning(true); setJourneyStep("utility_timing_question");
    setAnnouncement("Repair decision completed. Utility timing is now the active question.");
  };
  const applyStatement = useCallback((statement: string) => {
    const nextMode = guidanceModeFromStatement(statement, mode);
    if (nextMode !== mode) { setMode(nextMode); setAnnouncement(`Guidance changed to ${modes.find((item) => item.id === nextMode)?.label}. Your financial facts are unchanged.`); return "applied" as const; }
    const answer = /\b(?:not sure|don't know|do not know|uncertain)\b/i.test(statement) ? "unsure" : /\b(?:no|can wait|not due|after)\b/i.test(statement) ? "no" : /\b(?:yes|due first|before|need it|required)\b/i.test(statement) ? "yes" : null;
    if (answer) { if (journeyStep === "utility_timing_question") recordUtilityAnswer(answer); else if (journeyStep === "repair_question") recordRepairAnswer(answer); else { setCommand(statement); return "held" as const; } return "applied" as const; }
    setCommand(statement); setAnnouncement("Statement added for review. No financial fact changed."); return "held" as const;
  }, [journeyStep, mode, recordRepairAnswer, recordUtilityAnswer]);
  const speech = useBrowserSpeech({ onFinalTranscript: (transcript) => applyStatement(transcript), stopSpeaking: () => window.speechSynthesis?.cancel() });
  const submitCommand = () => { const statement = command.trim(); if (!statement) return; applyStatement(statement); setCommand(""); speech.resetActiveTurn(); };
  const changeRepairAnswer = () => { setPriorRepairAnswer(repairAnswer); setRepairAnswer(null); setUtilityTimingAnswer(null); setJourneyStep("repair_question"); setStopped(false); setAnnouncement("Repair answer reopened."); requestAnimationFrame(() => repairQuestionRef.current?.focus()); };
  const undoRepairAnswer = () => { setRepairAnswer(priorRepairAnswer); setPriorRepairAnswer(null); setJourneyStep(priorRepairAnswer ? "repair_review" : "repair_question"); setAnnouncement("The prior repair answer was restored."); };
  const changeUtilityAnswer = () => { setPriorUtilityAnswer(utilityTimingAnswer); setUtilityTimingAnswer(null); setJourneyStep("utility_timing_question"); setAnnouncement("Utility timing reopened."); };
  const undoUtilityAnswer = () => { setUtilityTimingAnswer(priorUtilityAnswer); setPriorUtilityAnswer(null); setJourneyStep(priorUtilityAnswer ? "utility_timing_review" : "utility_timing_question"); setAnnouncement("The prior utility answer was restored."); };

  const allocationLines = recommendation?.allocations.filter((line) => line.allocated > 0) || [];
  const allocationSummary = <div className={styles.allocation}>{allocationLines.map((line) => <p key={line.needId}><span>{line.title === "Upcoming current rent" ? "Rent reserve" : line.title}</span><strong>{money(line.allocated)}</strong></p>)}</div>;

  if (stopped) return <main className={styles.journey}><section className={styles.completion} aria-labelledby="completion-heading"><p className={styles.context}>Your money picture</p><h1 id="completion-heading">You have a workable next step.</h1>{allocationSummary}<p>Nothing has been moved or saved.</p><button className={styles.primary} onClick={() => setAnnouncement("Done for now. Nothing was moved or saved.")}>Done for now</button><div className={styles.quietActions}><button onClick={() => setStopped(false)}>Resume</button><button onClick={() => { setStopped(false); setMode("expert"); }}>Review details</button></div></section><p aria-live="polite" className="sr-only">{announcement}</p></main>;

  const activeQuestion = journeyStep === "repair_question" || journeyStep === "utility_timing_question";
  return <main className={styles.journey}>
    <header className={styles.intro}><p className={styles.context}>Your money picture</p><h1>Decide what your available money should do first.</h1><p><strong>$900 is available before your next paycheck.</strong> A few needs are competing for it.</p></header>
    <details className={styles.guidance}><summary><span>Guidance: <strong>{modeLabel}</strong></span><span className={styles.changeLabel}>Change</span></summary><div className={styles.modeChoices} role="group" aria-label="Guidance pace">{modes.map((item) => <button key={item.id} className={styles.modeChoice} aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setAnnouncement(`Guidance changed to ${item.label}. Your financial facts are unchanged.`); }}><span>{mode === item.id ? "✓ " : ""}{item.label}</span><small>{item.description}</small></button>)}</div></details>

    {journeyStep === "utility_timing_question" ? <section className={styles.completedTurn}><p className={styles.context}>Completed</p><strong>{repairAnswer === "yes" ? "Repair confirmed as required for work" : "Repair confirmed as able to wait"}</strong><button className={styles.textAction} onClick={changeRepairAnswer}>Change</button></section> : null}

    {activeQuestion ? <section className={styles.decision} aria-labelledby={journeyStep === "repair_question" ? "repair-question" : "utility-question"}><p>One answer could change the recommendation.</p><h2 id={journeyStep === "repair_question" ? "repair-question" : "utility-question"} ref={journeyStep === "repair_question" ? repairQuestionRef : utilityQuestionRef} tabIndex={-1}>{presentation.currentQuestion}</h2><div className={styles.choices} role="group" aria-label={journeyStep === "repair_question" ? "Repair requirement" : "Utility timing"}><button className={styles.choice} aria-pressed={activatingAnswer === "yes"} onClick={() => selectAnswer("yes")}>{journeyStep === "repair_question" ? "Yes — I need it to keep working" : "Yes — it is due first"}</button><button className={styles.choice} aria-pressed={activatingAnswer === "no"} onClick={() => selectAnswer("no")}>{journeyStep === "repair_question" ? "No — it can wait" : "No — it can wait until after"}</button><button className={styles.choice} aria-pressed={activatingAnswer === "unsure"} onClick={() => selectAnswer("unsure")}>I’m not sure</button></div><details className={styles.alternateAnswer}><summary>Answer another way</summary><Composer command={command} setCommand={setCommand} submitCommand={submitCommand} speech={speech} /></details></section> : null}

    {journeyStep === "repair_review" ? <><Confirmation title={repairAnswer === "yes" ? "Required for work" : repairAnswer === "no" ? "The repair can wait" : "The consequence is still uncertain"} change={changeRepairAnswer} undo={undoRepairAnswer} confirmationRef={confirmationRef} /><Synthesis text={presentation.synthesis} /></> : null}
    {journeyStep === "utility_timing_review" ? <><section className={styles.completedTurn}><p className={styles.context}>What Covarify already knows</p><strong>{repairAnswer === "yes" ? "Repair required for work" : "Repair can wait"}</strong></section><Confirmation title={utilityTimingAnswer === "yes" ? "Utility due before the next paycheck" : utilityTimingAnswer === "no" ? "Utility can wait until after the next paycheck" : "Utility timing remains uncertain"} change={changeUtilityAnswer} undo={undoUtilityAnswer} confirmationRef={confirmationRef} /><Synthesis text={presentation.synthesis} /></> : null}

    {repairAnswer === "unsure" || utilityTimingAnswer === "unsure" ? <section className={styles.warning}><h2>Preliminary guidance</h2><p>{repairAnswer === "unsure" ? "Verify whether delaying the repair would affect your ability to keep working." : "Verify the utility bill timing before relying on a final order."}</p></section> : null}
    {recommendation && !activeQuestion ? <section className={styles.recommendation} aria-labelledby="recommendation-heading"><p className={styles.context}>Current recommendation</p><h2 id="recommendation-heading">{recommendation.title}</h2>{allocationSummary}<p className={styles.rationale}>{allocation.simpleExplanation}</p><p className={styles.caveat}>{allocation.limitation}</p></section> : null}

    {mode === "concise" && repairAnswer && !activeQuestion ? <section className={styles.compactReview} aria-labelledby="situation-heading"><h2 id="situation-heading">Your situation</h2><dl><div><dt>Available now</dt><dd>$900</dd></div><div><dt>Required now</dt><dd>$75 card minimum</dd></div><div><dt>Utility timing</dt><dd>{utilityTimingAnswer === "yes" ? "Due before paycheck" : utilityTimingAnswer === "no" ? "Can wait" : "Unconfirmed"}</dd></div></dl></section> : null}
    {mode === "expert" && repairAnswer ? <section className={styles.expert} aria-labelledby="details-heading"><h2 id="details-heading">Full financial reasoning</h2><details><summary>Goal and available resources</summary><p>Decide how to use $900 before the next paycheck while protecting essential needs.</p></details><details><summary>Timing and required obligations</summary><p>The $75 card minimum is required. Utility timing is {utilityTimingAnswer === "yes" ? "confirmed before the paycheck" : utilityTimingAnswer === "no" ? "confirmed after the paycheck" : "still unconfirmed"}.</p></details><details><summary>Protected priorities</summary><p>Groceries, medication, and current housing remain protected.</p></details><details><summary>Assumptions and missing facts</summary><p>{presentation.criticalMissingFacts.join("; ") || "No required timing fact remains unanswered."}</p></details><details><summary>Evidence and calculation</summary><p>Available cash is $900. Credit, investments, and possible commission are excluded. The recommended allocations total no more than available cash.</p></details></section> : null}

    {journeyStep === "repair_review" ? <section className={styles.next} aria-labelledby="next-heading"><p className={styles.context}>Next</p><h2 id="next-heading">{repairAnswer === "unsure" ? "Verify whether delaying the repair would affect your ability to work." : "Confirm whether the utility is due before your next paycheck."}</h2>{repairAnswer === "unsure" ? <button className={styles.primary} onClick={() => setStopped(true)}>Finish for now</button> : <button className={styles.primary} disabled={transitioning} onClick={openUtilityQuestion}>{transitioning ? "Opening utility question…" : "Check utility timing"}</button>}<button className={styles.textAction} onClick={() => setStopped(true)}>Stop here</button></section> : null}
    {journeyStep === "utility_timing_review" ? <section className={styles.completion} aria-labelledby="ready-heading"><h2 id="ready-heading">You have a workable next step.</h2>{allocationSummary}<p>Nothing has been moved or saved.</p><button className={styles.primary} onClick={() => setStopped(true)}>Finish for now</button><div className={styles.quietActions}><button onClick={changeUtilityAnswer}>Adjust recommendation</button><button onClick={() => setMode("expert")}>Review details</button></div></section> : null}
    {!activeQuestion ? <section className={styles.standardComposer}><Composer command={command} setCommand={setCommand} submitCommand={submitCommand} speech={speech} /></section> : null}
    <details className={styles.known}><summary>What Covarify already knows</summary><ul>{presentation.completedContext.map((fact) => <li key={fact}>{fact}</li>)}</ul></details>
    <p className={styles.boundary}>This is a controlled, read-only preview. Nothing is moved, activated, or saved to Financial Memory.</p>
    <details className={styles.founderTools}><summary>Founder testing tools</summary><p>Guidance: {mode}. Step: {presentation.step}. Completion: {presentation.completion}. Critical missing facts: {presentation.criticalMissingFacts.join(", ") || "none"}.</p></details>
    <p aria-live="polite" className="sr-only">{announcement}</p>
  </main>;
}

function Confirmation({ title, change, undo, confirmationRef }: { title: string; change: () => void; undo: () => void; confirmationRef: React.RefObject<HTMLDivElement | null> }) { return <section className={styles.confirmed} aria-labelledby="confirmed-heading" ref={confirmationRef} tabIndex={-1}><p id="confirmed-heading">You confirmed</p><h2>✓ {title}</h2><div className={styles.quietActions}><button onClick={change}>Change</button><button onClick={undo}>Undo</button></div></section>; }
function Synthesis({ text }: { text: string | null }) { return <section className={styles.synthesis} aria-labelledby="changed-heading"><h2 id="changed-heading">What changed</h2><p>{text}</p></section>; }
type ComposerProps = { command: string; setCommand: (value: string) => void; submitCommand: () => void; speech: ReturnType<typeof useBrowserSpeech> };
function Composer({ command, setCommand, submitCommand, speech }: ComposerProps) { return <div className={styles.composer} aria-label="Text and voice input"><label><span>Message</span><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitCommand(); }} placeholder="Type an answer or guidance request" /></label><div><button onClick={submitCommand}>Send</button><button onClick={speech.listening ? speech.stop : speech.start}>{speech.listening ? "Stop microphone" : "Microphone"}</button></div><p aria-live="polite">{speech.status}</p></div>; }
