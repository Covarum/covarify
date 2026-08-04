import "server-only";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { isExactFounderAllowlistMatch } from "@/lib/financial-event-confirmations";
import { isFounderAdmin } from "@/lib/waitlist-core";

export async function getAuthorizedFounderPreviewUser(
  authenticated?: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>,
) {
  const user = authenticated || await getAuthenticatedUser();
  if (!user) return null;
  return isFounderAdmin(user, process.env.COVARIFY_ADMIN_EMAILS) ? user : null;
}

export async function requireFounderReviewUser() {
  const authenticated = await getAuthenticatedUser();
  if (!authenticated) redirect("/login?next=/account/events/review");
  const user = await getAuthorizedFounderUser(authenticated);
  if (!user) redirect("/account");
  return user;
}

export async function getAuthorizedFounderUser(
  authenticated?: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>,
) {
  const user = authenticated || await getAuthenticatedUser();
  if (!user) return null;
  let allowed = false;
  try {
    allowed = isExactFounderAllowlistMatch(
      user.id,
      readProductionPlaidConfig().allowedUserIds,
    );
  } catch {
    allowed = false;
  }
  return allowed ? user : null;
}
