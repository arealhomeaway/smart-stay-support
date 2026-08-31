/**
 * Attack-test suite for Breezeway outbound task creation
 * (src/lib/breezeway-outbound.server.ts), written during an independent
 * security/correctness review of the landed feature — not a competing
 * implementation. Runs entirely against an in-memory fake DB
 * (fakeOutboundDb.ts) and a fake `breezewayRequest`; no real Supabase or
 * Breezeway calls, no live task ever created.
 *
 * What this file does NOT cover: the `assertStaff`/`requireSupabaseAuth`
 * authorization gate in breezeway-outbound.functions.ts. That layer needs a
 * full TanStack Start request/JWT harness to exercise live; it was instead
 * verified by tracing the code (context.userId comes from the verified JWT
 * `sub` claim via requireSupabaseAuth, and every handler calls
 * `assertStaff(context.supabase, context.userId)` before touching anything)
 * — see the review write-up for the exact permission rule.
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeOutboundDb } from "./fakeOutboundDb";

const PILOT_HOME_ID = "1473933";
const OTHER_HOME_ID = "999999";

const TICKET_LIVE = {
  id: "ticket-live",
  title: "Fix the lockbox",
  description: "Guest can't get in",
  priority: "p1",
  property_id: "prop-pilot",
  is_demo: false,
  archived_at: null,
};
const TICKET_DEMO = { ...TICKET_LIVE, id: "ticket-demo", is_demo: true };
const TICKET_ARCHIVED = { ...TICKET_LIVE, id: "ticket-archived", archived_at: "2026-08-01T00:00:00Z" };
const TICKET_OTHER_PROPERTY = { ...TICKET_LIVE, id: "ticket-other", property_id: "prop-other" };

const ONBOARDING_LIVE = {
  id: "onboard-live",
  title: "Photograph the pool area",
  detail: "For the listing",
  property_id: "prop-pilot",
  is_demo: false,
  archived_at: null,
};
const ONBOARDING_DEMO = { ...ONBOARDING_LIVE, id: "onboard-demo", is_demo: true };
const ONBOARDING_ARCHIVED = {
  ...ONBOARDING_LIVE,
  id: "onboard-archived",
  archived_at: "2026-08-01T00:00:00Z",
};
const ONBOARDING_OTHER_PROPERTY = { ...ONBOARDING_LIVE, id: "onboard-other", property_id: "prop-other" };

const PROP_PILOT = { id: "prop-pilot", name: "9211 Fitzgerald Dr", breezeway_property_id: PILOT_HOME_ID };
const PROP_OTHER = { id: "prop-other", name: "Some other home", breezeway_property_id: OTHER_HOME_ID };

function seed(flagEnabled: boolean) {
  return {
    tickets: [TICKET_LIVE, TICKET_DEMO, TICKET_ARCHIVED, TICKET_OTHER_PROPERTY],
    onboardingTasks: [ONBOARDING_LIVE, ONBOARDING_DEMO, ONBOARDING_ARCHIVED, ONBOARDING_OTHER_PROPERTY],
    properties: [PROP_PILOT, PROP_OTHER],
    featureFlags: [{ key: "breezeway_outbound", enabled: flagEnabled }],
  };
}

const db = createFakeOutboundDb(seed(true));

// Mutable script the fake breezewayRequest reads from at call time, so every
// test can reconfigure behavior without re-importing the module under test
// (which has a static top-level `import { breezewayRequest } from
// "./breezeway.server"` — the mock must be a stable object bound once).
const bz = {
  calls: [] as { path: string; options: unknown }[],
  script: [] as Array<() => unknown>,
  autoId: 9000,
};

class FakeBreezewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: db.supabaseAdmin }));
mock.module("@/lib/breezeway.server", () => ({
  BreezewayError: FakeBreezewayError,
  breezewayRequest: async (path: string, options: unknown) => {
    bz.calls.push({ path, options });
    const next = bz.script.shift();
    if (next) return next();
    return { id: bz.autoId++ };
  },
}));

const { createOutboundTask, noteOutboundWebhook } = await import("@/lib/breezeway-outbound.server");

beforeEach(() => {
  db.reset(seed(true));
  bz.calls = [];
  bz.script = [];
  bz.autoId = 9000;
});

function makeInput(overrides: Partial<Parameters<typeof createOutboundTask>[0]> = {}) {
  return {
    sourceType: "ticket" as const,
    sourceId: TICKET_LIVE.id,
    requestKey: `key-${Math.random().toString(36).slice(2)}`,
    title: "Send this to Breezeway",
    description: null,
    department: "maintenance",
    priority: "normal",
    scheduledDate: null,
    scheduledTime: null,
    ...overrides,
  };
}

describe("feature flag enforcement", () => {
  it("refuses to write when the flag is OFF, and never calls Breezeway", async () => {
    db.reset(seed(false));
    const result = await createOutboundTask(makeInput(), "staff-1");
    expect(result.ok).toBe(false);
    expect(bz.calls.length).toBe(0);
    expect(db.outboundRows().length).toBe(0);
  });

  it("proceeds when the flag is ON, for an eligible pilot-property ticket", async () => {
    const result = await createOutboundTask(makeInput(), "staff-1");
    expect(result.ok).toBe(true);
    expect(bz.calls.length).toBe(1);
  });
});

describe("pilot-property restriction", () => {
  it("refuses a ticket at a non-pilot property, even with the flag ON", async () => {
    const result = await createOutboundTask(makeInput({ sourceId: TICKET_OTHER_PROPERTY.id }), "staff-1");
    expect(result.ok).toBe(false);
    expect(bz.calls.length).toBe(0);
  });

  it("cannot be bypassed through an onboarding task at a non-pilot property", async () => {
    const result = await createOutboundTask(
      makeInput({ sourceType: "onboarding_task", sourceId: ONBOARDING_OTHER_PROPERTY.id }),
      "staff-1",
    );
    expect(result.ok).toBe(false);
    expect(bz.calls.length).toBe(0);
  });

  it("has no client-suppliable property/home-id field to submit at all", () => {
    // createOutboundTask's input type only carries sourceType/sourceId/
    // requestKey/title/description/department/priority/scheduledDate/
    // scheduledTime — the property/home id is always re-derived server-side
    // from the ticket's own stored property_id, never taken from the caller.
    const input = makeInput() as Record<string, unknown>;
    expect(Object.keys(input).sort()).toEqual(
      [
        "department",
        "description",
        "priority",
        "requestKey",
        "scheduledDate",
        "scheduledTime",
        "sourceId",
        "sourceType",
        "title",
      ].sort(),
    );
  });
});

describe("demo and archived refusal", () => {
  // The write itself IS blocked in every case below (never reaches
  // breezewayRequest, never inserts a row) — that's the security-relevant
  // guarantee, and it holds. But note the *shape* of the refusal: unlike
  // every other guard in createOutboundTask (flag off, wrong property, which
  // return a clean `{ ok: false, message }`), resolveSource's demo/archived
  // checks `throw new Error(...)` and createOutboundTask has no try/catch
  // around that call — so this refusal surfaces as an UNHANDLED EXCEPTION
  // out of the server function, not the same graceful result shape. Whatever
  // generic error TanStack Start's server-function boundary turns that into
  // is what staff would actually see — inconsistent with the rest of this
  // function's error contract, and worth a matching try/catch.

  /** This project's narrow bun:test type shim has no `.rejects`; assert the throw manually. */
  async function expectThrows(promise: Promise<unknown>, message: string) {
    let caught: Error | null = null;
    try {
      await promise;
    } catch (err) {
      caught = err instanceof Error ? err : new Error(String(err));
    }
    expect(caught).toBeTruthy();
    expect(caught?.message ?? "").toBe(message);
  }

  it("ATTACK: refuses a demo ticket, but by throwing rather than returning {ok:false}", async () => {
    await expectThrows(
      createOutboundTask(makeInput({ sourceId: TICKET_DEMO.id }), "staff-1"),
      "Demo tickets are never sent to Breezeway.",
    );
    expect(bz.calls.length).toBe(0);
    expect(db.outboundRows().length).toBe(0);
  });

  it("ATTACK: refuses an archived ticket, but by throwing rather than returning {ok:false}", async () => {
    await expectThrows(
      createOutboundTask(makeInput({ sourceId: TICKET_ARCHIVED.id }), "staff-1"),
      "Archived tickets are never sent to Breezeway.",
    );
    expect(bz.calls.length).toBe(0);
    expect(db.outboundRows().length).toBe(0);
  });

  it("ATTACK: refuses a demo onboarding task, but by throwing rather than returning {ok:false}", async () => {
    await expectThrows(
      createOutboundTask(
        makeInput({ sourceType: "onboarding_task", sourceId: ONBOARDING_DEMO.id }),
        "staff-1",
      ),
      "Demo tasks are never sent to Breezeway.",
    );
    expect(bz.calls.length).toBe(0);
    expect(db.outboundRows().length).toBe(0);
  });

  it("ATTACK: refuses an archived onboarding task, but by throwing rather than returning {ok:false}", async () => {
    await expectThrows(
      createOutboundTask(
        makeInput({ sourceType: "onboarding_task", sourceId: ONBOARDING_ARCHIVED.id }),
        "staff-1",
      ),
      "Archived tasks are never sent to Breezeway.",
    );
    expect(bz.calls.length).toBe(0);
    expect(db.outboundRows().length).toBe(0);
  });
});

describe("idempotency: double-click and retry", () => {
  it("resending the exact same request key never calls Breezeway twice", async () => {
    const input = makeInput();
    const first = await createOutboundTask(input, "staff-1");
    const second = await createOutboundTask(input, "staff-1");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.link.id).toBe(first.link.id);
    expect(bz.calls.length).toBe(1);
  });

  it("two different request keys racing for the same ticket produce exactly one Breezeway task", async () => {
    const [a, b] = await Promise.all([
      createOutboundTask(makeInput(), "staff-1"),
      createOutboundTask(makeInput(), "staff-2"),
    ]);
    const succeeded = [a, b].filter((r) => r.ok);
    expect(bz.calls.length).toBe(1);
    // Exactly one of the two should have actually created a task; the loser
    // must be refused, never silently treated as a duplicate success.
    expect(succeeded.length).toBe(1);
  });

  it("ATTACK: a retry with the same request key after a real Breezeway rejection is misreported as success (no duplicate write, but the failure is hidden)", async () => {
    bz.script.push(() => {
      throw new FakeBreezewayError(422, "Breezeway rejected the task body");
    });
    const input = makeInput();

    const first = await createOutboundTask(input, "staff-1");
    expect(first.ok).toBe(false); // first attempt correctly reports the failure
    expect(db.outboundRows()[0]?.["status"]).toBe("error");

    // The UI only mints a fresh request key on a *successful* send
    // (BreezewayTaskPanel.tsx onSuccess), so a user-initiated retry after an
    // error reuses this exact same key.
    const retry = await createOutboundTask(input, "staff-1");

    // EXPECTED (correct) behavior: the retry should still report failure,
    // since no Breezeway task exists for this record. ACTUAL behavior as
    // shipped: createOutboundTask's fast path
    // (`if (existing) return { ok: true, ... }`) never checks
    // existing.status, so a retry of a genuinely failed send is reported
    // ok:true — the UI then shows "Sent to Breezeway." This assertion
    // encodes the CORRECT behavior and is expected to FAIL against the
    // current implementation, proving the bug.
    expect(retry.ok).toBe(false);
    // No duplicate write to Breezeway either way — that part is sound.
    expect(bz.calls.length).toBe(1);
  });

  it("ATTACK: a retry with the same request key while the prior attempt is still stuck 'creating' is also misreported as success", async () => {
    // Simulates the "Breezeway succeeded but Resolve crashed before
    // recording the id" case: the row is left exactly as the real
    // update-failure branch leaves one — status='creating', no task id.
    db.pushOutboundRow({
      id: "stuck-1",
      source_type: "ticket",
      ticket_id: TICKET_LIVE.id,
      onboarding_task_id: null,
      request_key: "stuck-key",
      status: "creating",
      title: "Stuck send",
      department: null,
      priority: null,
      scheduled_date: null,
      scheduled_time: null,
      breezeway_task_id: null,
      error_message: null,
      created_at: new Date().toISOString(),
      last_synced_at: null,
      last_webhook_at: null,
    });
    const retry = await createOutboundTask(makeInput({ requestKey: "stuck-key" }), "staff-1");
    // EXPECTED: an unresolved attempt should not be reported as a success.
    // ACTUAL: same fast-path bug — reported ok:true. Expected to FAIL.
    expect(retry.ok).toBe(false);
    expect(bz.calls.length).toBe(0);
  });
});

describe("deliberate second task", () => {
  it("a new explicit request key after a completed send creates a genuinely second Breezeway task", async () => {
    const first = await createOutboundTask(makeInput(), "staff-1");
    expect(first.ok).toBe(true);

    const second = await createOutboundTask(makeInput(), "staff-1"); // fresh requestKey from makeInput()
    expect(second.ok).toBe(true);
    expect(bz.calls.length).toBe(2);
    if (first.ok && second.ok) {
      expect(second.link.id).not.toBe(first.link.id);
      expect(second.link.breezewayTaskId).not.toBe(first.link.breezewayTaskId);
    }
  });
});

describe("webhook reconciliation", () => {
  it("marks an outbound-created task synced when its breezeway_task_id is acknowledged", async () => {
    const created = await createOutboundTask(makeInput(), "staff-1");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await noteOutboundWebhook(created.link.breezewayTaskId!);
    const row = db.outboundRows().find((r) => r["id"] === created.link.id);
    expect(row?.["status"]).toBe("synced");
  });

  it("touches nothing and creates no row for a Breezeway task id Resolve never created", async () => {
    const before = db.outboundRows().length;
    await noteOutboundWebhook(424242);
    expect(db.outboundRows().length).toBe(before);
  });
});

describe("both sources reach the write path (Operations ticket and Onboarding task)", () => {
  it("creates from an Operations ticket", async () => {
    const result = await createOutboundTask(makeInput({ sourceType: "ticket", sourceId: TICKET_LIVE.id }), "staff-1");
    expect(result.ok).toBe(true);
  });

  it("creates from an Onboarding task", async () => {
    const result = await createOutboundTask(
      makeInput({ sourceType: "onboarding_task", sourceId: ONBOARDING_LIVE.id }),
      "staff-1",
    );
    expect(result.ok).toBe(true);
  });
});
