import { describe, expect, it } from "bun:test";
import { repairIsComplete, ticketStage, type TicketStageInput } from "../ticket-stage";

const base: TicketStageInput = {
  status: "in_progress",
  closed: false,
  repairExists: false,
  repairComplete: false,
  verified: true,
  requiredOpenSteps: 0,
  repairPossible: false,
  repairReportedIncomplete: false,
};

describe("ticketStage — Work Order completion never blindly closes a Ticket", () => {
  it("stays repair_active while a Work Order is open (not yet closed)", () => {
    expect(ticketStage({ ...base, repairExists: true, repairComplete: false })).toBe(
      "repair_active",
    );
  });

  it("moves to verify once the Work Order is complete but the guest hasn't confirmed", () => {
    expect(
      ticketStage({ ...base, repairExists: true, repairComplete: true, verified: false }),
    ).toBe("verify");
  });

  it("moves to closure once the Work Order is complete and the guest is verified, with no open steps", () => {
    expect(ticketStage({ ...base, repairExists: true, repairComplete: true, verified: true })).toBe(
      "closure",
    );
  });

  it("still requires open playbook steps before closure, even with the repair done and guest verified", () => {
    expect(
      ticketStage({
        ...base,
        repairExists: true,
        repairComplete: true,
        verified: true,
        requiredOpenSteps: 1,
      }),
    ).toBe("steps");
  });

  it("is never fooled into closed by anything but the Ticket's own closed flag", () => {
    expect(
      ticketStage({ ...base, repairExists: true, repairComplete: true, closed: false }),
    ).not.toBe("closed");
    expect(ticketStage({ ...base, closed: true })).toBe("closed");
  });
});

describe("ticketStage — 'Still needs repair' sends a completed-but-failed repair back to repair, not verify or closure", () => {
  it("routes to repair, not verify, once the completed repair is reported unsuccessful", () => {
    expect(
      ticketStage({
        ...base,
        repairPossible: true,
        repairExists: true,
        repairComplete: true,
        verified: false,
        repairReportedIncomplete: true,
      }),
    ).toBe("repair");
  });

  it("without repairReportedIncomplete, the same record still goes to verify (unchanged behavior)", () => {
    expect(
      ticketStage({
        ...base,
        repairPossible: true,
        repairExists: true,
        repairComplete: true,
        verified: false,
        repairReportedIncomplete: false,
      }),
    ).toBe("verify");
  });

  it("does not route to repair once the guest has verified, even if repairReportedIncomplete is stale-true", () => {
    // Guards against a stale flag from a prior cycle overriding a genuine
    // guest confirmation — verified takes priority once it's true.
    expect(
      ticketStage({
        ...base,
        repairPossible: true,
        repairExists: true,
        repairComplete: true,
        verified: true,
        repairReportedIncomplete: true,
      }),
    ).toBe("closure");
  });

  it("a freshly opened Work Order takes priority over a stale repairReportedIncomplete flag", () => {
    // Once a new Work Order is open, repairComplete goes back to false —
    // repair_active wins regardless of the flag from the previous cycle.
    expect(
      ticketStage({
        ...base,
        repairPossible: true,
        repairExists: true,
        repairComplete: false,
        verified: false,
        repairReportedIncomplete: true,
      }),
    ).toBe("repair_active");
  });

  it("required playbook steps still gate closure even when repair is reported incomplete and later cleared", () => {
    expect(
      ticketStage({
        ...base,
        repairPossible: true,
        repairExists: true,
        repairComplete: true,
        verified: true,
        requiredOpenSteps: 2,
        repairReportedIncomplete: false,
      }),
    ).toBe("steps");
  });
});

describe("repairIsComplete — 'Vendor says complete' is an internal Work Order milestone, not a Ticket signal", () => {
  it("is not complete while the Work Order is open, even once the vendor has reported done", () => {
    // vendor_completed_at is deliberately absent from this shape — the
    // Ticket-facing signal only ever looks at closed_at.
    expect(
      repairIsComplete({
        vendorStatus: null,
        liveOrders: [{ closed_at: null }],
      }),
    ).toBe(false);
  });

  it("is complete once the Work Order actually closes", () => {
    expect(
      repairIsComplete({
        vendorStatus: null,
        liveOrders: [{ closed_at: "2026-09-10T12:00:00Z" }],
      }),
    ).toBe(true);
  });

  it("stays incomplete while any one of several live Work Orders is still open", () => {
    expect(
      repairIsComplete({
        vendorStatus: null,
        liveOrders: [{ closed_at: "2026-09-01T00:00:00Z" }, { closed_at: null }],
      }),
    ).toBe(false);
  });

  it("the older on-ticket vendor_status field is still an independent, second signal", () => {
    expect(
      repairIsComplete({
        vendorStatus: "completed",
        liveOrders: [],
      }),
    ).toBe(true);
  });

  it("is not complete with no live orders and no legacy vendor_status", () => {
    expect(
      repairIsComplete({
        vendorStatus: null,
        liveOrders: [],
      }),
    ).toBe(false);
  });
});

describe("ticketStage — end to end: Work Order completion timing", () => {
  it("a new Work Order plus 'Vendor says complete' keeps the Ticket in repair_active, not verify", () => {
    const repairComplete = repairIsComplete({
      vendorStatus: null,
      liveOrders: [{ closed_at: null }], // vendor_completed_at set, closed_at not
    });
    expect(
      ticketStage({
        ...base,
        repairPossible: true,
        repairExists: true,
        repairComplete,
        verified: false,
      }),
    ).toBe("repair_active");
  });

  it("closing that same Work Order immediately moves the Ticket to verify — the same recomputation, no separate step", () => {
    const repairComplete = repairIsComplete({
      vendorStatus: null,
      liveOrders: [{ closed_at: "2026-09-10T12:00:00Z" }],
    });
    expect(
      ticketStage({
        ...base,
        repairPossible: true,
        repairExists: true,
        repairComplete,
        verified: false,
      }),
    ).toBe("verify");
  });
});
