import { describe, expect, it } from "bun:test";
import { ticketAssigneeName } from "../tickets";

/**
 * Root cause of QA #567's "ownership shows Unassigned right after the
 * first action, only becomes the acting user after the second action":
 * the DB write was already correct (ticketActionStartPlan claims
 * ownership in the same update that starts the clock — see
 * ticket-action-start-plan.test.ts). The bug was purely on read: the
 * ticket page resolves the owner's display name via a profile lookup
 * keyed by owner id. The moment ownership changes, that's a brand new
 * query key with nothing cached — a loading gap — and the old
 * `assignee?.full_name ?? assignee?.email ?? "Unassigned"` fallback
 * couldn't tell "no owner" apart from "owner set, profile still
 * loading", so it read as Unassigned during that gap. By the second
 * action the profile had long since loaded, making it look like
 * ownership only "took" on the second try.
 */
describe("ticketAssigneeName — no intermediate or final Unassigned once an owner is set", () => {
  it("shows Unassigned only when there truly is no owner", () => {
    expect(ticketAssigneeName(null, null)).toBe("Unassigned");
    expect(ticketAssigneeName(null, undefined)).toBe("Unassigned");
  });

  it("never shows Unassigned once an owner id is set, even while their profile is still loading", () => {
    // This is exactly the window that produced the bug: ownerId already
    // flipped to the acting user, but the ["ticket-assignee", ownerId]
    // query hasn't resolved yet.
    expect(ticketAssigneeName("emily-id", undefined)).not.toBe("Unassigned");
    expect(ticketAssigneeName("emily-id", null)).not.toBe("Unassigned");
  });

  it("shows the real name once the profile resolves", () => {
    expect(
      ticketAssigneeName("emily-id", { full_name: "Emily Jimenez", email: "emily@arha.com" }),
    ).toBe("Emily Jimenez");
  });

  it("falls back to email when the profile has no name on file, still never Unassigned", () => {
    expect(ticketAssigneeName("emily-id", { full_name: null, email: "emily@arha.com" })).toBe(
      "emily@arha.com",
    );
  });
});
