import { describe, expect, it } from "bun:test";
import {
  isCompletable,
  ticketCurrentAction,
  validateAction,
  type CurrentActionInput,
} from "@/lib/ticket-current-action";

const base: CurrentActionInput = {
  status: "in_progress",
  acknowledged_at: "2026-09-01T10:00:00Z",
  action_started_at: "2026-09-01T10:05:00Z",
};

describe("the one Current Action on a ticket", () => {
  it("asks for acknowledgement first, and asks for nothing in writing", () => {
    const a = ticketCurrentAction({ ...base, acknowledged_at: null, action_started_at: null });
    expect(a?.id).toBe("acknowledge");
    expect(a?.fields.every((f) => !f.required)).toBe(true);
  });

  it("asks what you are doing first before work can start", () => {
    const a = ticketCurrentAction({ ...base, action_started_at: null });
    expect(a?.id).toBe("start_work");
    expect(validateAction(a!, {})).toContain("What you're doing first");
    expect(validateAction(a!, { first_step: "Called the plumber" })).toBeNull();
  });

  it("a parked ticket asks for the follow-up, and a new date only when it stays parked", () => {
    const a = ticketCurrentAction({ ...base, status: "waiting", waiting_on: "vendor" });
    expect(a?.id).toBe("waiting_followup");
    expect(validateAction(a!, { update: "Left a message", outcome: "resume" })).toBeNull();
    expect(validateAction(a!, { update: "Left a message", outcome: "still_waiting" })).toContain(
      "come back to you",
    );
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(
      validateAction(a!, {
        update: "Left a message",
        outcome: "still_waiting",
        next_review_at: future,
      }),
    ).toBeNull();
  });

  it("refuses a follow-up date in the past", () => {
    const a = ticketCurrentAction({ ...base, status: "waiting", waiting_on: "owner" });
    expect(
      validateAction(a!, {
        update: "Chased it",
        outcome: "still_waiting",
        next_review_at: "2020-01-01T10:00",
      }),
    ).toContain("future");
  });

  it("an engaged vendor comes before the remaining steps", () => {
    const a = ticketCurrentAction({
      ...base,
      vendor_name: "J-Mar",
      vendor_status: "dispatched",
      requiredOpenSteps: 2,
    });
    expect(a?.id).toBe("vendor_checkin");
    expect(a?.title).toContain("J-Mar");
  });

  it("hands off to the panels that own steps, repairs, evidence and closure", () => {
    expect(ticketCurrentAction({ ...base, requiredOpenSteps: 1 })?.handoff?.target).toBe("steps");
    expect(ticketCurrentAction({ ...base, repairActive: true })?.handoff?.target).toBe("repair");
    expect(ticketCurrentAction({ ...base, missingClosureEvidence: true })?.handoff?.target).toBe(
      "closure",
    );
    expect(ticketCurrentAction(base)?.id).toBe("close_out");
  });

  it("asks for a guest update while someone is in the home", () => {
    const a = ticketCurrentAction({ ...base, guest_in_residence: true });
    expect(a?.id).toBe("guest_update");
    expect(isCompletable(a!.id)).toBe(true);
  });

  it("a closed ticket has no current action", () => {
    expect(ticketCurrentAction({ ...base, status: "closed" })).toBeNull();
  });

  it("only the steps Resolve can finish itself are completable", () => {
    expect(isCompletable("close_out")).toBe(false);
    expect(isCompletable("work_steps")).toBe(false);
    expect(isCompletable("acknowledge")).toBe(true);
  });
});
