"use client";

import { Check, ChevronRight, Clock3, History, RotateCcw, ShieldCheck } from "lucide-react";
import type { DecisionRecord, DecisionScope } from "./decision-ledger-types";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const time = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const scopes: DecisionScope[] = ["This week", "This billing cycle", "Until end of month", "Until cash flow is neutral", "Custom date", "Ongoing until changed"];

type Props = {
  records: DecisionRecord[];
  onConfirm: (id: string) => void;
  onEdit: (record: DecisionRecord) => void;
  onSuggest: (id: string) => void;
  onDismiss: (id: string) => void;
  onUndo: (id: string) => void;
  onReview: (record: DecisionRecord) => void;
  onScope: (id: string, scope: DecisionScope, customDate?: string) => void;
};

const sectionFor = (status: DecisionRecord["status"]) => status === "applied" ? "Active decisions" : status === "pending_confirmation" || status === "suggestion" ? "Pending confirmation" : status === "scenario_only" ? "Scenario history" : "Past decisions";

export function DecisionLedger({ records, onConfirm, onEdit, onSuggest, onDismiss, onUndo, onReview, onScope }: Props) {
  const sections = ["Active decisions", "Pending confirmation", "Scenario history", "Past decisions"] as const;
  return <section className="decision-ledger" id="decision-ledger" aria-labelledby="decision-ledger-title">
    <div className="ledger-heading"><div><p className="eyebrow plain">Decision Ledger v0</p><h3 id="decision-ledger-title">Covarify records what changed and why.</h3><p>A client-side record of what was heard, previewed, confirmed, applied, or reversed.</p></div><History size={22} /></div>
    <div className="ledger-sections">{sections.map((section) => {
      const items = records.filter((record) => sectionFor(record.status) === section);
      return <div className="ledger-section" key={section}><h4>{section}<span>{items.length}</span></h4>{items.length === 0 ? <p className="ledger-empty">No {section.toLowerCase()} yet.</p> : <div className="ledger-timeline">{items.map((record) => <article className={`ledger-record status-${record.status}`} key={record.id}>
        <div className="ledger-record-head"><span className="ledger-status">{record.status.replaceAll("_", " ")}</span><time dateTime={record.updated_at}>{time(record.updated_at)}</time></div>
        <h5>{record.title}</h5><p>{record.explanation}</p>
        <dl><div><dt>Initiated by</dt><dd>{record.profile_name} · {record.source.replaceAll("_", " ")}</dd></div><div><dt>Estimated impact</dt><dd>{money(record.estimated_cash_impact)}</dd></div><div><dt>Scope</dt><dd>{record.scope_end || "Not set"}</dd></div><div><dt>Confidence</dt><dd>{Math.round(record.confidence * 100)}%</dd></div></dl>
        {(record.status === "pending_confirmation" || record.status === "scenario_only" || record.status === "suggestion") && <div className="ledger-scope"><label>Apply for<select value={scopes.includes(record.scope_end as DecisionScope) ? record.scope_end : "Custom date"} onChange={(event) => onScope(record.id, event.target.value as DecisionScope)}>{scopes.map((scope) => <option key={scope}>{scope}</option>)}</select></label>{(record.scope_end === "Custom date" || /^\d{4}-\d{2}-\d{2}$/.test(record.scope_end)) && <input aria-label="Custom decision end date" type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(record.scope_end) ? record.scope_end : ""} onChange={(event) => onScope(record.id, "Custom date", event.target.value)} />}</div>}
        {record.status === "pending_confirmation" && <p className="ledger-question">I heard a request to {record.title.toLowerCase()}. Should I apply this to the current working plan?</p>}
        <div className="ledger-actions"><button type="button" onClick={() => onReview(record)}>Review <ChevronRight size={12} /></button>{(record.status === "pending_confirmation" || record.status === "scenario_only" || record.status === "suggestion") && <button type="button" className="primary" onClick={() => onConfirm(record.id)}><Check size={12} /> {record.status === "scenario_only" ? "Apply to working plan" : "Confirm"}</button>}{record.status === "pending_confirmation" && <><button type="button" onClick={() => onEdit(record)}>Edit</button><button type="button" onClick={() => onSuggest(record.id)}>Save as suggestion</button><button type="button" onClick={() => onDismiss(record.id)}>Dismiss</button></>}{record.status === "scenario_only" && <span className="preview-label"><Clock3 size={12} /> Preview only</span>}{record.status === "applied" && record.undo_available && <button type="button" onClick={() => onUndo(record.id)}><RotateCcw size={12} /> Undo</button>}</div>
      </article>)}</div>}</div>;
    })}</div>
    <p className="ledger-privacy"><ShieldCheck size={13} /> Covarify records decisions, not audio. Interpreted commands and confirmations remain in this session only.</p>
  </section>;
}
