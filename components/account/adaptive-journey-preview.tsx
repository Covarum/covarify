"use client";

import { useCallback, useMemo, useState } from "react";
import { allocateNextDollar, founderAllocationFixture } from "@/lib/conversation/allocation-intelligence";
import { buildJourneyPresentation, guidanceModeFromStatement, type GuidanceMode, type RepairAnswer } from "@/lib/conversation/journey-presentation";
import { useBrowserSpeech } from "./use-browser-speech";
import styles from "./adaptive-journey-preview.module.css";

const modes: Array<{ id: GuidanceMode; label: string }> = [{ id: "guided", label: "Step by step" }, { id: "concise", label: "Keep it concise" }, { id: "expert", label: "Show me everything" }];
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function AdaptiveJourneyPreview() {
  const [mode, setMode] = useState<GuidanceMode>("guided");
  const [repairAnswer, setRepairAnswer] = useState<RepairAnswer>(null);
  const [priorAnswer, setPriorAnswer] = useState<RepairAnswer>(null);
  const [detailsViewed, setDetailsViewed] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [command, setCommand] = useState("");
  const [announcement, setAnnouncement] = useState("Ready for your next answer.");
  const presentation = useMemo(() => buildJourneyPresentation({ mode, repairAnswer, stopped }), [mode, repairAnswer, stopped]);
  const allocation = useMemo(() => allocateNextDollar({ fixture: founderAllocationFixture(), repairRequiredForWork: repairAnswer === "yes" ? true : repairAnswer === "no" ? false : null }), [repairAnswer]);
  const recommendation = allocation.options.find((option) => option.id === allocation.recommendedId) || null;

  const recordRepairAnswer = useCallback((answer: Exclude<RepairAnswer, null>) => {
    setPriorAnswer(repairAnswer); setRepairAnswer(answer); setStopped(false);
    setAnnouncement(answer === "unsure" ? "Recorded: the repair consequence is unconfirmed. The recommendation remains preliminary." : `Recorded: the repair ${answer === "yes" ? "is" : "is not"} required to keep working. The recommendation was recalculated.`);
  }, [repairAnswer]);
  const applyStatement = useCallback((statement: string) => {
    const nextMode = guidanceModeFromStatement(statement, mode);
    if (nextMode !== mode) { setMode(nextMode); setAnnouncement(`Guidance changed to ${modes.find((item) => item.id === nextMode)?.label}. Financial facts and calculations are unchanged.`); return "applied" as const; }
    if (/\b(?:yes|need it|required).*(?:work|working)\b/i.test(statement)) { recordRepairAnswer("yes"); return "applied" as const; }
    if (/\b(?:no|can wait|not required)\b/i.test(statement)) { recordRepairAnswer("no"); return "applied" as const; }
    if (/\b(?:not sure|don't know|do not know|uncertain)\b/i.test(statement)) { recordRepairAnswer("unsure"); return "applied" as const; }
    setCommand(statement); setAnnouncement("Statement added for review. No financial fact changed."); return "held" as const;
  }, [mode, recordRepairAnswer]);
  const speech = useBrowserSpeech({ onFinalTranscript: (transcript) => applyStatement(transcript), stopSpeaking: () => window.speechSynthesis?.cancel() });
  const submitCommand = () => { const statement = command.trim(); if (!statement) return; applyStatement(statement); setCommand(""); speech.resetActiveTurn(); };
  const changeAnswer = () => { setPriorAnswer(repairAnswer); setRepairAnswer(null); setStopped(false); setAnnouncement("Answer reopened. Choose the current answer."); };
  const undoAnswer = () => { setRepairAnswer(priorAnswer); setPriorAnswer(null); setStopped(false); setAnnouncement("The last answer was undone. The prior valid state is restored."); };

  if (stopped) return <main className={`${styles.journey} ${styles.paused}`}><p className={styles.eyebrow}>Your money picture</p><h1>You have enough for now.</h1><p>Your answers and recommendation remain available in this browser session. Nothing was saved as a plan.</p><button className={styles.primary} onClick={() => setStopped(false)}>Resume where I left off</button></main>;

  return <main className={styles.journey}>
    <header><p className={styles.eyebrow}>Your money picture</p><h1>What should this money do first?</h1><p>One continuous, read-only preview using deterministic financial fixtures.</p></header>
    <section className={styles.modeControl} aria-labelledby="guidance-heading"><h2 id="guidance-heading">How would you like to work?</h2><div className={styles.modeChoices}>{modes.map((item) => <button key={item.id} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>{item.label}</button>)}</div></section>
    <details className={styles.history}><summary>What we already covered</summary><ul>{presentation.completedContext.map((fact) => <li key={fact}>{fact}</li>)}</ul></details>
    <section className={styles.orientation} aria-label="Journey orientation"><span><small>Completed</small><strong>{presentation.completedContext.length} facts reviewed</strong></span><span><small>Current</small><strong>{presentation.currentTopic}</strong></span><span><small>Next</small><strong>{presentation.nextBestStep}</strong></span></section>
    {presentation.currentQuestion ? <section className={styles.current} aria-labelledby="current-question"><p className={styles.eyebrow}>One thing I need to know</p><h2 id="current-question">{presentation.currentQuestion}</h2><p>Your answer changes whether protecting income should come first.</p><div className={styles.choices}><button className={styles.primary} onClick={() => recordRepairAnswer("yes")}>Yes — I need it to keep working</button><button className={styles.secondary} onClick={() => recordRepairAnswer("unsure")}>I’m not sure</button><details className={styles.more}><summary>More options</summary><button className={styles.secondary} onClick={() => recordRepairAnswer("no")}>No — it can wait</button></details></div></section> : null}
    {repairAnswer ? <section className={styles.current} aria-label="Recorded answer"><div className={styles.recorded}><span><strong>Recorded</strong><br/>{repairAnswer === "yes" ? "The repair is required to keep working." : repairAnswer === "no" ? "The repair can wait." : "The repair consequence is unconfirmed."}</span><div><button onClick={changeAnswer}>Change</button><button onClick={undoAnswer}>Undo</button></div></div>{presentation.synthesis ? <p className={styles.synthesis}><strong>What that changes</strong><br/>{presentation.synthesis}</p> : null}</section> : null}
    {repairAnswer === "unsure" ? <section className={styles.recommendation}><p className={styles.eyebrow}>Preliminary guidance</p><h2>Keep the $900 uncommitted for now.</h2><p>Confirm whether delaying the repair affects work before relying on a final order. Known needs remain recognized; you do not need to list them again.</p></section> : null}
    {recommendation ? <section className={styles.recommendation} aria-labelledby="recommendation-heading"><p className={styles.eyebrow}>Recommendation</p><h2 id="recommendation-heading">{recommendation.title}</h2><p>{allocation.simpleExplanation}</p><div className={styles.allocation}>{recommendation.allocations.filter((line) => line.allocated > 0).map((line) => <p key={line.needId}><span>{line.title}</span><strong>{money(line.allocated)}</strong></p>)}</div><p><strong>Available before the next paycheck:</strong> {money(allocation.availableBeforeNextIncome)}</p><p>{allocation.limitation}</p></section> : null}
    {mode !== "guided" && repairAnswer ? <section className={styles.review} aria-labelledby="whole-picture-heading"><h2 id="whole-picture-heading">Whole-picture review</h2><dl><div><dt>Available now</dt><dd>$900 fixture cash; credit, investments, and possible commission excluded.</dd></div><div><dt>Protected and required</dt><dd>$75 card minimum; groceries and medication remain protected.</dd></div><div><dt>Expected later</dt><dd>$1,800 scheduled paycheck. The invoice remains a receivable until received and owner-available.</dd></div><div><dt>Still uncertain</dt><dd>Utility timing and whether partial arrears payments help.</dd></div></dl>{mode === "expert" || detailsViewed ? <details className={styles.details} open><summary>Assumptions and evidence</summary><ul>{recommendation?.assumptions.map((item) => <li key={item}>{item}</li>)}</ul><p>Evidence: {recommendation?.evidenceIds.join(", ") || "No recommendation evidence yet"}.</p></details> : <button className={styles.secondary} onClick={() => setDetailsViewed(true)}>Show assumptions and evidence</button>}</section> : null}
    <section className={styles.stopping} aria-labelledby="next-step-heading"><p className={styles.eyebrow}>Next Best Step</p><h2 id="next-step-heading">{presentation.nextBestStep}</h2>{presentation.stoppingPoint ? <button className={styles.primary} onClick={() => setStopped(true)}>Stop here — I have enough for now</button> : null}</section>
    <section className={styles.command} aria-label="Text and voice input"><label><span>Message</span><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitCommand(); }} placeholder="Type an answer or guidance request" /></label><button onClick={submitCommand}>Send</button><button onClick={speech.listening ? speech.stop : speech.start}>{speech.listening ? "Stop microphone" : "Microphone"}</button><p aria-live="polite">{speech.status}</p></section>
    <p className={styles.boundary}>Preview boundary: analysis is fixture-only and read-only. No allocation, plan, transcript, or Financial Memory record is saved or activated.</p>
    <details className={styles.founderTools}><summary>Founder testing tools</summary><p>Mode: {mode}. Completion: {presentation.completion}. Critical missing facts: {presentation.criticalMissingFacts.join(", ") || "none"}. Material nonblocking facts: {presentation.materialNonblockingFacts.join(", ")}.</p></details>
    <p aria-live="polite" className="sr-only">{announcement}</p>
  </main>;
}
