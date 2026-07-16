"use client";

import { FormEvent, useRef, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

const SUBMISSION_ERROR = "We couldn’t submit your request just yet. Please try again.";

type FormValues = { name: string; email: string; stress: string; decision: string; website: string };
const initialValues: FormValues = { name: "", email: "", stress: "", decision: "", website: "" };

export function EarlyAccessForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submittedFirstName, setSubmittedFirstName] = useState("");
  const submittingRef = useRef(false);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || !event.currentTarget.reportValidity()) return;
    submittingRef.current = true;
    setStatus("submitting");

    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Submission failed");
      setSubmittedFirstName(values.name.trim().split(/\s+/)[0] || "there");
      setValues(initialValues);
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      submittingRef.current = false;
    }
  }

  if (status === "success") {
    return (
      <div className="access-form success-state" role="status">
        <span className="success-icon" aria-hidden="true"><Check size={25} /></span>
        <p className="eyebrow plain">Request received</p>
        <h2>You’re in the know.</h2>
        <p>Thank you, {submittedFirstName}. We received your early access request. Covarify is opening its private beta in small groups, and we’ll reach out as spots become available.</p>
        <p className="form-fineprint">No obligation. No spam. Just meaningful updates.</p>
        <Link className="button button-primary" href="/">Return to Covarify <ArrowRight size={17} /></Link>
      </div>
    );
  }

  return (
    <form className="access-form" onSubmit={handleSubmit}>
      <div className="form-honeypot" aria-hidden="true">
        <label htmlFor="early-access-website">Website</label>
        <input id="early-access-website" name="website" value={values.website} onChange={(event) => updateValue("website", event.target.value)} tabIndex={-1} autoComplete="off" />
      </div>
      <label>Name<input name="name" autoComplete="name" required maxLength={100} value={values.name} onChange={(event) => updateValue("name", event.target.value)} placeholder="Your name" /></label>
      <label>Email<input type="email" name="email" autoComplete="email" required maxLength={254} value={values.email} onChange={(event) => updateValue("email", event.target.value)} placeholder="you@example.com" /></label>
      <label>Biggest financial stress right now<textarea name="stress" rows={4} maxLength={1500} value={values.stress} onChange={(event) => updateValue("stress", event.target.value)} placeholder="What feels hardest to see clearly?" /></label>
      <label>What would clarity help you decide?<textarea name="decision" rows={4} maxLength={1500} value={values.decision} onChange={(event) => updateValue("decision", event.target.value)} placeholder="The decision in front of you" /></label>
      <p className={`form-status${status === "error" ? " form-error" : ""}`} aria-live="polite">{status === "error" ? SUBMISSION_ERROR : status === "submitting" ? "Submitting…" : ""}</p>
      <button className="button button-primary" type="submit" disabled={status === "submitting"}>{status === "submitting" ? "Submitting…" : <>Request Early Access <ArrowRight size={17} /></>}</button>
      <p className="form-fineprint">Private beta · Limited availability · No obligation</p>
    </form>
  );
}
