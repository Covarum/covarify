import { NextResponse } from "next/server";
import { Resend } from "resend";

const LIMITS = { name: 100, email: 254, stress: 1500, decision: 1500 } as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLIENT_ERROR = { ok: false, error: "SUBMISSION_FAILED", message: "We couldn’t submit your request just yet. Please try again." };
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json(CLIENT_ERROR, { status: 400 });

    const record = body as Record<string, unknown>;
    const name = clean(record.name);
    const email = clean(record.email);
    const stress = clean(record.stress);
    const decision = clean(record.decision);
    const website = clean(record.website);

    if (website) return NextResponse.json({ ok: true }, { status: 202 });

    const invalid = !name || name.length > LIMITS.name || !EMAIL_PATTERN.test(email) || email.length > LIMITS.email || stress.length > LIMITS.stress || decision.length > LIMITS.decision;
    if (invalid) return NextResponse.json(CLIENT_ERROR, { status: 400 });

    const apiKey = process.env.RESEND_API_KEY;
    const notifyEmail = process.env.EARLY_ACCESS_NOTIFY_EMAIL;
    const fromEmail = process.env.EARLY_ACCESS_FROM_EMAIL;
    const replyToEmail = process.env.EARLY_ACCESS_REPLY_TO_EMAIL;
    if (!apiKey || !notifyEmail || !fromEmail || !replyToEmail) {
      console.error("Early-access email configuration is incomplete.");
      return NextResponse.json(CLIENT_ERROR, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const submitted = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "long", timeZoneName: "short" }).format(new Date());
    const adminResult = await resend.emails.send({
      from: fromEmail,
      to: notifyEmail,
      replyTo: email,
      subject: `New Covarify early-access request — ${name}`,
      text: `New Covarify early-access request\n\nName: ${name}\nEmail: ${email}\n\nBiggest financial stress:\n${stress || "Not provided"}\n\nWhat clarity would help them decide:\n${decision || "Not provided"}\n\nSubmitted:\n${submitted}\n\nSource:\nCovarify early-access page`,
    });

    if (adminResult.error || !adminResult.data?.id) {
      console.error("Early-access administrator notification failed.");
      return NextResponse.json(CLIENT_ERROR, { status: 502 });
    }

    try {
      const acknowledgement = await resend.emails.send({
        from: fromEmail,
        to: email,
        replyTo: replyToEmail,
        subject: "You’re in the know — Covarify early access",
        text: `Hi ${name.split(/\s+/)[0]},\n\nYour request is in.\n\nCovarify is opening its private beta in small groups, and we’ll reach out as spots become available.\n\nFinancial clarity starts with being able to see the full picture. Thank you for helping us shape what comes next.\n\nFrom Complexity to Confidence.\n\nCovarify`,
      });
      if (acknowledgement.error || !acknowledgement.data?.id) console.error("Early-access applicant acknowledgement failed.");
    } catch {
      console.error("Early-access applicant acknowledgement failed.");
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    console.error("Early-access submission failed.");
    return NextResponse.json(CLIENT_ERROR, { status: 400 });
  }
}
