import { NextResponse } from "next/server.js";
import { Resend } from "resend";

const LIMITS = { name: 100, email: 254, stress: 1500, decision: 1500, detail: 500 } as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLIENT_ERROR = { ok: false, error: "SUBMISSION_FAILED", message: "We couldn’t submit your request just yet. Please try again." };
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
type EmailClient = { emails: { send: Resend["emails"]["send"] } };
type CreateEmailClient = (apiKey: string) => EmailClient;
type StoredApplication = { id: string; application_id: string };
type EarlyAccessDependencies = {
  createApplication(input: { name: string; email: string; financial_stress: string; decision: string; lead_source: string; lead_source_detail: string; referred_by_name: string; utm_source: string; utm_medium: string; utm_campaign: string }): Promise<StoredApplication>;
  markEmail(id: string, field: "admin_email_sent" | "confirmation_email_sent"): Promise<void>;
};

export async function handleEarlyAccessPost(request: Request, createEmailClient: CreateEmailClient, dependencies: EarlyAccessDependencies) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json(CLIENT_ERROR, { status: 400 });
    const record = body as Record<string, unknown>;
    const name = clean(record.name), email = clean(record.email).toLowerCase(), stress = clean(record.stress), decision = clean(record.decision), website = clean(record.website);
    const leadSource = clean(record.leadSource) || "Other", leadSourceDetail = clean(record.leadSourceDetail), referredByName = clean(record.referredByName);
    const utmSource = clean(record.utmSource), utmMedium = clean(record.utmMedium), utmCampaign = clean(record.utmCampaign);
    if (website) return NextResponse.json({ ok: true }, { status: 202 });
    const invalid = !name || name.length > LIMITS.name || !EMAIL_PATTERN.test(email) || email.length > LIMITS.email || stress.length > LIMITS.stress || decision.length > LIMITS.decision || leadSourceDetail.length > LIMITS.detail || referredByName.length > LIMITS.detail;
    if (invalid) return NextResponse.json(CLIENT_ERROR, { status: 400 });

    let application: { id: string; application_id: string };
    try {
      application = await dependencies.createApplication({ name, email, financial_stress: stress, decision, lead_source: leadSource, lead_source_detail: leadSourceDetail, referred_by_name: referredByName, utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
    } catch {
      console.error("Early-access database persistence failed.");
      return NextResponse.json(CLIENT_ERROR, { status: 500 });
    }

    const apiKey = process.env.RESEND_API_KEY, notifyEmail = process.env.EARLY_ACCESS_NOTIFY_EMAIL, fromEmail = process.env.EARLY_ACCESS_FROM_EMAIL, replyToEmail = process.env.EARLY_ACCESS_REPLY_TO_EMAIL;
    if (!apiKey || !notifyEmail || !fromEmail || !replyToEmail) {
      console.error("Early-access email configuration is incomplete.");
      return NextResponse.json({ ok: true, applicationId: application.application_id, emailWarning: true }, { status: 200 });
    }

    const resend = createEmailClient(apiKey);
    const submitted = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "long", timeZone: "America/New_York" }).format(new Date());
    let emailWarning = false;
    try {
      const adminResult = await resend.emails.send({ from: fromEmail, to: notifyEmail, replyTo: email, subject: `New Covarify early-access request — ${name}`, text: `New Covarify early-access request\n\nApplication: ${application.application_id}\nName: ${name}\nEmail: ${email}\nLead source: ${leadSource}${leadSourceDetail ? ` — ${leadSourceDetail}` : ""}${referredByName ? `\nReferred by: ${referredByName}` : ""}\n\nBiggest financial stress:\n${stress || "Not provided"}\n\nWhat clarity would help them decide:\n${decision || "Not provided"}\n\nSubmitted:\n${submitted}` });
      if (!adminResult.error && adminResult.data?.id) await dependencies.markEmail(application.id, "admin_email_sent"); else emailWarning = true;
    } catch { emailWarning = true; console.error("Early-access administrator notification failed; lead retained."); }
    try {
      const acknowledgement = await resend.emails.send({ from: fromEmail, to: email, replyTo: replyToEmail, subject: "You’re in the know — Covarify early access", text: `Hi ${name.split(/\s+/)[0]},\n\nYour request is in.\n\nCovarify is opening its private beta in small groups, and we’ll reach out as spots become available.\n\nFinancial clarity starts with being able to see the full picture. Thank you for helping us shape what comes next.\n\nFrom Complexity to Confidence.\n\nCovarify` });
      if (!acknowledgement.error && acknowledgement.data?.id) await dependencies.markEmail(application.id, "confirmation_email_sent"); else emailWarning = true;
    } catch { emailWarning = true; console.error("Early-access applicant acknowledgement failed; lead retained."); }
    return NextResponse.json({ ok: true, applicationId: application.application_id, ...(emailWarning ? { emailWarning: true } : {}) }, { status: 200 });
  } catch { console.error("Early-access submission failed."); return NextResponse.json(CLIENT_ERROR, { status: 400 }); }
}
export async function POST(request: Request) {
  const { createBetaApplication, markApplicationEmail } = await import("../../../lib/waitlist.ts");
  return handleEarlyAccessPost(request, (apiKey) => new Resend(apiKey), { createApplication: createBetaApplication, markEmail: markApplicationEmail });
}
