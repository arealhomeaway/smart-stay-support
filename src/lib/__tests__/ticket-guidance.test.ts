import { describe, expect, it } from "bun:test";
import { activeGuestStay, ticketGuidance, type GuidanceInput } from "@/lib/ticket-guidance";

const now = new Date("2026-10-01T15:00:00Z");
const base: GuidanceInput = {
  status: "in_progress",
  closed: false,
  acknowledged_at: "2026-10-01T14:00:00Z",
  openWorkOrders: 0,
  completeWorkOrders: 0,
  requiredOpenSteps: 0,
  missingEvidence: false,
  now,
};
const stay = { reservation_arrival: "2026-09-29", reservation_departure: "2026-10-04" };

describe("ticket guidance", () => {
  it("derives an active stay from reservation dates without asking", () => {
    expect(activeGuestStay(stay, now)).toBe(true);
    expect(activeGuestStay({ reservation_arrival: "2026-10-05", reservation_departure: "2026-10-08" }, now)).toBe(false);
  });
  it("unacknowledged defers to the existing acknowledge action", () => {
    const g = ticketGuidance({ ...base, acknowledged_at: null });
    expect(g.stage).toBe("needs_acknowledgment");
    expect(g.step).toBeNull();
  });
  it("active stay asks for a guest update first, then the decision", () => {
    expect(ticketGuidance({ ...base, ...stay }).step).toBe("guest_update");
    const g = ticketGuidance({ ...base, ...stay, guest_update_at: "2026-10-01T14:30:00Z" });
    expect(g.stage).toBe("needs_decision");
    expect(g.step).toBe("decide");
  });
  it("no stay goes straight to the decision", () => {
    expect(ticketGuidance(base).step).toBe("decide");
  });
  it("troubleshooting path shows steps, then 'not fixed' moves on", () => {
    const g = ticketGuidance({ ...base, resolution_path: "guest", troubleshooting: { total: 3, answered: 1, fixed: false, notFixed: false } });
    expect(g.step).toBe("troubleshoot");
    const after = ticketGuidance({ ...base, resolution_path: "field", troubleshooting: { total: 3, answered: 2, fixed: false, notFixed: true } });
    expect(after.step).toBe("choose_vendor");
  });
  it("field path asks who should handle it until a vendor is chosen", () => {
    expect(ticketGuidance({ ...base, resolution_path: "field" }).step).toBe("choose_vendor");
    expect(ticketGuidance({ ...base, resolution_path: "field", selected_vendor_org_id: "v1" }).step).toBeNull();
  });
  it("waiting shows the dependency and what happens next", () => {
    const g = ticketGuidance({ ...base, resolution_path: "field", waiting_on: "vendor", waiting_reason: "ETA tomorrow 9am", next_review_at: "2026-10-02T14:00:00Z" });
    expect(g.stage).toBe("waiting");
    expect(g.waiting?.on).toBe("Vendor ETA");
    expect(g.waiting?.next).toBe("ETA tomorrow 9am");
  });
  it("overdue check-in becomes Needs Follow-Up", () => {
    const g = ticketGuidance({ ...base, resolution_path: "field", waiting_on: "guest", next_review_at: "2026-10-01T10:00:00Z" });
    expect(g.stage).toBe("needs_follow_up");
  });
  it("open Work Order keeps the ticket waiting under the parent", () => {
    const g = ticketGuidance({ ...base, resolution_path: "field", selected_vendor_org_id: "v1", openWorkOrders: 1 });
    expect(g.stage).toBe("waiting");
  });
  it("Ready to Close lists what is missing", () => {
    const g = ticketGuidance({ ...base, ...stay, guest_update_at: "x", resolution_path: "already_resolved", missingEvidence: true });
    expect(g.stage).toBe("ready_to_close");
    expect(g.remaining).toBe(2);
    expect(g.closeItems.filter((i) => !i.done).map((i) => i.label)).toEqual([
      "Issue resolution summary",
      "Required evidence present",
    ]);
    const done = ticketGuidance({ ...base, resolution_path: "already_resolved", resolution_notes: "Reset breaker" });
    expect(done.remaining).toBe(0);
    expect(done.title).toBe("Ready to Close");
  });
  it("closed is closed", () => {
    expect(ticketGuidance({ ...base, closed: true }).stage).toBe("closed");
  });
});
