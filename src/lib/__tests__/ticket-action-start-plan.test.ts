import { describe, expect, it } from "bun:test";
import { ticketActionStartPlan } from "../tickets";

const NOW = "2026-09-12T00:00:00Z";

const untouched = {
  status: "open",
  acknowledged_at: null,
  action_started_at: null,
  current_action_owner: null,
  assignment_source: null,
};

describe("ticketActionStartPlan — the 'Start working' semantics, derived instead of manually clicked", () => {
  it("returns null once action_started_at is already set — never fires twice", () => {
    expect(
      ticketActionStartPlan(
        {
          ...untouched,
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
    const plan = ticketActionStartPlan(untouched, "user-1", NOW);
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
    const plan = ticketActionStartPlan({ ...untouched, status: "resolved" }, "user-1", NOW);
    expect(plan?.patch.status).toBe(undefined);
  });

  it("still logs both Acknowledged and Work started, in order, even when acknowledged_at was already stamped at ticket creation", () => {
    // Ticket creation stamps acknowledged_at unconditionally — that's a data
    // backfill, not a human acknowledging the work. The first real action
    // still logs the discrete Acknowledged event, gated on action_started_at
    // alone, not on acknowledged_at.
    const plan = ticketActionStartPlan(
      { ...untouched, acknowledged_at: "2026-09-01T00:00:00Z" },
      "user-2",
      NOW,
    );
    expect(plan?.patch.acknowledged_at).toBe("2026-09-01T00:00:00Z");
    expect(plan?.events.map((e) => e.eventType)).toEqual(["acknowledged", "action_started"]);
  });

  it("still starts the clock with no actor known — current_action_owner is left untouched, never nulled", () => {
    const plan = ticketActionStartPlan(untouched, null, NOW);
    expect(plan?.patch.current_action_owner).toBe(undefined);
    expect(plan?.patch.assignment_source).toBe(undefined);
  });

  it("claims ownership for the acting user when the ticket was only auto-routed (assignment_source 'automatic')", () => {
    const plan = ticketActionStartPlan(
      { ...untouched, current_action_owner: "mike", assignment_source: "automatic" },
      "emily",
      NOW,
    );
    expect(plan?.patch.current_action_owner).toBe("emily");
    expect(plan?.patch.assignment_source).toBe("manual");
  });

  it("claims ownership for the acting user when nobody owns it and assignment_source is unset", () => {
    const plan = ticketActionStartPlan(
      { ...untouched, current_action_owner: null, assignment_source: null },
      "emily",
      NOW,
    );
    expect(plan?.patch.current_action_owner).toBe("emily");
  });

  it("does not overwrite a valid, intentional existing owner — assignment_source 'manual' is left alone", () => {
    const plan = ticketActionStartPlan(
      { ...untouched, current_action_owner: "mike", assignment_source: "manual" },
      "emily",
      NOW,
    );
    expect(plan?.patch.current_action_owner).toBe(undefined);
    expect(plan?.patch.assignment_source).toBe(undefined);
  });

  it("never writes current_action_owner as null — the ticket can never fall back to Unassigned from this plan", () => {
    for (const owner of [null, "mike"]) {
      for (const source of [null, "automatic", "manual"]) {
        const plan = ticketActionStartPlan(
          { ...untouched, current_action_owner: owner, assignment_source: source },
          "emily",
          NOW,
        );
        expect(plan?.patch.current_action_owner === null).toBe(false);
      }
    }
  });
});
