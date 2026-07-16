import assert from "node:assert/strict";
import test from "node:test";
import { handleEarlyAccessPost } from "../app/api/early-access/route.ts";

test("valid submission reaches both Resend calls with an Eastern timestamp", async () => {
  const previousEnvironment = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EARLY_ACCESS_NOTIFY_EMAIL: process.env.EARLY_ACCESS_NOTIFY_EMAIL,
    EARLY_ACCESS_FROM_EMAIL: process.env.EARLY_ACCESS_FROM_EMAIL,
    EARLY_ACCESS_REPLY_TO_EMAIL: process.env.EARLY_ACCESS_REPLY_TO_EMAIL,
  };
  Object.assign(process.env, {
    RESEND_API_KEY: "test-api-key",
    EARLY_ACCESS_NOTIFY_EMAIL: "admin@example.com",
    EARLY_ACCESS_FROM_EMAIL: "Covarify <early-access@example.com>",
    EARLY_ACCESS_REPLY_TO_EMAIL: "reply@example.com",
  });

  const calls = [];
  const mockResend = {
    emails: {
      async send(message) {
        calls.push(message);
        return { data: { id: `mock-email-${calls.length}` }, error: null };
      },
    },
  };

  try {
    const request = new Request("http://localhost/api/early-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tara Example", email: "tara@example.com", stress: "", decision: "", website: "" }),
    });
    const response = await handleEarlyAccessPost(request, () => mockResend);

    assert.equal(response.status, 200);
    assert.equal(calls.length, 2, "administrator and applicant calls should both be attempted");
    assert.equal(calls[0].to, "admin@example.com", "administrator notification should be first");
    assert.equal(calls[1].to, "tara@example.com", "applicant acknowledgement should be second");
    assert.match(calls[0].text, /Submitted:\n[A-Z][a-z]+, [A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2}:\d{2} [AP]M E(?:ST|DT)/);
  } finally {
    for (const [key, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
