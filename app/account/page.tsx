import { redirect } from "next/navigation";
import { AuthenticatedWorkspace } from "@/components/account/authenticated-workspace";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

function founderName(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>) {
  const metadataName = [user.user_metadata?.full_name, user.user_metadata?.name, user.user_metadata?.first_name].find((value) => typeof value === "string" && value.trim());
  const fallback = user.email?.split("@")[0]?.split(/[._-]/)[0] || "there";
  const raw = String(metadataName || fallback).trim().split(/\s+/)[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function timeGreeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function AccountPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account");
  return <AuthenticatedWorkspace firstName={founderName(user)} email={user.email || "Signed-in founder"} greeting={timeGreeting()} />;
}
