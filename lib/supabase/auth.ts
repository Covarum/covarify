import "server-only";
import { createSupabaseServerClient } from "./server";
export async function getAuthenticatedUser() { const { data, error } = await (await createSupabaseServerClient()).auth.getUser(); return error ? null : data.user; }
export async function requireAuthenticatedUser() { const user = await getAuthenticatedUser(); if (!user) throw new Error("AUTHENTICATION_REQUIRED"); return { id: user.id } as const; }
