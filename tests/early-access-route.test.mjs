import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { handleEarlyAccessPost } from "../app/api/early-access/route.ts";
import { applicationsToCsv, buildApplicationUpdate, filterAndSortApplications, isFounderAdmin } from "../lib/waitlist-core.ts";

const baseApplication = {
  id: "11111111-1111-4111-8111-111111111111", application_id: "CF-000001", created_at: "2026-07-20T16:00:00.000Z", updated_at: "2026-07-20T16:00:00.000Z",
  name: "Tara Example", email: "tara@example.com", financial_stress: "Planning", decision: "Next move", lead_source: "Instagram", lead_source_detail: "",
  referred_by_name: "", utm_source: "social", utm_medium: "organic", utm_campaign: "beta", status: "waiting", founder_notes: "Follow up", invited_at: null,
  activated_at: null, admin_email_sent: false, confirmation_email_sent: false,
};

const databaseDependencies = (events = []) => ({
  async createApplication() { events.push("stored"); return { id: baseApplication.id, application_id: baseApplication.application_id }; },
  async markEmail(_id, field) { events.push(field); },
});

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
    const response = await handleEarlyAccessPost(request, () => mockResend, databaseDependencies());

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

test("admin authorization defaults to deny and distinguishes allowed founders", () => {
  assert.equal(isFounderAdmin(null, "founder@example.com"), false, "unauthenticated access is denied");
  assert.equal(isFounderAdmin({ email: "other@example.com" }, "founder@example.com"), false, "non-admin access is denied");
  assert.equal(isFounderAdmin({ email: "FOUNDER@example.com" }, "founder@example.com, admin@example.com"), true, "allowlisted founder is allowed");
  assert.equal(isFounderAdmin({ email: "founder@example.com" }, undefined), false, "missing environment variable denies access");
});

test("waitlist query searches, filters, and sorts newest first", () => {
  const older = { ...baseApplication, id: "22222222-2222-4222-8222-222222222222", application_id: "CF-000002", created_at: "2026-07-19T16:00:00.000Z", name: "Referral Lead", email: "lead@example.com", lead_source: "Professional Referral", lead_source_detail: "Advisor network", status: "invited", founder_notes: "Priority" };
  assert.deepEqual(filterAndSortApplications([older, baseApplication]).map((row) => row.application_id), ["CF-000001", "CF-000002"]);
  assert.deepEqual(filterAndSortApplications([older, baseApplication], { search: "advisor" }).map((row) => row.application_id), ["CF-000002"]);
  assert.deepEqual(filterAndSortApplications([older, baseApplication], { status: "waiting" }).map((row) => row.application_id), ["CF-000001"]);
  assert.deepEqual(filterAndSortApplications([older, baseApplication], { leadSource: "Professional Referral" }).map((row) => row.application_id), ["CF-000002"]);
});

test("founder-note updates preserve timestamps and status timestamps are first-write only", () => {
  assert.deepEqual(buildApplicationUpdate({ invited_at: "2026-07-20T00:00:00Z", activated_at: null }, { founder_notes: "Updated" }, "2026-07-21T00:00:00Z"), { founder_notes: "Updated" });
  assert.deepEqual(buildApplicationUpdate({ invited_at: null, activated_at: null }, { status: "invited" }, "2026-07-21T00:00:00Z"), { status: "invited", invited_at: "2026-07-21T00:00:00Z" });
  assert.deepEqual(buildApplicationUpdate({ invited_at: "2026-07-20T00:00:00Z", activated_at: null }, { status: "invited" }, "2026-07-21T00:00:00Z"), { status: "invited" });
});

test("CSV export escapes commas, quotes, and newlines", () => {
  const csv = applicationsToCsv([{ ...baseApplication, founder_notes: "Called, said \"yes\"\nNext week" }]);
  assert.match(csv, /"Called, said ""yes""\nNext week"/);
});

test("email failure retains the durably stored row and returns success", async () => {
  const previous = { RESEND_API_KEY: process.env.RESEND_API_KEY, EARLY_ACCESS_NOTIFY_EMAIL: process.env.EARLY_ACCESS_NOTIFY_EMAIL, EARLY_ACCESS_FROM_EMAIL: process.env.EARLY_ACCESS_FROM_EMAIL, EARLY_ACCESS_REPLY_TO_EMAIL: process.env.EARLY_ACCESS_REPLY_TO_EMAIL };
  Object.assign(process.env, { RESEND_API_KEY: "test", EARLY_ACCESS_NOTIFY_EMAIL: "admin@example.com", EARLY_ACCESS_FROM_EMAIL: "from@example.com", EARLY_ACCESS_REPLY_TO_EMAIL: "reply@example.com" });
  const events = [];
  const request = new Request("http://localhost/api/early-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Test Lead", email: "lead@example.com", leadSource: "Other" }) });
  const response = await handleEarlyAccessPost(request, () => ({ emails: { async send() { events.push("email-attempt"); throw new Error("provider down"); } } }), databaseDependencies(events));
  assert.equal(response.status, 200); assert.equal((await response.json()).emailWarning, true); assert.equal(events[0], "stored"); assert.equal(events.filter((event) => event === "stored").length, 1);
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

test("client admin component contains no service-role material", async () => {
  const clientSource = await readFile(new URL("../components/admin/copy-email-button.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(clientSource, /service.?role|SUPABASE_SERVICE_ROLE_KEY|COVARIFY_ADMIN_EMAILS/i);
});
