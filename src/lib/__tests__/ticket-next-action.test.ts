import { describe, expect, it } from "bun:test";
import { ticketNextAction } from "../ticket-next-action";

const base = {
  status: "open",
  acknowledged_at: "2026-09-01T00:00:00Z",
  action_started_at: "2026-09-01T00:05:00Z",
};

describe("ticket next action", () => {
  it("says nothing for a closed ticket", () => {
    expect(ticketNextAction({ ...base, status: "closed" })).toBeNull();
  });

  it("asks for acknowledgement first", () => {
    expect(
      ticketNextAction({ ...base, acknowledged_at: null, action_started_at: null })?.label,
    ).toBe("Acknowledge this ticket");
  });

  it("asks to start work once acknowledged", () => {
    expect(ticketNextAction({ ...base, action_started_at: null })?.label).toBe("Start the work");
  });

  it("asks to follow up when a parked ticket is due back", () => {
    const a = ticketNextAction({ ...base, status: "waiting", waiting_on: "vendor" });
    expect(a?.label).toBe("Follow up with the vendor");
    expect(a?.because).toContain("paused");
  });

  it("says who we are waiting on, in plain words, before it is due back", () => {
    const later = new Date(Date.now() + 6 * 3600_000).toISOString();
    const a = ticketNextAction({
      ...base,
      status: "waiting",
      waiting_on: "parts",
      waiting_reason: "Compressor on order",
      next_review_at: later,
    });
    expect(a?.label).toBe("Waiting on the parts or delivery");
    expect(a?.because).toContain("Compressor on order");
  });

  it("never asks to close a ticket that is already signed off", () => {
    expect(
      ticketNextAction({ ...base, status: "closed", resolved_at: new Date().toISOString() }),
    ).toBeNull();
  });

  it("checks in with an engaged vendor", () => {
    expect(
      ticketNextAction({ ...base, vendor_name: "Ace HVAC", vendor_status: "dispatched" })?.label,
    ).toBe("Check in with Ace HVAC");
  });

  it("clears required steps before closure", () => {
    expect(ticketNextAction({ ...base, requiredOpenSteps: 2 })?.because).toContain("2 required");
  });

  it("asks for evidence before closure", () => {
    expect(ticketNextAction({ ...base, missingClosureEvidence: true })?.label).toContain(
      "evidence",
    );
  });

  it("closes out when resolved and unblocked", () => {
    expect(ticketNextAction({ ...base, status: "resolved" })?.label).toBe("Close it out");
  });

  it("prioritises the guest while work is in flight", () => {
    expect(ticketNextAction({ ...base, guest_in_residence: true })?.label).toBe("Update the guest");
  });
});
