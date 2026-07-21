import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { applicationsToCsv, isFounderAdmin } from "@/lib/waitlist-core";
import { listBetaApplications } from "@/lib/waitlist";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!isFounderAdmin(user, process.env.COVARIFY_ADMIN_EMAILS)) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const rows = await listBetaApplications({ search: url.searchParams.get("q") || "", status: url.searchParams.get("status") || "all", leadSource: url.searchParams.get("source") || "all", sort: url.searchParams.get("sort") === "oldest" ? "oldest" : "newest" });
  return new Response(`\uFEFF${applicationsToCsv(rows)}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="covarify-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "private, no-store" } });
}
