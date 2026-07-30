# Project Pocket mobile

Project Pocket is Covarify's Expo and React Native application foundation for
iOS and Android. It currently supports approved-user sign-in only. Public
signup remains intentionally unavailable during the controlled beta.

## Install

From the repository root:

```sh
pnpm install
```

Copy `mobile/.env.example` to `mobile/.env` and provide:

- `EXPO_PUBLIC_COVARIFY_API_URL`: the existing Covarify backend base URL.
- `EXPO_PUBLIC_SUPABASE_URL`: the existing Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the client-safe publishable key.

All `EXPO_PUBLIC_*` values are compiled into the app and must be treated as
public. Never place a service-role key, Plaid secret, database credential, or
other server-only value in this file.

## Run locally

```sh
pnpm --dir mobile start
```

Create native development builds with:

```sh
pnpm --dir mobile exec expo run:ios
pnpm --dir mobile exec expo run:android
```

The checked-in project intentionally has no generated `ios/` or `android/`
directories. Local prebuild/run commands generate them as ignored artifacts.
The app includes `expo-dev-client`, and development builds are the intended
testing path because Step 3 will add native capabilities unavailable in a
generic Expo Go client. Expo Go may help with early UI checks, but it is not
the final validation environment.

## Authentication and persistence

The app calls Supabase `signInWithPassword` and does not offer signup or
password reset. Supabase restores the session on startup and refreshes access
tokens while the app is active. Session data is stored with a chunked
`expo-secure-store` adapter so it uses platform-protected storage without
depending on a single SecureStore value being large enough for the session.
Signing out from the **You** tab clears the Supabase session and returns to
sign-in.

`lib/api.ts` is the future backend request scaffold. It reads the current
Supabase session and sends `Authorization: Bearer <access token>` to the
configured Covarify API. It is not called by the current screens.

## Development-client configuration

`eas.json` contains a development-client profile, but Step 2 does not run an
EAS cloud build. The proposed native identifiers are
`com.covarify.mobile` for both platforms and the proposed URL scheme is
`covarify`. They have not been registered or published.

## Current limitations

- No public signup or password reset.
- No financial data UI or offline cache.
- No analytics, crash reporting, push notifications, biometrics, or camera.
- The text treatment uses committed Covarify colors; final mobile logo and font
  assets still need a confirmed native asset package.
- Native Plaid Link is intentionally deferred to Step 3.
