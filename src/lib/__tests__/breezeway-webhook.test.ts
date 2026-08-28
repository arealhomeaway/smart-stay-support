/**
 * Regression tests for the Breezeway task webhook receiver.
 *
 * Runs entirely against the fake in-memory `breezeway_webhook_events` table
 * in fakeSupabase.ts — no real Supabase or Breezeway calls. `verifyTask` is
 * injected per case so no test depends on network access, the token cache,
 * or the live rate limiter.
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeBreezewayEventsStore } from "./fakeSupabase";
import { BreezewayError } from "@/lib/breezeway.server";

const store = createFakeBreezewayEventsStore();
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: store.supabaseAdmin }));

const {
  PILOT_COMPANY_ID,
  PILOT_HOME_ID,
  processBreezewayWebhook,
  secretMatches,
  webhookPathToken,
  parseWebhookPayload,
  classifyLookupFailure,
} = await import("@/lib/breezeway-webhook.server");

beforeEach(() => store.reset());

const PILOT_TASK_ID = 555001;
const t1 = "2026-08-27T18:00:00.000Z";
const t0 = "2026-08-27T12:00:00.000Z";

function pilotVerifier(updatedAt: string | null = t1) {
  return async (id: number) => ({ id, homeId: PILOT_HOME_ID, companyId: PILOT_COMPANY_ID, updatedAt });
}

describe("secret path / receiver authentication", () => {
  it("constant-time compares the path token, independent of length", () => {
    expect(secretMatches("correct-token", "correct-token")).toBe(true);
    expect(secretMatches("wrong", "correct-token")).toBe(false);
    expect(secretMatches("", "correct-token")).toBe(false);
    expect(secretMatches("correct-token-but-longer", "correct-token")).toBe(false);
  });

  it("refuses when no path token is configured server-side (never matches an empty expectation)", () => {
    expect(secretMatches("anything", "")).toBe(false);
  });

  it("webhookPathToken reads BREEZEWAY_WEBHOOK_PATH_TOKEN and is empty when unset", () => {
    const prior = process.env["BREEZEWAY_WEBHOOK_PATH_TOKEN"];
    delete process.env["BREEZEWAY_WEBHOOK_PATH_TOKEN"];
    expect(webhookPathToken()).toBe("");
    process.env["BREEZEWAY_WEBHOOK_PATH_TOKEN"] = "abc123";
    expect(webhookPathToken()).toBe("abc123");
    if (prior === undefined) delete process.env["BREEZEWAY_WEBHOOK_PATH_TOKEN"];
    else process.env["BREEZEWAY_WEBHOOK_PATH_TOKEN"] = prior;
  });
});

describe("valid pilot event", () => {
  it("processes a verified pilot task update and records exactly one row", async () => {
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t1 },
      { isFixture: true, verifyTask: pilotVerifier() },
    );
    expect(result.outcome).toBe("processed");
    expect(result.taskId).toBe(PILOT_TASK_ID);
    expect(store.rows().length).toBe(1);
    expect(store.rows()[0]?.["outcome"]).toBe("processed");
    expect(store.touchedTables).toEqual(new Set(["breezeway_webhook_events"]));
  });
});

describe("malformed payload", () => {
  it("rejects a payload with no discoverable task id", async () => {
    const result = await processBreezewayWebhook({ foo: "bar" }, { isFixture: true });
    expect(result.outcome).toBe("invalid");
    expect(result.taskId).toBeNull();
  });

  it("rejects a non-task webhook type without spending a verify call", async () => {
    let calls = 0;
    const result = await processBreezewayWebhook(
      { webhook_type: "reservation", task_id: PILOT_TASK_ID },
      { isFixture: true, verifyTask: async () => { calls += 1; return null; } },
    );
    expect(result.outcome).toBe("invalid");
    expect(calls).toBe(0);
  });

  it("rejects non-object bodies (array, null, string)", async () => {
    expect((await processBreezewayWebhook(null, { isFixture: true })).outcome).toBe("invalid");
    expect((await processBreezewayWebhook([1, 2, 3], { isFixture: true })).outcome).toBe("invalid");
    expect((await processBreezewayWebhook("not json", { isFixture: true })).outcome).toBe("invalid");
  });
});

describe("different company or unmapped property", () => {
  it("drops another property from the payload pre-filter without spending a verify call", async () => {
    let calls = 0;
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: 1, home_id: 1_000_001 },
      { isFixture: true, verifyTask: async () => { calls += 1; return null; } },
    );
    expect(result.outcome).toBe("ignored_other_property");
    expect(calls).toBe(0);
  });

  it("drops another company from the payload pre-filter without spending a verify call", async () => {
    let calls = 0;
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: 2, company_id: 9999 },
      { isFixture: true, verifyTask: async () => { calls += 1; return null; } },
    );
    expect(result.outcome).toBe("ignored_other_company");
    expect(calls).toBe(0);
  });

  it("trusts only the authenticated re-read, not the payload, for scope — payload claims pilot, API says otherwise", async () => {
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: 3, home_id: PILOT_HOME_ID },
      { isFixture: true, verifyTask: async (id) => ({ id, homeId: 555_555, companyId: PILOT_COMPANY_ID, updatedAt: t1 }) },
    );
    expect(result.outcome).toBe("ignored_other_property");
  });

  it("trusts only the authenticated re-read for company too", async () => {
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: 4 },
      { isFixture: true, verifyTask: async (id) => ({ id, homeId: PILOT_HOME_ID, companyId: 42, updatedAt: t1 }) },
    );
    expect(result.outcome).toBe("ignored_other_company");
  });

  it("never retains task detail for out-of-scope deliveries", async () => {
    await processBreezewayWebhook(
      { webhook_type: "task", task_id: 1, home_id: 1_000_001 },
      { isFixture: true },
    );
    await processBreezewayWebhook({ webhook_type: "task", task_id: 2, company_id: 9999 }, { isFixture: true });
    for (const row of store.rows()) {
      expect(row["task_id"]).toBeNull();
      expect(row["home_id"]).toBeNull();
      expect(row["company_id"]).toBeNull();
    }
  });
});

describe("duplicate and older events", () => {
  it("marks the exact same update as duplicate on redelivery", async () => {
    await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t1 },
      { isFixture: true, verifyTask: pilotVerifier(t1) },
    );
    const second = await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t1 },
      { isFixture: true, verifyTask: pilotVerifier(t1) },
    );
    expect(second.outcome).toBe("duplicate");
    expect(store.rows().filter((r) => r["outcome"] === "processed").length).toBe(1);
  });

  it("marks an older update arriving late as stale, without overwriting the newer processed row", async () => {
    await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t1 },
      { isFixture: true, verifyTask: pilotVerifier(t1) },
    );
    const late = await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t0 },
      { isFixture: true, verifyTask: pilotVerifier(t0) },
    );
    expect(late.outcome).toBe("stale");
    expect(store.rows().filter((r) => r["outcome"] === "processed").length).toBe(1);
  });

  it("processes a genuinely newer update for the same task after an earlier one", async () => {
    await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t0 },
      { isFixture: true, verifyTask: pilotVerifier(t0) },
    );
    const newer = await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t1 },
      { isFixture: true, verifyTask: pilotVerifier(t1) },
    );
    expect(newer.outcome).toBe("processed");
    expect(store.rows().filter((r) => r["outcome"] === "processed").length).toBe(2);
  });
});

describe("concurrent duplicate processing", () => {
  it("only ever records one `processed` row when two identical deliveries race", async () => {
    const results = await Promise.all([
      processBreezewayWebhook(
        { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t1 },
        { isFixture: true, verifyTask: pilotVerifier(t1) },
      ),
      processBreezewayWebhook(
        { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t1 },
        { isFixture: true, verifyTask: pilotVerifier(t1) },
      ),
    ]);
    const outcomes = results.map((r) => r.outcome).sort();
    expect(outcomes).toEqual(["duplicate", "processed"]);
    expect(store.rows().filter((r) => r["outcome"] === "processed").length).toBe(1);
  });
});

describe("task re-fetch failure and rate-limit response", () => {
  it("classifies a 500 from Breezeway's task API as a transient, retryable lookup failure — never as processed", async () => {
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID },
      {
        isFixture: true,
        verifyTask: async () => {
          throw new BreezewayError(500, "Breezeway is returning a server error.");
        },
      },
    );
    expect(result.outcome).toBe("verify_failed");
    expect(store.rows()[0]?.["outcome"]).toBe("verify_failed");
    expect(store.rows()[0]?.["retryable"]).toBe(true);
    // The task id must be captured so a later recovery pass can retry it —
    // this is the exact defect the nine historical failures exposed.
    expect(store.rows()[0]?.["task_id"]).toBe(PILOT_TASK_ID);
  });

  it("classifies a 429 rate-limit response the same way — transient, retryable", async () => {
    const failure = classifyLookupFailure(new BreezewayError(429, "rate limited"));
    expect(failure.retryable).toBe(true);
  });

  it("classifies a task genuinely not found (404 -> null) as permanent, not retryable", async () => {
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID },
      { isFixture: true, verifyTask: async () => null },
    );
    expect(result.outcome).toBe("verify_failed");
    expect(store.rows()[0]?.["retryable"]).toBe(false);
  });

  it("classifies an unauthorized/bad-request failure as permanent — a blind retry cannot fix credentials", async () => {
    expect(classifyLookupFailure(new BreezewayError(401, "bad creds")).retryable).toBe(false);
    expect(classifyLookupFailure(new BreezewayError(400, "bad request")).retryable).toBe(false);
  });

  it("classifies a raw network error (not a BreezewayError) as transient", async () => {
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID },
      {
        isFixture: true,
        verifyTask: async () => {
          throw new TypeError("fetch failed");
        },
      },
    );
    expect(result.outcome).toBe("verify_failed");
    expect(store.rows()[0]?.["retryable"]).toBe(true);
  });

  it("never marks a failed re-fetch as processed, and never surfaces a taskId for it externally", async () => {
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID },
      {
        isFixture: true,
        verifyTask: async () => {
          throw new BreezewayError(503, "down");
        },
      },
    );
    expect(result.outcome).not.toBe("processed");
    expect(result.taskId).toBeNull();
  });
});

describe("no business writes, notifications, or matter creation", () => {
  it("only ever touches the webhook events table across every outcome", async () => {
    await processBreezewayWebhook({ webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t1 }, { isFixture: true, verifyTask: pilotVerifier(t1) });
    await processBreezewayWebhook({ webhook_type: "task", task_id: 1, home_id: 1_000_001 }, { isFixture: true });
    await processBreezewayWebhook({ webhook_type: "task", task_id: 2, company_id: 9999 }, { isFixture: true });
    await processBreezewayWebhook({ foo: "bar" }, { isFixture: true });
    await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID + 9 },
      { isFixture: true, verifyTask: async () => { throw new BreezewayError(500, "down"); } },
    );
    expect(store.touchedTables).toEqual(new Set(["breezeway_webhook_events"]));
  });

  it("the result object never carries anything beyond outcome/reason/taskId (no matter id, no dispatch confirmation, etc.)", async () => {
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: PILOT_TASK_ID, updated_at: t1 },
      { isFixture: true, verifyTask: pilotVerifier(t1) },
    );
    expect(Object.keys(result).sort()).toEqual(["outcome", "reason", "taskId"]);
  });
});

describe("parseWebhookPayload", () => {
  it("reads task id and property/company from either the root or a nested data/task/payload bag", () => {
    expect(parseWebhookPayload({ task_id: 1 })?.taskId).toBe(1);
    expect(parseWebhookPayload({ data: { id: 2 } })?.taskId).toBe(2);
    expect(parseWebhookPayload({ task: { task_id: 3 } })?.taskId).toBe(3);
    expect(parseWebhookPayload({ payload: { id: 4 } })?.taskId).toBe(4);
  });

  it("returns null when no task id can be found anywhere", () => {
    expect(parseWebhookPayload({ home_id: PILOT_HOME_ID })).toBeNull();
  });
});
