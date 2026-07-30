import assert from "node:assert/strict";
import test from "node:test";
import { authenticateRequestWithClient } from "../lib/supabase/request-auth-core.ts";

const user = (id) => ({ id, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "2026-01-01T00:00:00Z" });

function authenticationClient({ cookieUser = null, bearerUsers = new Map(), calls = [] } = {}) {
  return {
    calls,
    auth: {
      async getUser(token) {
        calls.push(token);
        if (token === undefined) return { data: { user: cookieUser }, error: cookieUser ? null : new Error("missing") };
        const bearerUser = bearerUsers.get(token) ?? null;
        return { data: { user: bearerUser }, error: bearerUser ? null : new Error("verification failed") };
      },
    },
  };
}

test("valid browser cookie authentication preserves the parameterless Supabase verification path", async () => {
  const dependency = authenticationClient({ cookieUser: user("browser-user") });
  const result = await authenticateRequestWithClient(new Request("https://www.covarify.com/protected"), dependency);
  assert.equal(result.authenticated, true);
  assert.equal(result.method, "cookie");
  assert.equal(result.user.id, "browser-user");
  assert.deepEqual(dependency.calls, [undefined]);
});

test("valid bearer authentication is verified with Supabase", async () => {
  const dependency = authenticationClient({ bearerUsers: new Map([["valid-token", user("mobile-user")]]) });
  const result = await authenticateRequestWithClient(
    new Request("https://www.covarify.com/protected", { headers: { Authorization: "Bearer valid-token" } }),
    dependency,
  );
  assert.equal(result.authenticated, true);
  assert.equal(result.method, "bearer");
  assert.equal(result.user.id, "mobile-user");
  assert.deepEqual(dependency.calls, ["valid-token"]);
});

test("missing authentication is rejected deterministically", async () => {
  const result = await authenticateRequestWithClient(new Request("https://www.covarify.com/protected"), authenticationClient());
  assert.deepEqual(result, { authenticated: false, error: "AUTHENTICATION_REQUIRED" });
});

for (const [name, authorization, expectedError] of [
  ["malformed authorization header", "Bearer token with spaces", "MALFORMED_AUTHORIZATION"],
  ["unsupported authorization scheme", "Basic abc123", "UNSUPPORTED_AUTHORIZATION_SCHEME"],
  ["empty bearer token", "Bearer ", "MALFORMED_AUTHORIZATION"],
]) {
  test(`${name} is rejected without credential verification`, async () => {
    const dependency = authenticationClient();
    const result = await authenticateRequestWithClient(
      new Request("https://www.covarify.com/protected", { headers: { Authorization: authorization } }),
      dependency,
    );
    assert.deepEqual(result, { authenticated: false, error: expectedError });
    assert.deepEqual(dependency.calls, []);
  });
}

test("invalid, expired, or revoked bearer verification is rejected", async () => {
  for (const token of ["invalid-token", "expired-token", "revoked-token"]) {
    const dependency = authenticationClient();
    const result = await authenticateRequestWithClient(
      new Request("https://www.covarify.com/protected", { headers: { Authorization: `Bearer ${token}` } }),
      dependency,
    );
    assert.deepEqual(result, { authenticated: false, error: "INVALID_BEARER_TOKEN" });
    assert.deepEqual(dependency.calls, [token]);
  }
});

test("valid cookie plus invalid bearer rejects without cookie fallback", async () => {
  const dependency = authenticationClient({ cookieUser: user("browser-user") });
  const result = await authenticateRequestWithClient(
    new Request("https://www.covarify.com/protected", { headers: { Authorization: "Bearer invalid-token", Cookie: "session=valid" } }),
    dependency,
  );
  assert.deepEqual(result, { authenticated: false, error: "INVALID_BEARER_TOKEN" });
  assert.deepEqual(dependency.calls, ["invalid-token"]);
});

test("valid bearer is preferred when both bearer and cookie credentials are valid", async () => {
  const dependency = authenticationClient({
    cookieUser: user("browser-user"),
    bearerUsers: new Map([["valid-token", user("mobile-user")]]),
  });
  const result = await authenticateRequestWithClient(
    new Request("https://www.covarify.com/protected", { headers: { Authorization: "Bearer valid-token", Cookie: "session=valid" } }),
    dependency,
  );
  assert.equal(result.authenticated, true);
  assert.equal(result.method, "bearer");
  assert.equal(result.user.id, "mobile-user");
  assert.deepEqual(dependency.calls, ["valid-token"]);
});

test("authentication results and logs never expose credential values", async () => {
  const credential = "secret-access-token";
  const dependency = authenticationClient({ bearerUsers: new Map([[credential, user("mobile-user")]]) });
  const messages = [];
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = (...values) => messages.push(values);
  console.info = (...values) => messages.push(values);
  console.warn = (...values) => messages.push(values);
  console.error = (...values) => messages.push(values);
  try {
    const result = await authenticateRequestWithClient(
      new Request("https://www.covarify.com/protected", { headers: { Authorization: `Bearer ${credential}` } }),
      dependency,
    );
    assert.doesNotMatch(JSON.stringify(result), new RegExp(credential));
    assert.doesNotMatch(JSON.stringify(messages), new RegExp(credential));
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
});
