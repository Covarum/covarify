const covarifyApiUrl = process.env.EXPO_PUBLIC_COVARIFY_API_URL;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const missingVariables = [
  ["EXPO_PUBLIC_COVARIFY_API_URL", covarifyApiUrl],
  ["EXPO_PUBLIC_SUPABASE_URL", supabaseUrl],
  ["EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", supabasePublishableKey],
]
  .filter((entry) => !entry[1]?.trim())
  .map(([name]) => name);

if (missingVariables.length > 0) {
  throw new Error(
    `Mobile environment configuration is incomplete. Add the following public variables to mobile/.env: ${missingVariables.join(", ")}. See mobile/.env.example.`,
  );
}

export const mobileEnv = {
  covarifyApiUrl: covarifyApiUrl as string,
  supabaseUrl: supabaseUrl as string,
  supabasePublishableKey: supabasePublishableKey as string,
} as const;
