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
