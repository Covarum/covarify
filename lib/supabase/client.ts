"use client";
import { createBrowserClient } from "@supabase/ssr";
import { readPublicSupabaseConfig } from "./config";
export function createSupabaseBrowserClient() { const { url, key } = readPublicSupabaseConfig(); return createBrowserClient(url, key); }
