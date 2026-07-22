import "server-only";
import { Resend } from "resend";
import { ACCOUNT_DELETION_COMPLETED_MESSAGE, ACCOUNT_DELETION_RECEIVED_MESSAGE } from "./policy";

export async function sendAccountDeletionEmail(to: string, stage: "received" | "completed") {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EARLY_ACCESS_FROM_EMAIL?.trim();
  const replyTo = process.env.EARLY_ACCESS_REPLY_TO_EMAIL?.trim() || "contact@covarify.com";
  if (!apiKey || !from) throw new Error("Account-deletion email configuration is incomplete.");
  const message = stage === "received" ? ACCOUNT_DELETION_RECEIVED_MESSAGE : ACCOUNT_DELETION_COMPLETED_MESSAGE;
  const result = await new Resend(apiKey).emails.send({ from, to, replyTo, subject: stage === "received" ? "Covarify account deletion request received" : "Covarify account deletion completed", text: `${message}\n\nIf you have questions, contact contact@covarify.com.\n\nCovarify` });
  if (result.error || !result.data?.id) throw new Error("Account-deletion email delivery failed.");
}
