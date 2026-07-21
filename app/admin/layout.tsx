import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, LayoutDashboard, LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { Brand } from "@/components/site/site-shell";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { isFounderAdmin } from "@/lib/waitlist-core";
import "@/styles/admin.css";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/admin");
  if (!isFounderAdmin(user, process.env.COVARIFY_ADMIN_EMAILS)) redirect("/account");
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Brand />
      <div><p className="admin-overline">Founder console</p><strong>Waitlist CRM</strong></div>
      <nav aria-label="Admin navigation">
        <Link href="/admin"><LayoutDashboard size={17} /> Overview</Link>
        <Link href="/admin/waitlist"><ClipboardList size={17} /> Applications</Link>
      </nav>
      <div className="admin-user"><span>{user.email}</span><form action={signOut}><button type="submit"><LogOut size={14} /> Sign out</button></form></div>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}
