import { describe, expect, it } from "bun:test";
import { ticketStage, type TicketStageInput } from "../ticket-stage";

const base: TicketStageInput = {
  status: "open",
  closed: false,
  repairExists: false,
  repairComplete: false,
  verified: false,
  requiredOpenSteps: 0,
  repairPossible: false,
  repairReportedIncomplete: false,
};

/**
 * "Start working" is no longer a separate gate a ticket has to pass
 * through before its real stage shows: acknowledged_at/action_started_at
 * are backfilled automatically on the first real action instead (see
 * ticketActionStartPlan / ensureTicketActionStarted), so ticketStage() no
 * longer takes those fields as input at all, and can never block on them.
 */
describe("ticketStage — the retired 'start' gate never blocks the real stage", () => {
  it("a brand new, untouched, non-repairable ticket goes straight to closure — not a start gate", () => {
    expect(ticketStage(base)).toBe("closure");
  });

  it("a brand new, repairable ticket shows 'repair' immediately, with nothing pre-acknowledged", () => {
    expect(ticketStage({ ...base, repairPossible: true })).toBe("repair");
  });

  it("required steps still gate closure on an otherwise-untouched ticket", () => {
    expect(ticketStage({ ...base, requiredOpenSteps: 2 })).toBe("steps");
  });

  it("a ticket parked as 'waiting' shows that stage even if never separately acknowledged", () => {
    expect(ticketStage({ ...base, status: "waiting" })).toBe("waiting");
  });
});
