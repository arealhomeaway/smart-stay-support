/**
 * Regression tests for the bounded lookup-failure recovery pass. Confirms
 * the behavior the "nine failed events" incident actually needs: transient
 * failures get a bounded number of retries with a recoverable record, a
 * successful retry cannot double-process, and nothing here becomes an
 * unbounded loop.
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeBreezewayEventsStore } from "./fakeSupabase";
import { BreezewayError } from "@/lib/breezeway.server";

const store = createFakeBreezewayEventsStore();
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: store.supabaseAdmin }));

const { processBreezewayWebhook, PILOT_COMPANY_ID, PILOT_HOME_ID } = await import("@/lib/breezeway-webhook.server");
const {
  recoverFailedTaskVerifications,
  RECOVERY_BATCH_SIZE,
  MAX_RETRY_ATTEMPTS,
} = await import("@/lib/breezeway-webhook-recovery.server");

beforeEach(() => store.reset());

const TASK_A = 700001;
const t1 = "2026-08-27T18:00:00.000Z";

async function seedTransientFailure(taskId = TASK_A) {
  const result = await processBreezewayWebhook(
    { webhook_type: "task", task_id: taskId },
    {
      isFixture: false,
      verifyTask: async () => {
        throw new BreezewayError(500, "Breezeway is returning a server error.");
      },
    },
  );
  expect(result.outcome).toBe("verify_failed");
}

describe("recovery of a transient lookup failure", () => {
  it("re-verifies the task on retry and records the real outcome once resolved", async () => {
    await seedTransientFailure();
    expect(store.rows().length).toBe(1);

    const summary = await recoverFailedTaskVerifications({
      verifyTask: async (id) => ({ id, homeId: PILOT_HOME_ID, companyId: PILOT_COMPANY_ID, updatedAt: t1 }),
    });

    expect(summary.attempted).toBe(1);
    expect(summary.recovered).toBe(1);
    expect(summary.stillFailing).toBe(0);
    expect(summary.permanentlyFailed).toBe(0);

    const outcomes = store.rows().map((r) => r["outcome"]);
    expect(outcomes.sort()).toEqual(["processed", "verify_failed"]);

    const originalFailure = store.rows().find((r) => r["outcome"] === "verify_failed");
    expect(originalFailure?.["recovered_at"]).toBeTruthy();
    expect(originalFailure?.["retryable"]).toBe(false);
  });

  it("does not pick the same row up again after it recovers (no double processing)", async () => {
    await seedTransientFailure();
    await recoverFailedTaskVerifications({
      verifyTask: async (id) => ({ id, homeId: PILOT_HOME_ID, companyId: PILOT_COMPANY_ID, updatedAt: t1 }),
    });
    expect(store.rows().filter((r) => r["outcome"] === "processed").length).toBe(1);

    let calls = 0;
    const secondPass = await recoverFailedTaskVerifications({
      verifyTask: async (id) => {
        calls += 1;
        return { id, homeId: PILOT_HOME_ID, companyId: PILOT_COMPANY_ID, updatedAt: t1 };
      },
    });
    expect(calls).toBe(0);
    expect(secondPass.attempted).toBe(0);
    expect(store.rows().filter((r) => r["outcome"] === "processed").length).toBe(1);
  });

  it("keeps a retry that fails again eligible for the next pass without appending a duplicate failure row", async () => {
    await seedTransientFailure();
    const summary = await recoverFailedTaskVerifications({
      verifyTask: async () => {
        throw new BreezewayError(500, "still down");
      },
    });
    expect(summary.stillFailing).toBe(1);
    expect(summary.recovered).toBe(0);
    // Still exactly one row for this event — the retry updated it in place.
    expect(store.rows().length).toBe(1);
    expect(store.rows()[0]?.["retry_count"]).toBe(1);
    expect(store.rows()[0]?.["retryable"]).toBe(true);
  });

  it("stops retrying and flags for manual review once the retry cap is hit", async () => {
    await seedTransientFailure();
    let lastSummary;
    for (let i = 0; i < MAX_RETRY_ATTEMPTS + 2; i += 1) {
      lastSummary = await recoverFailedTaskVerifications({
        verifyTask: async () => {
          throw new BreezewayError(500, "still down");
        },
      });
    }
    const row = store.rows()[0];
    expect(row?.["retry_count"]).toBeLessThanOrEqual(MAX_RETRY_ATTEMPTS);
    expect(row?.["retryable"]).toBe(false);
    expect(lastSummary?.attempted).toBe(0); // no longer eligible, so the last pass touched nothing
    expect(String(row?.["reason"])).toContain("exceeded retry limit");
  });

  it("reclassifies a retry that turns out permanent (e.g. now 404) as not retryable immediately", async () => {
    await seedTransientFailure();
    const summary = await recoverFailedTaskVerifications({ verifyTask: async () => null });
    expect(summary.permanentlyFailed).toBe(1);
    expect(store.rows()[0]?.["retryable"]).toBe(false);
    expect(store.rows()[0]?.["retry_count"]).toBe(1);
  });
});

describe("permanent failures are never retried", () => {
  it("a 401/credentials failure is recorded not-retryable and recovery never picks it up", async () => {
    const result = await processBreezewayWebhook(
      { webhook_type: "task", task_id: TASK_A },
      {
        isFixture: false,
        verifyTask: async () => {
          throw new BreezewayError(401, "unauthorized");
        },
      },
    );
    expect(result.outcome).toBe("verify_failed");
    expect(store.rows()[0]?.["retryable"]).toBe(false);

    let calls = 0;
    const summary = await recoverFailedTaskVerifications({
      verifyTask: async (id) => {
        calls += 1;
        return { id, homeId: PILOT_HOME_ID, companyId: PILOT_COMPANY_ID, updatedAt: t1 };
      },
    });
    expect(calls).toBe(0);
    expect(summary.attempted).toBe(0);
  });

  it("a task genuinely not found (404) is recorded not-retryable", async () => {
    await processBreezewayWebhook(
      { webhook_type: "task", task_id: TASK_A },
      { isFixture: false, verifyTask: async () => null },
    );
    expect(store.rows()[0]?.["retryable"]).toBe(false);
  });
});

describe("rows with no captured task id cannot be retried", () => {
  it("marks a legacy row (task_id null) unrecoverable instead of retrying forever", async () => {
    // Simulates a row recorded before this fix existed.
    store.rows().push({
      id: "legacy-1",
      outcome: "verify_failed",
      reason: "Verification failed (500)",
      task_id: null,
      home_id: null,
      company_id: null,
      task_updated_at: null,
      is_fixture: false,
      retryable: true,
      retry_count: 0,
      recovered_at: null,
      received_at: new Date(0).toISOString(),
    });

    let calls = 0;
    const summary = await recoverFailedTaskVerifications({
      verifyTask: async (id) => {
        calls += 1;
        return { id, homeId: PILOT_HOME_ID, companyId: PILOT_COMPANY_ID, updatedAt: t1 };
      },
    });
    expect(calls).toBe(0);
    expect(summary.unrecoverable).toBe(1);
    const row = store.rows().find((r) => r["id"] === "legacy-1");
    expect(row?.["retryable"]).toBe(false);
  });
});

describe("bounded batch size", () => {
  it("never examines more than RECOVERY_BATCH_SIZE rows in a single call", async () => {
    for (let i = 0; i < RECOVERY_BATCH_SIZE + 4; i += 1) {
      await seedTransientFailure(TASK_A + i);
    }
    let calls = 0;
    const summary = await recoverFailedTaskVerifications({
      verifyTask: async () => {
        calls += 1;
        throw new BreezewayError(500, "still down");
      },
    });
    expect(calls).toBeLessThanOrEqual(RECOVERY_BATCH_SIZE);
    expect(summary.attempted).toBeLessThanOrEqual(RECOVERY_BATCH_SIZE);
  });

  it("rejects an oversized batchSize request rather than expanding the ceiling", async () => {
    for (let i = 0; i < RECOVERY_BATCH_SIZE + 4; i += 1) {
      await seedTransientFailure(TASK_A + i);
    }
    let calls = 0;
    const summary = await recoverFailedTaskVerifications({
      batchSize: 1000,
      verifyTask: async () => {
        calls += 1;
        throw new BreezewayError(500, "still down");
      },
    });
    expect(calls).toBeLessThanOrEqual(RECOVERY_BATCH_SIZE);
    expect(summary.attempted).toBeLessThanOrEqual(RECOVERY_BATCH_SIZE);
  });
});

describe("fixture rows are never touched by recovery", () => {
  it("ignores is_fixture rows even if marked retryable", async () => {
    await processBreezewayWebhook(
      { webhook_type: "task", task_id: TASK_A },
      {
        isFixture: true,
        verifyTask: async () => {
          throw new BreezewayError(500, "down");
        },
      },
    );
    let calls = 0;
    const summary = await recoverFailedTaskVerifications({
      verifyTask: async (id) => {
        calls += 1;
        return { id, homeId: PILOT_HOME_ID, companyId: PILOT_COMPANY_ID, updatedAt: t1 };
      },
    });
    expect(calls).toBe(0);
    expect(summary.attempted).toBe(0);
  });
});
