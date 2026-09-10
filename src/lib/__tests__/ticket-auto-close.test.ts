/**
 * Regression tests for the no-review auto-close rule in
 * `applyStatusChange`: a ticket that doesn't need Final Review closes the
 * moment it's resolved; one that does need review stops at "Resolved" and
 * is never auto-closed. `db` is a plain argument to this module (no dynamic
 * import to mock), so this runs directly against the in-memory store in
 * fakeLifecycleSupabase.ts — no real database.
 */
import { describe, expect, it } from "bun:test";
import { createFakeLifecycleStore } from "./fakeLifecycleSupabase";
import { applyStatusChange } from "@/lib/ticket-lifecycle.server";

function seedResolvableTicket(
  store: ReturnType<typeof createFakeLifecycleStore>,
  overrides: Record<string, unknown> = {},
) {
  store.seed("tickets", {
    id: "t1",
    ref: "T-100",
    status: "in_progress",
    work_type_id: null,
    category: "other",
    breezeway_task_id: null,
    vendor_user_id: null,
    vendor_brief: null,
    waiting_on: null,
    waiting_reason: null,
    next_review_at: null,
    guest_name: null,
    guest_contact: null,
    ownerrez_booking_id: null,
    guest_in_residence: false,
    final_communication_sent: false,
    closure_evidence: null,
    resolution_notes: null,
    closure_qa_result: null,
    priority: "p3",
    guest_impact: "none",
    escalated_at: null,
    escalation_level: null,
    reopen_count: 0,
    owner_notified: false,
    owner_approval_required: false,
    resolved_at: null,
    ...overrides,
  });
}

describe("applyStatusChange — no-review ticket auto-close", () => {
  it("closes a straightforward ticket in the same call that resolves it", async () => {
    const store = createFakeLifecycleStore();
    seedResolvableTicket(store);

    const result = await applyStatusChange(store as never, "user-1", false, {
      ticketId: "t1",
      status: "resolved",
      patch: {
        resolution_notes: "Fixed the leak under the sink.",
        closure_qa_result: "not_reviewed",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.autoClosed).toBe(true);
      expect(result.status).toBe("closed");
    }
    expect(store.all("tickets")[0]!["status"]).toBe("closed");

    const activity = store.all("ticket_activity");
    expect(activity.some((a) => String(a["body"]).includes("Resolved"))).toBe(true);
    expect(
      activity.some(
        (a) => a["event_type"] === "status_changed" && String(a["body"]).includes("automatically"),
      ),
    ).toBe(true);
  });

  it("stops at Resolved, never auto-closing, when Final Review is required", async () => {
    const store = createFakeLifecycleStore();
    // P1 always requires Final Review — see finalReviewRequirement().
    seedResolvableTicket(store, { priority: "p1" });

    const result = await applyStatusChange(store as never, "user-1", false, {
      ticketId: "t1",
      status: "resolved",
      patch: {
        resolution_notes: "Fixed the leak under the sink.",
        closure_qa_result: "not_reviewed",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.autoClosed).toBe(false);
      expect(result.status).toBe("resolved");
    }
    expect(store.all("tickets")[0]!["status"]).toBe("resolved");
    expect(
      store.all("ticket_activity").some((a) => String(a["body"]).includes("automatically")),
    ).toBe(false);
  });

  it("never closes a ticket that isn't resolvable yet (missing closure summary)", async () => {
    const store = createFakeLifecycleStore();
    seedResolvableTicket(store);

    const result = await applyStatusChange(store as never, "user-1", false, {
      ticketId: "t1",
      status: "resolved",
      patch: {},
    });

    expect(result.ok).toBe(false);
    expect(store.all("tickets")[0]!["status"]).toBe("in_progress");
  });
});
