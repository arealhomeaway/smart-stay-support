import { describe, expect, it } from "bun:test";
import {
  authorizationState, canAttemptHandoff, handoffRequestKey, handoffStatusFromResult, runHandoffAttempt, vendorChannels,
  type HandoffStatus,
} from "../vendor-sourcing";
import { estimateTotal, financeQueue, reviewBlockedBy, totalsByPeriod } from "../expenses";

/** Simulated Work Order store + Breezeway, to prove retry behavior without a real task. */
function sim(createImpl: (key: string, calls: string[]) => Promise<{ ok: boolean; link?: { breezewayTaskId?: number | null } | null; retryable?: boolean; message?: string }>) {
  const wo = { status: "not_sent" as HandoffStatus, key: null as string | null, ref: null as string | null };
  const calls: string[] = [];
  const attempt = () =>
    runHandoffAttempt({
      workOrderId: "wo1", status: wo.status, priorKey: wo.key,
      save: async (p) => { wo.status = p.breezeway_handoff_status; if (p.breezeway_request_key) wo.key = p.breezeway_request_key; if (p.breezeway_task_ref) wo.ref = p.breezeway_task_ref; },
      create: (k) => { calls.push(k); return createImpl(k, calls); },
    });
  return { wo, calls, attempt };
}

describe("Breezeway retry behavior (simulated)", () => {
  it("task created in Breezeway but the response times out → uncertain, second create is refused", async () => {
    const breezewayTasks: string[] = [];
    const s = sim(async (k) => { breezewayTasks.push(k); throw new Error("timeout"); });
    const first = await s.attempt();
    expect(first.status).toBe("uncertain");
    expect(s.wo.ref).toBeNull(); // no task id was saved
    const second = await s.attempt();
    expect(second.created).toBe(false);
    expect(s.calls).toHaveLength(1);
    expect(breezewayTasks).toHaveLength(1); // no duplicate task
  });
  it("the uncertain intent is saved before the external call (a crash mid-call stays uncertain)", async () => {
    const seen: { status: HandoffStatus | null } = { status: null };
    const s = sim(async () => { seen.status = s.wo.status; return { ok: true, link: { breezewayTaskId: 77 } }; });
    const r = await s.attempt();
    expect(seen.status).toBe("uncertain");
    expect(r.status).toBe("sent");
    expect(s.wo.ref).toBe("77");
  });
  it("created-but-id-not-recorded (link, not retryable) stays uncertain", () => {
    expect(handoffStatusFromResult({ ok: false, link: {}, retryable: false })).toBe("uncertain");
  });
  it("definite refusal → failed, and a retry uses a fresh request key", async () => {
    const s = sim(async () => ({ ok: false, link: {}, retryable: true, message: "400 bad home" }));
    expect((await s.attempt()).status).toBe("failed");
    expect(canAttemptHandoff(s.wo.status)).toBe(true);
    await s.attempt();
    expect(s.calls).toEqual(["work_order:wo1", "work_order:wo1:attempt-2"]);
  });
  it("nothing recorded (refused before any write) → failed", () => {
    expect(handoffStatusFromResult({ ok: false })).toBe("failed");
  });
  it("request keys only advance after a definite failure", () => {
    expect(handoffRequestKey("a", null, "not_sent")).toBe("work_order:a");
    expect(handoffRequestKey("a", "work_order:a", "uncertain")).toBe("work_order:a");
    expect(handoffRequestKey("a", "work_order:a:attempt-2", "failed")).toBe("work_order:a:attempt-3");
  });
});

describe("replacement vendor authorization", () => {
  it("approval for a different vendor is reported as not covering the replacement", () => {
    const a = authorizationState({ quote_amount: 500, approval_status: "approved", authorization_stale: true, authorized_vendor_org_id: "v1", vendor_org_id: "v2" } as never);
    expect(a.satisfied).toBe(false);
    expect(a.label).toContain("different vendor");
  });
});

describe("vendor channel flags", () => {
  it("Telegram is unknown until confirmed — never inferred from a default", () => {
    expect(vendorChannels({ dispatch_method: null }).telegramStatus).toBe("unknown");
    expect(vendorChannels({ telegram_status: "no" }).telegram).toBe(false);
    expect(vendorChannels({ telegram_status: "yes" }).telegram).toBe(true);
  });
});

describe("estimates and duplicates", () => {
  const rows = [
    { amount: 400, proposed_statement_period: "2026-10-01", is_estimate: true },
    { amount: 380, proposed_statement_period: "2026-10-01", is_estimate: false },
  ];
  it("estimates are excluded from invoiced totals and shown apart", () => {
    expect(totalsByPeriod(rows)).toEqual([{ period: "2026-10", total: 380 }]);
    expect(estimateTotal(rows)).toBe(400);
  });
  it("estimates never reach the review queue; duplicates block final review", () => {
    expect(financeQueue({ links: 1, reservation_link_state: "not_relevant", finance_review: "not_started", ops_completion: "done", ready: true, is_estimate: true })).toBe("in_progress");
    expect(reviewBlockedBy({ is_estimate: true })).toContain("estimate");
    expect(reviewBlockedBy({ duplicate_flag: "suspected" })).toContain("duplicate");
    expect(reviewBlockedBy({ duplicate_flag: "cleared" })).toBeNull();
  });
});
