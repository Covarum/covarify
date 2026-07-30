import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { loadRecurringCommitments } from "@/lib/recurring-commitments-server";
import { RecurringCommitmentsWorkspace } from "./recurring-workspace";

export const dynamic = "force-dynamic";

export default async function RecurringCommitmentsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account/recurring");
  const data = await loadRecurringCommitments(user.id);
  return <RecurringCommitmentsWorkspace initialData={data} />;
}
