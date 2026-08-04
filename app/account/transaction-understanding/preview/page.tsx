import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthorizedFounderPreviewUser } from "@/lib/founder-review-auth";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { TransactionUnderstandingPreview } from "@/components/account/transaction-understanding-preview";
import { ConversationStrategyPreview } from "@/components/account/conversation-strategy-preview";

export const dynamic = "force-dynamic";

export default async function TransactionUnderstandingPreviewPage() {
  const authenticated = await getAuthenticatedUser();
  if (!authenticated) redirect("/login?next=/account/transaction-understanding/preview");
  const founder = await getAuthorizedFounderPreviewUser(authenticated);
  if (!founder) return <main style={{ width: "min(680px, calc(100% - 32px))", margin: "64px auto", padding: "32px", border: "1px solid #ded4e4", borderRadius: "24px", background: "white" }} aria-labelledby="founder-review-authorization-heading">
    <p style={{ color: "#7138e8", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".07em", fontSize: ".75rem" }}>Founder review</p>
    <h1 id="founder-review-authorization-heading">This account is not authorized for the founder preview.</h1>
    <p>Authentication succeeded, but this account is not on the founder-review allowlist. No financial or account data was loaded.</p>
    <Link href="/">Return to Covarify</Link>
  </main>;
  return <><ConversationStrategyPreview /><TransactionUnderstandingPreview /></>;
}
