import { redirect } from "next/navigation"; import { getAuthenticatedUser } from "@/lib/supabase/auth"; import { signOut } from "../auth/actions";
export const dynamic = "force-dynamic";
export default async function Account(){const user=await getAuthenticatedUser();if(!user)redirect("/login");return <main className="mx-auto max-w-2xl p-8"><h1>Account</h1><p>Signed in as {user.email}</p><form action={signOut}><button>Sign out</button></form></main>}
