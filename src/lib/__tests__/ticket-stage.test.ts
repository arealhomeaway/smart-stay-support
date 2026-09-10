import { describe, expect, it } from "bun:test";
import { ticketStage, type TicketStageInput } from "../ticket-stage";

const base: TicketStageInput = {
  status: "in_progress",
  closed: false,
  acknowledged_at: "2026-09-01T00:00:00Z",
  action_started_at: "2026-09-01T00:05:00Z",
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
