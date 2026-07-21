"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFounderAdmin, updateBetaApplication } from "@/lib/waitlist";
import { WAITLIST_STATUSES, WaitlistStatus } from "@/lib/waitlist-core";

export async function updateApplicationAction(formData: FormData) {
  const admin = await requireFounderAdmin();
  if (!admin) redirect("/login?next=/admin/waitlist");
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  const founderNotes = String(formData.get("founder_notes") || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error("INVALID_APPLICATION_ID");
  if (!WAITLIST_STATUSES.includes(status as WaitlistStatus)) throw new Error("INVALID_WAITLIST_STATUS");
  if (founderNotes.length > 5000) throw new Error("FOUNDER_NOTES_TOO_LONG");
  await updateBetaApplication(id, { status: status as WaitlistStatus, founder_notes: founderNotes });
  revalidatePath("/admin"); revalidatePath("/admin/waitlist"); revalidatePath(`/admin/waitlist/${id}`);
  redirect(`/admin/waitlist/${id}?saved=1`);
}
