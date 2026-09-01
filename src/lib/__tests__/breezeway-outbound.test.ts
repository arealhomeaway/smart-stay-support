/**
 * Regression tests for Breezeway outbound task creation.
 *
 * Everything runs against the in-memory store in fakeOutboundSupabase.ts and a
 * stubbed `breezewayRequest` — no real Breezeway call is ever made, so running
 * these can never create a task in Breezeway.
 *
 * The properties under test are the duplicate-safety ones:
 *   - a repeated request key reports the FIRST attempt's real state
 *   - an uncertain outcome (timeout / 5xx) is never reported as failure and
 *     never retried automatically
 *   - an uncertain record holds the lock so nothing can be sent again
 *   - a 4xx refusal is definite and closes the record cleanly
 *   - admin reconciliation binds only a verified pilot task id
 */
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeOutboundStore } from "./fakeOutboundSupabase";

const store = createFakeOutboundStore();
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: store.supabaseAdmin,
}));

class FakeBreezewayError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Call = { path: string; method: string };
const calls: Call[] = [];
let responder: (path: string, options: { method?: string }) => unknown = () => ({ id: 900001 });

mock.module("@/lib/breezeway.server", () => ({
  BreezewayError: FakeBreezewayError,
  listBreezewayProperties: async () => [],
  breezewayRequest: async (path: string, options: { method?: string } = {}) => {
    calls.push({ path, method: options.method ?? "GET" });
    return responder(path, options);
  },
}));

const { createOutboundTask, listOutboundNeedingReview, reconcileOutboundTask } = await import(
  "@/lib/breezeway-outbound.server"
);

const TICKET = "11111111-1111-4111-8111-111111111111";
const ONBOARDING_TASK = "33333333-3333-4333-8333-333333333333";

function input(requestKey: string) {
  return {
    sourceType: "ticket" as const,
    sourceId: TICKET,
    requestKey,
    title: "Fix the tap",
    description: null,
    department: "maintenance",
    priority: "normal",
    scheduledDate: null,
    scheduledTime: null,
  };
}

beforeEach(() => {
  store.reset();
  calls.length = 0;
  responder = () => ({ id: 900001 });
  store.setFlag(true);
  store.seedPilotTicket(TICKET);
  store.seedPilotOnboardingTask(ONBOARDING_TASK);
});

/**
 * Both supported source types must behave identically. The ticket path is
 * covered throughout; these exercise the onboarding-task path directly.
 */
describe("onboarding task source", () => {
  function taskInput(requestKey: string) {
    return {
      ...input(requestKey),
      sourceType: "onboarding_task" as const,
      sourceId: ONBOARDING_TASK,
      title: "Install lockbox",
      department: "maintenance",
    };
  }

  it("creates one Breezeway task and records it against the onboarding task", async () => {
    const result = await createOutboundTask(taskInput("key-onb-happy-000000"), "actor");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link.sourceType).toBe("onboarding_task");
      expect(result.link.onboardingTaskId).toBe(ONBOARDING_TASK);
      expect(result.link.ticketId).toBeNull();
      expect(result.link.breezewayTaskId).toBe(900001);
    }
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });

  it("refuses when the flag is off", async () => {
    store.setFlag(false);
    const result = await createOutboundTask(taskInput("key-onb-off-00000000"), "actor");
    expect(result.ok).toBe(false);
    expect(calls.length).toBe(0);
  });

  it("refuses demo and archived onboarding tasks", async () => {
    store.state.onboarding[0]!["is_demo"] = true;
    expect((await createOutboundTask(taskInput("key-onb-demo-0000000"), "actor")).ok).toBe(false);
    store.state.onboarding[0]!["is_demo"] = false;
    store.state.onboarding[0]!["archived_at"] = "2026-01-01T00:00:00Z";
    expect((await createOutboundTask(taskInput("key-onb-arch-0000000"), "actor")).ok).toBe(false);
    expect(calls.length).toBe(0);
  });

  it("refuses an onboarding task on a non-pilot property", async () => {
    store.state.properties[0]!["breezeway_property_id"] = "999999";
    const result = await createOutboundTask(taskInput("key-onb-notpilot-000"), "actor");
    expect(result.ok).toBe(false);
    expect(calls.length).toBe(0);
  });

  it("a repeated request key never sends a second task", async () => {
    const key = "key-onb-repeat-00000";
    await createOutboundTask(taskInput(key), "actor");
    const second = await createOutboundTask(taskInput(key), "actor");
    expect(second.ok).toBe(true);
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
    expect(store.outbound().length).toBe(1);
  });

  it("an uncertain outcome is needs_review and locks further sends for the task", async () => {
    responder = () => {
      throw new FakeBreezewayError(500, "server error");
    };
    await createOutboundTask(taskInput("key-onb-5xx-00000000"), "actor");
    expect(store.outbound()[0]!["status"]).toBe("needs_review");
    responder = () => ({ id: 900002 });
    const second = await createOutboundTask(taskInput("key-onb-blocked-0000"), "actor");
    expect(second.ok).toBe(false);
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });

  it("an unresolved onboarding-task record does not block the ticket on the same property", async () => {
    responder = () => {
      throw new FakeBreezewayError(500, "server error");
    };
    await createOutboundTask(taskInput("key-onb-stuck-000000"), "actor");
    responder = () => ({ id: 900003 });
    const ticket = await createOutboundTask(input("key-tkt-after-onb-00"), "actor");
    expect(ticket.ok).toBe(true);
    expect(store.outbound().length).toBe(2);
  });
});

describe("stale request keys after a terminal outcome", () => {
  it("a definite refusal is marked retryable so a new send needs no page refresh", async () => {
    responder = () => {
      throw new FakeBreezewayError(422, "Breezeway rejected the request (422).");
    };
    const key = "key-terminal-4xx-000";
    await createOutboundTask(input(key), "actor");
    const repeat = await createOutboundTask(input(key), "actor");
    expect(repeat.ok).toBe(false);
    if (!repeat.ok) expect(repeat.retryable).toBe(true);

    // A fresh key on the same record still goes through — nothing is locked.
    responder = () => ({ id: 900010 });
    const fresh = await createOutboundTask(input("key-terminal-fresh-0"), "actor");
    expect(fresh.ok).toBe(true);
  });

  it("an uncertain outcome is NOT retryable — it stays locked for admin review", async () => {
    responder = () => {
      throw new FakeBreezewayError(503, "server error");
    };
    const key = "key-uncertain-lock-0";
    await createOutboundTask(input(key), "actor");
    const repeat = await createOutboundTask(input(key), "actor");
    expect(repeat.ok).toBe(false);
    if (!repeat.ok) expect(repeat.retryable ?? false).toBe(false);
  });
});

describe("feature flag and pilot lock", () => {
  it("refuses when the flag is off and never calls Breezeway", async () => {
    store.setFlag(false);
    const result = await createOutboundTask(input("key-off-000000000000"), "actor");
    expect(result.ok).toBe(false);
    expect(calls.length).toBe(0);
    expect(store.outbound().length).toBe(0);
  });

  it("refuses a property that is not the pilot home", async () => {
    store.state.properties[0]!["breezeway_property_id"] = "999999";
    const result = await createOutboundTask(input("key-notpilot-00000000"), "actor");
    expect(result.ok).toBe(false);
    expect(calls.length).toBe(0);
  });

  it("returns a sanitized refusal (not a thrown error) for a missing record", async () => {
    const missing = { ...input("key-missing-000000000"), sourceId: "22222222-2222-4222-8222-222222222222" };
    const result = await createOutboundTask(missing, "actor");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("does not exist");
    expect(calls.length).toBe(0);
  });

  it("refuses demo and archived records", async () => {
    store.state.tickets[0]!["is_demo"] = true;
    const demo = await createOutboundTask(input("key-demo-0000000000000"), "actor");
    expect(demo.ok).toBe(false);
    store.state.tickets[0]!["is_demo"] = false;
    store.state.tickets[0]!["archived_at"] = "2026-01-01T00:00:00Z";
    const archived = await createOutboundTask(input("key-arch-0000000000000"), "actor");
    expect(archived.ok).toBe(false);
    expect(calls.length).toBe(0);
  });
});

describe("happy path", () => {
  it("creates exactly one Breezeway task and records the id", async () => {
    const result = await createOutboundTask(input("key-happy-00000000000"), "actor");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link.status).toBe("created");
      expect(result.link.breezewayTaskId).toBe(900001);
    }
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });
});

describe("idempotency", () => {
  it("a repeated request key returns the first result without a second POST", async () => {
    const key = "key-repeat-0000000000";
    const first = await createOutboundTask(input(key), "actor");
    const second = await createOutboundTask(input(key), "actor");
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
    expect(store.outbound().length).toBe(1);
  });

  it("a repeated key after a FAILED attempt reports the failure, not success", async () => {
    responder = () => {
      throw new FakeBreezewayError(400, "Breezeway rejected the request (400).");
    };
    const key = "key-failrepeat-000000";
    const first = await createOutboundTask(input(key), "actor");
    expect(first.ok).toBe(false);

    const second = await createOutboundTask(input(key), "actor");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.message).toContain("400");
    // No second POST — the fast path never re-sends.
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });

  it("a repeated key after an UNCERTAIN attempt reports uncertainty, not success", async () => {
    responder = () => {
      throw new FakeBreezewayError(500, "Breezeway is returning a server error.");
    };
    const key = "key-uncertain-0000000";
    await createOutboundTask(input(key), "actor");
    const again = await createOutboundTask(input(key), "actor");
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.message).toContain("unresolved");
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });
});

describe("uncertain outcomes", () => {
  it("a 5xx marks the record needs_review, never error, and is not retried", async () => {
    responder = () => {
      throw new FakeBreezewayError(503, "Breezeway is returning a server error.");
    };
    const result = await createOutboundTask(input("key-5xx-00000000000000"), "actor");
    expect(result.ok).toBe(false);
    expect(store.outbound()[0]!["status"]).toBe("needs_review");
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });

  it("a network error is uncertain too", async () => {
    responder = () => {
      throw new Error("socket hang up");
    };
    await createOutboundTask(input("key-net-00000000000000"), "actor");
    expect(store.outbound()[0]!["status"]).toBe("needs_review");
  });

  it("a 4xx is a definite refusal recorded as error", async () => {
    responder = () => {
      throw new FakeBreezewayError(422, "Breezeway rejected the request (422).");
    };
    await createOutboundTask(input("key-422-00000000000000"), "actor");
    expect(store.outbound()[0]!["status"]).toBe("error");
  });

  it("a created task whose bookkeeping fails becomes needs_review, not a retry", async () => {
    store.failNextUpdate(1);
    const result = await createOutboundTask(input("key-bookkeep-00000000"), "actor");
    expect(result.ok).toBe(false);
    expect(store.outbound()[0]!["status"]).toBe("needs_review");
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });

  it("an unresolved record blocks a NEW request key for the same ticket", async () => {
    responder = () => {
      throw new FakeBreezewayError(500, "server error");
    };
    await createOutboundTask(input("key-block-a-000000000"), "actor");
    responder = () => ({ id: 900002 });
    const second = await createOutboundTask(input("key-block-b-000000000"), "actor");
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.message).toContain("still open");
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
    expect(store.outbound().length).toBe(1);
  });
});

describe("admin reconciliation", () => {
  async function stuck() {
    responder = () => {
      throw new FakeBreezewayError(500, "server error");
    };
    await createOutboundTask(input("key-recover-000000000"), "actor");
    const queue = await listOutboundNeedingReview();
    expect(queue.length).toBe(1);
    return queue[0]!.id;
  }

  it("lists uncertain records for review", async () => {
    const id = await stuck();
    expect(id).toBeTruthy();
  });

  it("binds a task id only after verifying it belongs to the pilot property", async () => {
    const id = await stuck();
    responder = () => ({ id: 777001, home_id: 1473933 });
    const result = await reconcileOutboundTask(
      { id, action: "link", breezewayTaskId: 777001, note: "Found in Breezeway" },
      "admin",
    );
    expect(result.ok).toBe(true);
    expect(store.outbound()[0]!["status"]).toBe("created");
    expect(store.outbound()[0]!["breezeway_task_id"]).toBe(777001);
    // The verification read is a GET; no further POST was ever made.
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });

  it("refuses a task id from another property", async () => {
    const id = await stuck();
    responder = () => ({ id: 777002, home_id: 999999 });
    const result = await reconcileOutboundTask(
      { id, action: "link", breezewayTaskId: 777002, note: "" },
      "admin",
    );
    expect(result.ok).toBe(false);
    expect(store.outbound()[0]!["status"]).toBe("needs_review");
  });

  it("closing a record as never-created releases the lock so work can be sent again", async () => {
    const id = await stuck();
    const closed = await reconcileOutboundTask(
      { id, action: "abandon", note: "Nothing in Breezeway" },
      "admin",
    );
    expect(closed.ok).toBe(true);
    expect(store.outbound()[0]!["status"]).toBe("abandoned");

    responder = () => ({ id: 900003 });
    const resent = await createOutboundTask(input("key-after-close-00000"), "actor");
    expect(resent.ok).toBe(true);
    expect(store.outbound().length).toBe(2);
  });

  it("will not reconcile an already resolved record", async () => {
    const id = await stuck();
    await reconcileOutboundTask({ id, action: "abandon", note: "" }, "admin");
    const again = await reconcileOutboundTask({ id, action: "abandon", note: "" }, "admin");
    expect(again.ok).toBe(false);
  });
});

/**
 * Write scope is the persisted mapping state, not a hardcoded list. These
 * guard both directions: a verified property is accepted whatever its home id,
 * and any non-verified state is refused before any POST.
 */
describe("verified-mapping write gate", () => {
  it("accepts any home whose property mapping is verified", async () => {
    for (const [i, homeId] of ["1473933", "1295301", "676169", "2222222"].entries()) {
      store.reset();
      calls.length = 0;
      store.setFlag(true);
      store.seedPilotTicket(TICKET);
      store.state.properties[0]!["breezeway_property_id"] = homeId;
      store.state.properties[0]!["breezeway_mapping_state"] = "verified";
      const result = await createOutboundTask(input(`key-allow-${i}-00000000`), "actor");
      expect(result.ok).toBe(true);
      expect(calls.filter((c) => c.method === "POST").length).toBe(1);
    }
  });

  it("refuses every non-verified mapping state before any POST", async () => {
    for (const [i, state] of ["unmapped", "ambiguous", "inactive", "excluded"].entries()) {
      store.reset();
      calls.length = 0;
      store.setFlag(true);
      store.seedPilotTicket(TICKET);
      store.state.properties[0]!["breezeway_mapping_state"] = state;
      const result = await createOutboundTask(input(`key-deny-${i}-000000000`), "actor");
      expect(result.ok).toBe(false);
      expect(calls.length).toBe(0);
    }
  });

  it("refuses a verified property with no Breezeway home id", async () => {
    store.reset();
    calls.length = 0;
    store.setFlag(true);
    store.seedPilotTicket(TICKET);
    store.state.properties[0]!["breezeway_property_id"] = null;
    const result = await createOutboundTask(input("key-nohome-0000000"), "actor");
    expect(result.ok).toBe(false);
    expect(calls.length).toBe(0);
  });
});
