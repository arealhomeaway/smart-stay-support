import { describe, expect, it } from "bun:test";
import { ticketActionStartPlan } from "../tickets";

const NOW = "2026-09-12T00:00:00Z";

describe("ticketActionStartPlan — the 'Start working' semantics, derived instead of manually clicked", () => {
  it("returns null once action_started_at is already set — never fires twice", () => {
    expect(
      ticketActionStartPlan(
        {
          status: "in_progress",
          acknowledged_at: "2026-09-01T00:00:00Z",
          action_started_at: "2026-09-01T00:05:00Z",
        },
        "user-1",
        NOW,
      ),
    ).toBeNull();
  });

  it("on a brand new, untouched ticket: backfills acknowledged_at, bumps status from open, and assigns ownership", () => {
    const plan = ticketActionStartPlan(
      { status: "open", acknowledged_at: null, action_started_at: null },
      "user-1",
      NOW,
    );
    expect(plan).not.toBeNull();
    expect(plan?.patch).toEqual({
      acknowledged_at: NOW,
      action_started_at: NOW,
      status: "in_progress",
      current_action_owner: "user-1",
      assignment_source: "manual",
      assignment_note: null,
    });
    expect(plan?.events.map((e) => e.eventType)).toEqual(["acknowledged", "action_started"]);
  });

  it("only bumps status when it is currently 'open' — a ticket already resolved/waiting/etc. keeps its status", () => {
    const plan = ticketActionStartPlan(
      { status: "resolved", acknowledged_at: null, action_started_at: null },
      "user-1",
      NOW,
    );
    expect(plan?.patch.status).toBe(undefined);
  });

  it("does not re-assign ownership or re-log 'acknowledged' once acknowledged_at is already set (not first touch)", () => {
    const plan = ticketActionStartPlan(
      { status: "open", acknowledged_at: "2026-09-01T00:00:00Z", action_started_at: null },
      "user-2",
      NOW,
    );
    expect(plan?.patch).toEqual({
      acknowledged_at: "2026-09-01T00:00:00Z",
      action_started_at: NOW,
      status: "in_progress",
    });
    expect(plan?.events.map((e) => e.eventType)).toEqual(["action_started"]);
  });

  it("still starts the clock with no actor known — current_action_owner just goes null, not skipped", () => {
    const plan = ticketActionStartPlan(
      { status: "open", acknowledged_at: null, action_started_at: null },
      null,
      NOW,
    );
    expect(plan?.patch.current_action_owner).toBeNull();
  });
});
