import "react-native-url-polyfill/auto";

import { AppState, Platform } from "react-native";
import { createClient, processLock } from "@supabase/supabase-js";

import { mobileEnv } from "./env";
import { secureSessionStorage } from "./secure-storage";

export const supabase = createClient(
  mobileEnv.supabaseUrl,
  mobileEnv.supabasePublishableKey,
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
