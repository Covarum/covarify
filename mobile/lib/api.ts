import { supabase } from "./supabase";

const apiUrl = process.env.EXPO_PUBLIC_COVARIFY_API_URL;

export async function covarifyApiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!apiUrl) {
    throw new Error("The Covarify API URL is not configured.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Authentication is required.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(new URL(path, apiUrl), { ...init, headers });
}
