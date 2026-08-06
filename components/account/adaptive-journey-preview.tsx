"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { allocateNextDollar, founderAllocationFixture } from "@/lib/conversation/allocation-intelligence";
import { buildJourneyPresentation, guidanceModeFromStatement, type GuidanceMode, type RepairAnswer } from "@/lib/conversation/journey-presentation";
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
  const [repairAnswer, setRepairAnswer] = useState<RepairAnswer>(null);
  const [priorAnswer, setPriorAnswer] = useState<RepairAnswer>(null);
  const [stopped, setStopped] = useState(false);
  const [command, setCommand] = useState("");
  const [announcement, setAnnouncement] = useState("Ready for your next answer.");
  const questionRef = useRef<HTMLHeadingElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const modeLabel = modes.find((item) => item.id === mode)?.label || "Step by step";
  const presentation = useMemo(() => buildJourneyPresentation({ mode, repairAnswer, stopped }), [mode, repairAnswer, stopped]);
  const allocation = useMemo(() => allocateNextDollar({ fixture: founderAllocationFixture(), repairRequiredForWork: repairAnswer === "yes" ? true : repairAnswer === "no" ? false : null }), [repairAnswer]);
  const recommendation = allocation.options.find((option) => option.id === allocation.recommendedId) || null;

  useEffect(() => { if (repairAnswer) confirmationRef.current?.focus(); }, [repairAnswer]);

  const recordRepairAnswer = useCallback((answer: Exclude<RepairAnswer, null>) => {
    setPriorAnswer((current) => repairAnswer ?? current); setRepairAnswer(answer); setStopped(false);
    setAnnouncement(answer === "unsure" ? "You confirmed that the repair consequence is uncertain. Guidance remains preliminary." : `You confirmed that the repair ${answer === "yes" ? "is" : "is not"} required for work. The recommendation was recalculated.`);
  }, [repairAnswer]);
  const applyStatement = useCallback((statement: string) => {
    const nextMode = guidanceModeFromStatement(statement, mode);
    if (nextMode !== mode) { setMode(nextMode); setAnnouncement(`Guidance changed to ${modes.find((item) => item.id === nextMode)?.label}. Your financial facts are unchanged.`); return "applied" as const; }
    if (/\b(?:yes|need it|required).*(?:work|working)\b/i.test(statement)) { recordRepairAnswer("yes"); return "applied" as const; }
    if (/\b(?:no|can wait|not required)\b/i.test(statement)) { recordRepairAnswer("no"); return "applied" as const; }
    if (/\b(?:not sure|don't know|do not know|uncertain)\b/i.test(statement)) { recordRepairAnswer("unsure"); return "applied" as const; }
    setCommand(statement); setAnnouncement("Statement added for review. No financial fact changed."); return "held" as const;
  }, [mode, recordRepairAnswer]);
  const speech = useBrowserSpeech({ onFinalTranscript: (transcript) => applyStatement(transcript), stopSpeaking: () => window.speechSynthesis?.cancel() });
  const submitCommand = () => { const statement = command.trim(); if (!statement) return; applyStatement(statement); setCommand(""); speech.resetActiveTurn(); };
  const changeAnswer = () => { setPriorAnswer(repairAnswer); setRepairAnswer(null); setStopped(false); setAnnouncement("Answer reopened. Choose the answer that is true now."); requestAnimationFrame(() => questionRef.current?.focus()); };
  const undoAnswer = () => { setRepairAnswer(priorAnswer); setPriorAnswer(null); setStopped(false); setAnnouncement("The last answer was undone and the prior valid state was restored."); };

  const allocationLines = recommendation?.allocations.filter((line) => line.allocated > 0) || [];
  const allocationSummary = <div className={styles.allocation}>{allocationLines.map((line) => <p key={line.needId}><span>{line.title === "Upcoming current rent" ? "Rent reserve" : line.title}</span><strong>{money(line.allocated)}</strong></p>)}</div>;

  if (stopped) return <main className={styles.journey}>
    <section className={styles.completion} aria-labelledby="completion-heading"><p className={styles.context}>Your money picture</p><h1 id="completion-heading">You have a workable next step.</h1>{allocationSummary}<p>Nothing has been moved or saved.</p><button className={styles.primary} onClick={() => setAnnouncement("Done for now. Nothing was moved or saved.")}>Done for now</button><div className={styles.quietActions}><button onClick={() => setStopped(false)}>Resume</button><button onClick={() => { setStopped(false); setMode("expert"); }}>Review details</button></div></section><p aria-live="polite" className="sr-only">{announcement}</p>
  </main>;

  return <main className={styles.journey}>
    <header className={styles.intro}><p className={styles.context}>Your money picture</p><h1>Decide what your available money should do first.</h1><p><strong>$900 is available before your next paycheck.</strong> A few needs are competing for it.</p></header>

    <details className={styles.guidance}><summary><span>Guidance: <strong>{modeLabel}</strong></span><span className={styles.changeLabel}>Change</span></summary><div className={styles.modeChoices} role="group" aria-label="Guidance pace">{modes.map((item) => <button key={item.id} className={styles.modeChoice} aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setAnnouncement(`Guidance changed to ${item.label}. Your financial facts are unchanged.`); }}><span>{mode === item.id ? "✓ " : ""}{item.label}</span><small>{item.description}</small></button>)}</div></details>

    {presentation.currentQuestion ? <section className={styles.decision} aria-labelledby="repair-question"><p>One answer could change the recommendation.</p><h2 id="repair-question" ref={questionRef} tabIndex={-1}>{presentation.currentQuestion}</h2><div className={styles.choices} role="group" aria-label="Repair requirement"><button className={styles.choice} aria-pressed="false" onClick={() => recordRepairAnswer("yes")}>Yes — I need it to keep working</button><button className={styles.choice} aria-pressed="false" onClick={() => recordRepairAnswer("no")}>No — it can wait</button><button className={styles.choice} aria-pressed="false" onClick={() => recordRepairAnswer("unsure")}>I’m not sure</button></div><details className={styles.why}><summary>Why this matters</summary><p>If the repair protects your ability to earn income, it may need to come before older obligations.</p></details><details className={styles.alternateAnswer}><summary>Answer another way</summary><Composer command={command} setCommand={setCommand} submitCommand={submitCommand} speech={speech} /></details></section> : null}

    {repairAnswer ? <><section className={styles.confirmed} aria-labelledby="confirmed-heading" data-answer={repairAnswer} ref={confirmationRef} tabIndex={-1}><p id="confirmed-heading">You confirmed</p><h2>✓ {repairAnswer === "yes" ? "Required for work" : repairAnswer === "no" ? "The repair can wait" : "The consequence is still uncertain"}</h2><div className={styles.quietActions}><button onClick={changeAnswer}>Change</button><button onClick={undoAnswer}>Undo</button></div></section><section className={styles.synthesis} aria-labelledby="changed-heading"><h2 id="changed-heading">What changed</h2><p>{presentation.synthesis}</p></section></> : null}

    {repairAnswer === "unsure" ? <section className={styles.warning}><h2>Preliminary guidance</h2><p>Keep the $900 uncommitted until you verify whether delaying the repair would affect your ability to keep working.</p></section> : null}

    {recommendation ? <section className={styles.recommendation} aria-labelledby="recommendation-heading"><p className={styles.context}>Current recommendation</p><h2 id="recommendation-heading">{recommendation.title}</h2>{allocationSummary}<p className={styles.rationale}>{allocation.simpleExplanation}</p><p className={styles.caveat}>{allocation.limitation}</p></section> : null}

    {mode === "concise" && repairAnswer ? <section className={styles.compactReview} aria-labelledby="situation-heading"><h2 id="situation-heading">Your situation</h2><dl><div><dt>Available now</dt><dd>$900</dd></div><div><dt>Required now</dt><dd>$75 card minimum</dd></div><div><dt>Timing unconfirmed</dt><dd>$180 utility</dd></div><div><dt>Excluded</dt><dd>Credit, investments, possible commission</dd></div></dl><div className={styles.quietActions}><button onClick={changeAnswer}>Adjust</button><button onClick={() => setMode("expert")}>Show math</button></div></section> : null}

    {mode === "expert" && repairAnswer ? <section className={styles.expert} aria-labelledby="details-heading"><h2 id="details-heading">Full financial reasoning</h2><details><summary>Goal and available resources</summary><p>Decide how to use $900 before the next paycheck while protecting essential needs.</p></details><details><summary>Timing and required obligations</summary><p>The $75 card minimum is required. Utility timing and useful partial arrears payments remain unconfirmed.</p></details><details><summary>Protected priorities</summary><p>Groceries, medication, and current housing remain protected.</p></details><details><summary>Assumptions and missing facts</summary><ul>{recommendation?.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details><details><summary>Evidence and calculation</summary><p>Available cash is $900. Credit, investments, and possible commission are excluded. The recommended allocations total no more than available cash.</p></details></section> : null}

    {repairAnswer ? <section className={styles.next} aria-labelledby="next-heading"><p className={styles.context}>Next</p><h2 id="next-heading">{repairAnswer === "unsure" ? "Verify whether delaying the repair would affect your ability to work." : "Confirm whether the utility is due before your next paycheck."}</h2><button className={styles.primary} onClick={() => setAnnouncement(repairAnswer === "unsure" ? "Verification is the next step. No money was moved." : "Utility timing is the next fact to review. No money was moved.")}>Continue</button><button className={styles.textAction} onClick={() => setStopped(true)}>Stop here</button></section> : null}

    {repairAnswer ? <section className={styles.standardComposer}><Composer command={command} setCommand={setCommand} submitCommand={submitCommand} speech={speech} /></section> : null}

    <details className={styles.known}><summary>What Covarify already knows</summary><ul>{presentation.completedContext.map((fact) => <li key={fact}>{fact}</li>)}</ul></details>
    <p className={styles.boundary}>This is a controlled, read-only preview. Nothing is moved, activated, or saved to Financial Memory.</p>
    <details className={styles.founderTools}><summary>Founder testing tools</summary><p>Guidance: {mode}. Completion: {presentation.completion}. Critical missing facts: {presentation.criticalMissingFacts.join(", ") || "none"}.</p></details>
    <p aria-live="polite" className="sr-only">{announcement}</p>
  </main>;
}

type ComposerProps = { command: string; setCommand: (value: string) => void; submitCommand: () => void; speech: ReturnType<typeof useBrowserSpeech> };
function Composer({ command, setCommand, submitCommand, speech }: ComposerProps) {
  return <div className={styles.composer} aria-label="Text and voice input"><label><span>Message</span><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitCommand(); }} placeholder="Type an answer or guidance request" /></label><div><button onClick={submitCommand}>Send</button><button onClick={speech.listening ? speech.stop : speech.start}>{speech.listening ? "Stop microphone" : "Microphone"}</button></div><p aria-live="polite">{speech.status}</p></div>;
}
