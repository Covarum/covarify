import "server-only";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { isExactFounderAllowlistMatch } from "@/lib/financial-event-confirmations";

export async function requireFounderReviewUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account/events/review");
  let allowed = false;
  try {
    allowed = isExactFounderAllowlistMatch(
      user.id,
      readProductionPlaidConfig().allowedUserIds,
    );
  } catch {
    allowed = false;
  }
  if (!allowed) redirect("/account");
  return user;
}
