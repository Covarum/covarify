import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { loadRecurringCommitments } from "@/lib/recurring-commitments-server";
import { RecurringCommitmentsWorkspace } from "./recurring-workspace";
import { parseFinancialPeriodSelection, resolveFinancialPeriod } from "@/lib/financial-periods";

export const dynamic = "force-dynamic";

export default async function RecurringCommitmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account/recurring");
  const query = await searchParams;
  let period;
  try {
    period = resolveFinancialPeriod(parseFinancialPeriodSelection(query));
  } catch {
    period = resolveFinancialPeriod({ key: "this-month" });
  }
  const data = await loadRecurringCommitments(user.id);
  return <RecurringCommitmentsWorkspace initialData={{ ...data, period }} initialQuery={{
    search: Array.isArray(query.search) ? query.search[0] || "" : query.search || "",
    status: Array.isArray(query.status) ? query.status[0] || "all" : query.status || "all",
    commitment: Array.isArray(query.commitment) ? query.commitment[0] || null : query.commitment || null,
  }} />;
}
